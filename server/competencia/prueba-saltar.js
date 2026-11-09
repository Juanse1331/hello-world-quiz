// Prueba automática de "Saltar reto": pendientes, retomar con el tiempo que quedaba y finalizar.
// Uso: node server/competencia/prueba-saltar.js   (termina con "OK" o muestra qué falló)
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { crearGestorCompetencias } = require('./index')
const { calcularRanking } = require('./ranking')

const esperar = (ms) => new Promise(r => setTimeout(r, ms))
const rutaGuardado = path.join(os.tmpdir(), `prueba-saltar-${process.pid}.json`)

const preguntas = [{ id: 1, nivel: 'facil', tipo: 'SM', puntos: 10, tiempo_segundos: 30, enunciado: '¿1+1?', opciones: ['1', '2'], respuesta_correcta: 1 }]
const problemas = ['A', 'B'].map(x => ({
  id: 'P' + x, titulo: 'Reto ' + x, nivel: 'facil', puntos: 100, tiempo_minutos: 10, enunciado: 'a+b',
  ejemplos: [{ entrada: '3 7', salida: '10' }],
  pruebas_ocultas: [{ entrada: '-5 2', salida: '-3' }, { entrada: '0 0', salida: '0' }]
}))

async function ejecutar({ codigo, entrada }) {
  if (codigo === 'suma') return { estado: 'OK', salida: String(entrada.split(' ').map(Number).reduce((a, b) => a + b)), error: '', ms: 1 }
  return { estado: 'OK', salida: '10', error: '', ms: 1 }
}

const ultimo = {}
const esperandoResultado = {}
const io = { to: (id) => ({ emit: (ev, datos) => {
  if (ev === 'competencia:mi-estado') ultimo[id] = datos
  if (ev === 'competencia:resultado' && esperandoResultado[id]) { const r = esperandoResultado[id]; delete esperandoResultado[id]; r(datos) }
} }) }
let contador = 0
function socketFalso() {
  const handlers = {}
  return { id: 's' + (++contador), data: {}, on: (ev, fn) => { handlers[ev] = fn }, join() {}, handlers }
}
const llamar = (s, ev, datos) => new Promise(r => s.handlers[ev](datos, r))
async function calificar(s, ev, datos) {
  const resultado = new Promise(r => { esperandoResultado[s.id] = r })
  const ack = await llamar(s, ev, datos)
  if (!ack.ok) { delete esperandoResultado[s.id]; return ack }
  return resultado
}

;(async () => {
  const g = crearGestorCompetencias({
    io, bancoPreguntas: preguntas, bancoProblemas: problemas, adminToken: 'T', generarCodigo: () => 'SALT-0001',
    rutaGuardado, ejecutar, config: { esperaEnvioMs: 0, esperaPruebaMs: 0, pausaResultadoMs: 30 }
  })
  const admin = socketFalso(); g.registrarSocket(admin)
  assert.ok((await llamar(admin, 'admin:competencia:crear', { token: 'T', preguntaIds: [1], problemaIds: ['PA', 'PB'], lenguajes: ['python'] })).ok)
  const s = socketFalso(); g.registrarSocket(s)
  await new Promise(r => g.unirse(s, { nombre: 'Ana', codigoEstudiante: '1', codigoSala: 'SALT-0001' }, r))
  const otro = socketFalso(); g.registrarSocket(otro)
  await new Promise(r => g.unirse(otro, { nombre: 'Luis', codigoEstudiante: '2', codigoSala: 'SALT-0001' }, r))
  assert.ok((await llamar(admin, 'admin:competencia:iniciar', {})).ok)
  const comp = g._competencias.get('SALT-0001')
  const p = comp.participantes[0]
  // Orden fijo para la prueba: reto A, pregunta, reto B
  p.orden = [{ tipo: 'problema', id: 'PA' }, { tipo: 'pregunta', id: 1 }, { tipo: 'problema', id: 'PB' }]

  // 1) Las preguntas no se pueden saltar
  p.actual = 1
  assert.ok(!(await llamar(s, 'estudiante:saltar', { problemaId: 1 })).ok, 'una pregunta no se salta')
  p.actual = 0

  // 2) Salta el reto A cuando lleva 2 min (le quedan 8)
  p.itemInicio = Date.now() - 120000
  p.itemFin = Date.now() + 480000
  let r = await llamar(s, 'estudiante:saltar', { problemaId: 'PA' })
  assert.ok(r.ok, 'salta el reto')
  assert.strictEqual(ultimo[s.id].item.tipo, 'pregunta', 'pasa al siguiente ítem')
  assert.ok(p.problemas.PA.saltado && Math.abs(p.problemas.PA.restanteMs - 480000) < 200, 'guarda el tiempo que le quedaba')

  // 3) Responde la pregunta y salta también el reto B (tras un envío parcial)
  await llamar(s, 'estudiante:responder', { preguntaId: 1, respuesta: 1 })
  await esperar(60)
  assert.strictEqual(ultimo[s.id].item.problema.id, 'PB')
  const parcial = await calificar(s, 'estudiante:enviar', { problemaId: 'PB', lenguaje: 'python', codigo: 'print(10)' })
  assert.strictEqual(parcial.envio.veredicto, 'INCORRECTO')
  await esperar(5)
  assert.ok((await llamar(s, 'estudiante:saltar', { problemaId: 'PB' })).ok)

  // 4) Terminó el recorrido con 2 retos pendientes: NO está terminado y ve la lista
  let v = ultimo[s.id]
  assert.strictEqual(v.item, null, 'sin ítem abierto')
  assert.ok(v.enPendientes && !p.terminado, 'en la lista de pendientes, sin terminar')
  assert.deepStrictEqual(v.pendientes.map(x => x.id).sort(), ['PA', 'PB'])
  assert.strictEqual(v.pendientes.find(x => x.id === 'PB').intentosFallidos, 1, 'conserva sus intentos')
  assert.strictEqual(comp.estado, 'en-curso', 'la competencia sigue')

  // 5) Retoma el reto A: le quedan ~8 min y el tiempo usado (2 min) se conserva para el desempate
  r = await llamar(s, 'estudiante:retomar', { problemaId: 'PA' })
  assert.ok(r.ok, 'retoma')
  v = ultimo[s.id]
  assert.strictEqual(v.item.problema.id, 'PA')
  assert.ok(v.item.retomado, 'marcado como retomado')
  assert.strictEqual(v.item.numero, 1, 'conserva su número original')
  assert.ok(Math.abs((v.item.fin - Date.now()) - 480000) < 500, 'su reloj sigue donde quedó')
  assert.ok(!(await llamar(s, 'estudiante:retomar', { problemaId: 'PB' })).ok, 'no abre dos retos a la vez')
  const ok = await calificar(s, 'estudiante:enviar', { problemaId: 'PA', lenguaje: 'python', codigo: 'suma' })
  assert.strictEqual(ok.envio.veredicto, 'ACEPTADO')
  assert.strictEqual(ok.envio.bonus, 48, 'bonus con los 480 s que le quedaban')
  assert.ok(Math.abs(ok.envio.tiempoMs - 120000) < 500, 'el tiempo usado antes de saltar cuenta para el desempate')
  await esperar(60)

  // 6) Vuelve a la lista: solo queda B. Lo retoma y lo vuelve a saltar
  v = ultimo[s.id]
  assert.ok(v.enPendientes)
  assert.deepStrictEqual(v.pendientes.map(x => x.id), ['PB'])
  assert.ok((await llamar(s, 'estudiante:retomar', { problemaId: 'PB' })).ok)
  assert.ok((await llamar(s, 'estudiante:saltar', { problemaId: 'PB' })).ok, 'se puede volver a saltar')
  assert.ok(ultimo[s.id].enPendientes)

  // 7) Admin: ve el progreso con pendientes
  const fila = calcularRanking(comp).find(f => f.codigoEstudiante === '1')
  assert.strictEqual(fila.progreso.total, 3, 'el total no cuenta los retomados')
  assert.ok(fila.progreso.enPendientes && fila.progreso.pendientes === 1)

  // 8) Finaliza sin resolver B. La competencia no termina hasta que el otro estudiante acabe
  assert.ok((await llamar(s, 'estudiante:finalizar', {})).ok)
  assert.ok(p.terminado && !ultimo[s.id].enPendientes)
  assert.strictEqual(comp.estado, 'en-curso')
  const p2 = comp.participantes[1]
  p2.terminado = true
  assert.ok(!(await llamar(otro, 'estudiante:finalizar', {})).ok, 'no puede finalizar sin estar en pendientes')
  await llamar(admin, 'admin:competencia:terminar', {})
  await esperar(20)
  const resumen = ultimo[s.id].resumen
  assert.strictEqual(resumen.length, 3, 'el resumen no repite los retos retomados')
  assert.ok(resumen.find(x => x.id === 'PB').saltado, 'B quedó como saltado')
  assert.ok(resumen.find(x => x.id === 'PA').aceptado)

  console.log('OK: saltar, retomar y finalizar funcionan')
  fs.rmSync(rutaGuardado, { force: true })
  process.exit(0)
})().catch(e => { console.error('FALLÓ:', e.message); fs.rmSync(rutaGuardado, { force: true }); process.exit(1) })
