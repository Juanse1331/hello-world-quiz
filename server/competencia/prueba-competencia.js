// Prueba automática de las reglas de la competencia, sin Piston ni navegador.
// Uso: node server/competencia/prueba-competencia.js   (termina con "OK" o muestra qué falló)
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { crearGestorCompetencias } = require('./index')

const esperar = (ms) => new Promise(r => setTimeout(r, ms))
const rutaGuardado = path.join(os.tmpdir(), `prueba-competencia-${process.pid}.json`)

// Ítems con tiempos cortos para que la prueba dure segundos
const preguntas = [
  { id: 1, nivel: 'facil', tipo: 'SM', puntos: 10, tiempo_segundos: 1, enunciado: '¿1+1?', opciones: ['1', '2'], respuesta_correcta: 1 },
  { id: 2, nivel: 'facil', tipo: 'VF', puntos: 10, tiempo_segundos: 1, enunciado: '¿2>1?', opciones: ['V', 'F'], respuesta_correcta: 0 }
]
const problemas = [{
  id: 'P01', titulo: 'Suma', nivel: 'facil', puntos: 100, tiempo_minutos: 0.05, enunciado: 'a+b',
  ejemplos: [{ entrada: '3 7', salida: '10' }],
  pruebas_ocultas: [{ entrada: '-5 2', salida: '-3' }, { entrada: '0 0', salida: '0' }]
}]

// Motor falso: 'suma' resuelve bien; cualquier otra cosa imprime 10
async function ejecutar({ codigo, entrada }) {
  if (codigo === 'suma') return { estado: 'OK', salida: String(entrada.split(' ').map(Number).reduce((a, b) => a + b)), error: '', ms: 1 }
  return { estado: 'OK', salida: '10', error: '', ms: 1 }
}

// Socket.io falso: guarda el último 'mi-estado' que recibe cada socket
const ultimo = {}
const io = { to: (id) => ({ emit: (ev, datos) => { if (ev === 'competencia:mi-estado') ultimo[id] = datos } }) }
let contador = 0
function socketFalso() {
  const handlers = {}
  return { id: 's' + (++contador), data: {}, on: (ev, fn) => { handlers[ev] = fn }, join() {}, handlers }
}
const llamar = (s, ev, datos) => new Promise(r => s.handlers[ev](datos, r))

function nuevoGestor() {
  return crearGestorCompetencias({
    io, bancoPreguntas: preguntas, bancoProblemas: problemas, adminToken: 'T', generarCodigo: () => 'ABCD-1234',
    rutaGuardado, ejecutar, config: { esperaEnvioMs: 0, esperaPruebaMs: 0, pausaResultadoMs: 50 }
  })
}

;(async () => {
  const g = nuevoGestor()
  const admin = socketFalso(); g.registrarSocket(admin)
  const r = await llamar(admin, 'admin:competencia:crear', { token: 'T', preguntaIds: [1, 2], problemaIds: ['P01'], lenguajes: ['python'] })
  assert.ok(r.ok, 'crear')

  // 12 estudiantes: todos reciben los 3 ítems y no todos en el mismo orden
  const est = []
  for (let i = 0; i < 12; i++) {
    const s = socketFalso(); g.registrarSocket(s)
    await new Promise(res => g.unirse(s, { nombre: 'E' + i, codigoEstudiante: String(i), codigoSala: 'abcd-1234' }, res))
    est.push(s)
  }
  assert.ok((await llamar(admin, 'admin:competencia:iniciar', {})).ok, 'iniciar')
  const comp = g._competencias.get('ABCD-1234')
  const ordenes = comp.participantes.map(p => p.orden.map(x => x.id).join(','))
  comp.participantes.forEach(p => assert.strictEqual(p.orden.length, 3))
  assert.ok(new Set(ordenes).size > 1, 'los órdenes deben variar entre estudiantes')

  // Estudiante 0: resuelve su recorrido según lo que le toque
  const s0 = est[0]
  const p0 = comp.participantes[0]
  for (let paso = 1; paso <= 3; paso++) {
    const item = ultimo[s0.id].item
    assert.strictEqual(item.numero, paso, 'avanza en orden')
    if (item.tipo === 'pregunta') {
      assert.strictEqual(item.pregunta.respuesta_correcta, undefined, 'no revela la respuesta')
      const q = preguntas.find(x => x.id === item.pregunta.id)
      const r = await llamar(s0, 'estudiante:responder', { preguntaId: q.id, respuesta: q.respuesta_correcta })
      assert.ok(r.ok && r.esCorrecta && r.puntos >= q.puntos, 'dice si acertó')
      assert.strictEqual(r.respuestaCorrecta, undefined, 'no revela cuál era la correcta')
      assert.ok(!(await llamar(s0, 'estudiante:responder', { preguntaId: q.id, respuesta: 0 })).ok, 'no responde dos veces durante la pausa')
      assert.strictEqual(ultimo[s0.id].item.numero, paso, 'pausa antes de avanzar')
      await esperar(80)
    } else {
      // Imprimir fijo el resultado del ejemplo: 0 puntos y no avanza
      let e = await llamar(s0, 'estudiante:enviar', { problemaId: 'P01', lenguaje: 'python', codigo: 'print(10)' })
      assert.strictEqual(e.envio.puntos, 0, 'print(10) no da puntos')
      assert.strictEqual(e.envio.veredicto, 'INCORRECTO')
      assert.strictEqual(ultimo[s0.id].item.numero, paso, 'sigue en el problema')
      e = await llamar(s0, 'estudiante:enviar', { problemaId: 'P01', lenguaje: 'python', codigo: 'suma' })
      assert.strictEqual(e.envio.veredicto, 'ACEPTADO')
      assert.strictEqual(e.envio.puntos, 100)
      await esperar(80)
    }
  }
  assert.ok(p0.terminado, 'estudiante 0 terminó su recorrido')
  assert.ok(!(await llamar(s0, 'estudiante:responder', { preguntaId: 1, respuesta: 1 })).ok, 'no puede volver atrás')

  // Los demás no hacen nada: sus preguntas vencen a 1 s y su problema a 3 s
  const p1 = comp.participantes.slice(1).find(p => p.orden[0].tipo === 'pregunta')
  await esperar(1200)
  assert.ok(p1.actual >= 1, 'avanzó solo al vencer el tiempo')

  // Persistencia: se reinicia el servidor a mitad; el tiempo vencido se aplica al recuperar
  g.guardarYa()
  const g2 = nuevoGestor()
  const comp2 = g2._competencias.get('ABCD-1234')
  assert.strictEqual(comp2.estado, 'en-curso', 'recuperada del disco')

  // Todos los demás dejan vencer todo: la competencia termina sola
  await esperar(5000)
  assert.strictEqual(comp2.estado, 'terminado', 'termina cuando todos acaban')
  const fila0 = require('./ranking').calcularRanking(comp2).find(f => f.codigoEstudiante === '0')
  assert.strictEqual(fila0.posicion, 1, 'quien respondió todo va primero')
  assert.strictEqual(fila0.preguntas.correctas, 2)
  const sinResponder = comp2.participantes.find(p => p.codigoEstudiante === p1.codigoEstudiante).respuestas[1]
  assert.strictEqual(sinResponder.respuesta, null, 'pregunta vencida cuenta como no respondida')

  console.log('OK: todas las pruebas de la competencia pasaron')
  fs.rmSync(rutaGuardado, { force: true })
  process.exit(0)
})().catch(e => { console.error('FALLÓ:', e.message); fs.rmSync(rutaGuardado, { force: true }); process.exit(1) })
