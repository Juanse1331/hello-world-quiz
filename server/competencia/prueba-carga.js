// Prueba de carga: 20 estudiantes con un motor de ejecución lento (como Piston con el PC saturado).
// Reproduce el caso en que el envío quedaba "pegado": el reto vence mientras el envío espera en la cola.
// Uso: node server/competencia/prueba-carga.js   (termina con "OK" o muestra qué falló)
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { crearGestorCompetencias } = require('./index')

const esperar = (ms) => new Promise(r => setTimeout(r, ms))
const rutaGuardado = path.join(os.tmpdir(), `prueba-carga-${process.pid}.json`)
const problemas = [1, 2].map(n => ({
  id: 'P0' + n, titulo: 'Suma ' + n, nivel: 'facil', puntos: 100, tiempo_minutos: 0.1, enunciado: 'a+b',
  ejemplos: [{ entrada: '3 7', salida: '10' }],
  pruebas_ocultas: [1, 2, 3, 4, 5].map(i => ({ entrada: `${i} ${i}`, salida: String(2 * i) }))
}))

// Cada ejecución tarda 400 ms
let simultaneas = 0
let maxSimultaneas = 0
async function ejecutar({ entrada }) {
  simultaneas++
  maxSimultaneas = Math.max(maxSimultaneas, simultaneas)
  await esperar(400)
  simultaneas--
  return { estado: 'OK', salida: String(entrada.split(' ').map(Number).reduce((a, b) => a + b)), error: '', ms: 400 }
}

const ultimo = {}
const resultados = {}
const io = { to: (id) => ({ emit: (ev, datos) => {
  if (ev === 'competencia:mi-estado') ultimo[id] = datos
  if (ev === 'competencia:resultado') (resultados[id] ||= []).push(datos)
} }) }
let contador = 0
function socketFalso() {
  const handlers = {}
  return { id: 's' + (++contador), data: {}, on: (ev, fn) => { handlers[ev] = fn }, join() {}, handlers }
}
const llamar = (s, ev, datos) => new Promise(r => s.handlers[ev](datos, r))
async function hasta(condicion, maxMs = 30000) {
  const inicio = Date.now()
  while (!condicion()) {
    if (Date.now() - inicio > maxMs) throw new Error('tiempo de espera agotado')
    await esperar(20)
  }
}

;(async () => {
  const g = crearGestorCompetencias({
    io, bancoPreguntas: [], bancoProblemas: problemas, adminToken: 'T', generarCodigo: () => 'CARG-0001',
    rutaGuardado, ejecutar, config: { enviosSimultaneos: 4, pruebasParalelas: 3, pausaResultadoMs: 50 }
  })
  const admin = socketFalso(); g.registrarSocket(admin)
  await llamar(admin, 'admin:competencia:crear', { token: 'T', preguntaIds: [], problemaIds: ['P01', 'P02'], lenguajes: ['python'] })
  const est = []
  for (let i = 0; i < 20; i++) {
    const s = socketFalso(); g.registrarSocket(s)
    await new Promise(r => g.unirse(s, { nombre: 'E' + i, codigoEstudiante: 'e' + i, codigoSala: 'CARG-0001' }, r))
    est.push(s)
  }
  await llamar(admin, 'admin:competencia:iniciar', {})
  const comp = g._competencias.get('CARG-0001')
  const P = (s) => comp.participantes.find(p => p.socketId === s.id)
  const idActual = (s) => P(s).orden[P(s).actual].id

  // 1) 19 estudiantes pulsan Probar; luego E0 envía: su envío pasa ANTES que las pruebas
  for (const s of est.slice(1)) assert.ok((await llamar(s, 'estudiante:probar', { problemaId: idActual(s), lenguaje: 'python', codigo: 'x' })).ok)
  const s0 = est[0]
  let t = Date.now()
  const ack = await llamar(s0, 'estudiante:enviar', { problemaId: idActual(s0), lenguaje: 'python', codigo: 'x' })
  assert.ok(ack.ok && ack.enCola && Date.now() - t < 100, 'el servidor confirma el envío al instante')
  assert.ok(ultimo[s0.id].evaluando?.tipo === 'envio', 'el estado del estudiante muestra que se está calificando')
  await hasta(() => resultados[s0.id]?.length)
  const esperaEnvio = Date.now() - t
  const pruebasPendientes = est.slice(1).filter(s => !resultados[s.id]?.length).length
  console.log(`  Envío con 19 "Probar" en cola: calificado en ${(esperaEnvio / 1000).toFixed(1)} s; quedaban ${pruebasPendientes} pruebas por ejecutar`)
  assert.ok(pruebasPendientes > 0, 'el envío no esperó a que terminaran todas las pruebas')
  await hasta(() => est.slice(1).every(s => resultados[s.id]?.length))

  // 2) El caso "pegado", con los temporizadores reales: E0 envía cuando a su reto le quedan ~2 s
  //    y hay 19 envíos más en la cola. El reto vence mientras espera; E0 pasa al siguiente.
  const g2 = crearGestorCompetencias({
    io, bancoPreguntas: [], bancoProblemas: problemas, adminToken: 'T', generarCodigo: () => 'CARG-0002',
    rutaGuardado, ejecutar, config: { enviosSimultaneos: 4, pruebasParalelas: 3, pausaResultadoMs: 50 }
  })
  const admin2 = socketFalso(); g2.registrarSocket(admin2)
  await llamar(admin2, 'admin:competencia:crear', { token: 'T', preguntaIds: [], problemaIds: ['P01', 'P02'], lenguajes: ['python'] })
  const est2 = []
  for (let i = 0; i < 20; i++) {
    const s = socketFalso(); g2.registrarSocket(s)
    await new Promise(r => g2.unirse(s, { nombre: 'E' + i, codigoEstudiante: 'e' + i, codigoSala: 'CARG-0002' }, r))
    est2.push(s)
  }
  await llamar(admin2, 'admin:competencia:iniciar', {})
  const comp2 = g2._competencias.get('CARG-0002')
  const P2 = (s) => comp2.participantes.find(p => p.socketId === s.id)
  const id2 = (s) => P2(s).orden[P2(s).actual]?.id
  await esperar(4000) // a cada reto (6 s) le quedan ~2 s
  for (const s of est2.slice(1)) llamar(s, 'estudiante:enviar', { problemaId: id2(s), lenguaje: 'python', codigo: 'x' })
  const e0 = est2[0]
  const retoViejo = id2(e0)
  t = Date.now()
  assert.ok((await llamar(e0, 'estudiante:enviar', { problemaId: retoViejo, lenguaje: 'python', codigo: 'x' })).ok)
  await hasta(() => id2(e0) !== retoViejo, 5000)
  console.log(`  [${((Date.now() - t) / 1000).toFixed(1)} s] el reto ${retoViejo} venció con el envío en la cola; E0 pasó a ${id2(e0)}`)
  assert.strictEqual(ultimo[e0.id].evaluando?.problemaId, retoViejo, 'su pantalla sabe que el envío viejo sigue en la cola')
  const mientras = await llamar(e0, 'estudiante:probar', { problemaId: id2(e0), lenguaje: 'python', codigo: 'x' })
  if (!mientras.ok) {
    assert.ok(/se está calificando tu envío del reto/.test(mientras.mensaje), 'mensaje claro: ' + mientras.mensaje)
    console.log(`  Mientras tanto le dice: "${mientras.mensaje}"`)
  }
  await hasta(() => (resultados[e0.id] || []).some(x => x.tipo === 'envio' && x.problemaId === retoViejo))
  const viejo = resultados[e0.id].find(x => x.tipo === 'envio' && x.problemaId === retoViejo)
  console.log(`  [${((Date.now() - t) / 1000).toFixed(1)} s] el envío del reto vencido se calificó igual (${viejo.envio.veredicto}) y le llegó el resultado`)
  assert.strictEqual(viejo.envio.veredicto, 'ACEPTADO')
  assert.strictEqual(ultimo[e0.id].evaluando, null, 'ya no queda nada "calificándose"')
  const nuevo = await llamar(e0, 'estudiante:enviar', { problemaId: id2(e0), lenguaje: 'python', codigo: 'x' })
  assert.ok(nuevo.ok, 'puede enviar de inmediato en el reto nuevo (antes: "Espera N s"): ' + nuevo.mensaje)
  console.log('  En el reto nuevo puede enviar de inmediato, sin "Espera N s"')
  await esperar(3000)
  console.log(`  Máximo de ejecuciones simultáneas contra el motor: ${maxSimultaneas} (límite: 4 envíos × 3 pruebas)`)
  assert.ok(maxSimultaneas <= 12)

  console.log('OK: la cola aguanta 20 estudiantes sin quedarse pegada')
  fs.rmSync(rutaGuardado, { force: true })
  process.exit(0)
})().catch(e => { console.error('FALLÓ:', e.message); fs.rmSync(rutaGuardado, { force: true }); process.exit(1) })
