// Competencia: el profesor elige preguntas (selección múltiple) y problemas de programación (Python o C++).
// Cada estudiante recibe TODOS los ítems mezclados en un orden aleatorio propio y avanza a su ritmo.
//
// Reglas:
//  - Cada ítem tiene su propio tiempo, definido en el banco (tiempo_segundos / tiempo_minutos).
//    Si falta, se usa el tiempo por defecto de su nivel.
//  - No se puede volver atrás ni saltar un ítem:
//      · Pregunta: al responder pasa a la siguiente. Si se acaba el tiempo, cuenta como no respondida.
//      · Problema: pasa al siguiente cuando lo resuelve (100 %), cuando agota sus intentos o cuando se acaba su tiempo.
//  - Pregunta correcta: puntos del banco + bonus de hasta +50 % por rapidez.
//  - Problema: puntos × (pruebas OCULTAS superadas / total de ocultas). Cuenta el mejor envío.
//    Los errores de compilación no gastan intentos.
//  - Al responder, el estudiante sabe al instante si acertó (la mascota Sammy lo celebra o lo lamenta),
//    pero NO cuál era la opción correcta: si se revelara en vivo, podría pasársela a otro compañero al que
//    todavía no le ha salido esa pregunta. Las respuestas correctas se revelan al terminar la competencia.
//  - Tras responder una pregunta o cerrar un reto hay una pausa corta (PAUSA_RESULTADO_MS) para mostrar
//    el resultado; el reloj del siguiente ítem empieza cuando termina esa pausa.
//  - Desempate: menor tiempo total (ver ranking.js).

const fs = require('fs')
const { ejecutar: ejecutarPiston, estadoMotor, LENGUAJES } = require('./ejecutor')
const { Cola } = require('./cola')
const { correrCasos, resumir } = require('./calificador')
const { calcularRanking } = require('./ranking')

const MAX_CODIGO = 20000 // caracteres
const HORAS_CONSERVAR_TERMINADOS = 24
const TIEMPO_PREGUNTA_S = { facil: 45, medio: 60, dificil: 90 }
const TIEMPO_PROBLEMA_MIN = { facil: 15, medio: 20, dificil: 30 }
const BONUS_POR_SEGUNDO = 0.1

function bonusTiempo(itemFin, momento){
  const segundosSobrantes = Math.max(0, Math.floor((itemFin - momento) / 1000))
  return Math.round(segundosSobrantes * BONUS_POR_SEGUNDO)
}
function texto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : ''
}
function mismoNombre(a, b) {
  return a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')
}
function entero(valor, min, max, porDefecto) {
  const n = parseInt(valor, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto
}
function sinCodigo(envio) {
  const { codigo, ...resto } = envio
  return resto
}
// Fisher–Yates: cada orden posible es igual de probable
function barajar(lista) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function crearGestorCompetencias({ io, bancoPreguntas, bancoProblemas, adminToken, generarCodigo, rutaGuardado, ejecutar = ejecutarPiston, config = {} }) {
  const cfg = {
    enviosSimultaneos: 4,
    pruebasParalelas: 3,
    esperaEnvioMs: 10000,
    esperaPruebaMs: 3000,
    pausaResultadoMs: 2000, // tiempo para ver la animación del resultado antes del siguiente ítem
    ...config
  }
  const competencias = new Map()
  const preguntasPorId = new Map(bancoPreguntas.map(q => [q.id, q]))
  const problemasPorId = new Map(bancoProblemas.map(p => [p.id, p]))
  const cola = new Cola(cfg.enviosSimultaneos)
  const temporizadores = new Map() // "CODIGO|codigoEstudiante" -> fin del ítem actual
  const avisosAdminPendientes = new Map()
  let temporizadorGuardado = null
  let contadorEnvios = 0

  const salaSocket = (codigo) => 'competencia:' + codigo
  const claveTemporizador = (comp, p) => comp.codigo + '|' + p.codigoEstudiante

  // ---------- Banco ----------

  const tiempoPreguntaS = (q) => q.tiempo_segundos || TIEMPO_PREGUNTA_S[q.nivel] || 60
  const tiempoProblemaMin = (p) => p.tiempo_minutos || TIEMPO_PROBLEMA_MIN[p.nivel] || 20

  function tiempoItemMs(item) {
    return item.tipo === 'pregunta'
      ? tiempoPreguntaS(preguntasPorId.get(item.id)) * 1000
      : tiempoProblemaMin(problemasPorId.get(item.id)) * 60000
  }

  // Pruebas que dan puntos: las ocultas (o los ejemplos, si el problema no tiene ocultas)
  function pruebasCalificadas(problema) {
    return (problema.pruebas_ocultas || []).length || (problema.ejemplos || []).length
  }

  function preguntaPublica(q) {
    return { id: q.id, nivel: q.nivel, tipo: q.tipo, puntos: q.puntos, enunciado: q.enunciado, opciones: q.opciones }
  }

  function problemaPublico(p) {
    return {
      id: p.id,
      titulo: p.titulo,
      nivel: p.nivel,
      puntos: p.puntos,
      tema: p.tema || '',
      enunciado: p.enunciado,
      formato_entrada: p.formato_entrada || '',
      formato_salida: p.formato_salida || '',
      limite_tiempo_ms: p.limite_tiempo_ms || 2000,
      tiempoMin: tiempoProblemaMin(p),
      plantilla: p.plantilla || {},
      ejemplos: p.ejemplos || [],
      totalPruebas: pruebasCalificadas(p)
    }
  }

  function estadoProblema(participante, problemaId) {
    if (!participante.problemas[problemaId]) {
      participante.problemas[problemaId] = {
        puntos: 0, pasadas: 0, total: pruebasCalificadas(problemasPorId.get(problemaId)),
        intentosFallidos: 0, envios: 0, aceptado: false, bloqueado: false, tiempoMs: 0, ultimoVeredicto: null
      }
    }
    return participante.problemas[problemaId]
  }

  // ---------- Vistas (lo que se envía a cada quien) ----------

  function itemActual(p) {
    return !p.terminado && p.actual >= 0 ? p.orden[p.actual] || null : null
  }

  function vistaItem(comp, p) {
    const item = itemActual(p)
    if (!item) return null
    const vista = { tipo: item.tipo, numero: p.actual + 1, inicio: p.itemInicio, fin: p.itemFin, duracionMs: p.itemFin - p.itemInicio }
    if (item.tipo === 'pregunta') {
      vista.pregunta = preguntaPublica(preguntasPorId.get(item.id))
    } else {
      vista.problema = problemaPublico(problemasPorId.get(item.id))
      vista.miEstado = estadoProblema(p, item.id)
      vista.misEnvios = comp.envios
        .filter(e => e.codigoEstudiante === p.codigoEstudiante && e.problemaId === item.id)
        .map(sinCodigo)
    }
    return vista
  }

  // Al final: cada ítem en el orden en que le salió, con la respuesta correcta de las preguntas
  function resumenFinal(p) {
    return p.orden.map(item => {
      if (item.tipo === 'pregunta') {
        const q = preguntasPorId.get(item.id)
        const r = p.respuestas[item.id] || {}
        return {
          tipo: 'pregunta', id: q.id, nivel: q.nivel, tipo_pregunta: q.tipo, enunciado: q.enunciado, opciones: q.opciones,
          respuestaCorrecta: q.respuesta_correcta, explicacion: q.explicacion || '', tema: q.tema || '',
          respuesta: r.respuesta ?? null, esCorrecta: !!r.esCorrecta, puntos: r.puntos || 0, maxPuntos: Math.round(q.puntos * (1 + BONUS_MAX))
        }
      }
      const prob = problemasPorId.get(item.id)
      const e = p.problemas[item.id]
      return {
        tipo: 'problema', id: prob.id, nivel: prob.nivel, titulo: prob.titulo, maxPuntos: prob.puntos,
        puntos: e?.puntos || 0, aceptado: !!e?.aceptado, envios: e?.envios || 0
      }
    })
  }

  function vistaEstudiante(comp, p) {
    const ranking = calcularRanking(comp)
    const yo = ranking.find(f => f.codigoEstudiante === p.codigoEstudiante)
    const terminada = comp.estado === 'terminado'
    return {
      codigo: comp.codigo,
      estado: comp.estado,
      ahora: Date.now(),
      intentosMax: comp.intentosMax,
      lenguajes: comp.lenguajes,
      esperaEnvioS: Math.round(cfg.esperaEnvioMs / 1000),
      nombre: p.nombre,
      codigoEstudiante: p.codigoEstudiante,
      totalPreguntas: comp.preguntaIds.length,
      totalProblemas: comp.problemaIds.length,
      totalItems: comp.preguntaIds.length + comp.problemaIds.length,
      terminoRecorrido: !!p.terminado,
      item: comp.estado === 'en-curso' ? vistaItem(comp, p) : null,
      misPuntos: yo ? yo.puntos : 0,
      miTiempoTotalMs: yo ? yo.tiempoTotalMs : 0,
      // El ranking y las respuestas correctas solo se revelan al final
      ranking: terminada ? ranking : null,
      miPosicion: terminada && yo ? yo.posicion : null,
      resumen: terminada ? resumenFinal(p) : null
    }
  }

  function vistaAdmin(comp) {
    return {
      codigo: comp.codigo,
      estado: comp.estado,
      inicio: comp.inicio,
      ahora: Date.now(),
      intentosMax: comp.intentosMax,
      lenguajes: comp.lenguajes,
      preguntas: comp.preguntaIds.map(id => preguntasPorId.get(id)).filter(Boolean)
        .map(q => ({ id: q.id, nivel: q.nivel, tipo: q.tipo, puntos: q.puntos, tiempoS: tiempoPreguntaS(q), enunciado: q.enunciado.slice(0, 140) })),
      problemas: comp.problemaIds.map(id => problemasPorId.get(id)).filter(Boolean)
        .map(p => ({ id: p.id, titulo: p.titulo, nivel: p.nivel, puntos: p.puntos, tiempoMin: tiempoProblemaMin(p), totalPruebas: pruebasCalificadas(p) })),
      totalItems: comp.preguntaIds.length + comp.problemaIds.length,
      ranking: calcularRanking(comp),
      enviosRecientes: comp.envios.slice(-30).reverse().map(sinCodigo),
      totalEnvios: comp.envios.length,
      cola: cola.estado()
    }
  }

  // ---------- Notificaciones ----------

  function enviarMiEstado(comp, p) {
    if (p.socketId) io.to(p.socketId).emit('competencia:mi-estado', vistaEstudiante(comp, p))
  }

  function enviarATodos(comp) {
    comp.participantes.forEach(p => enviarMiEstado(comp, p))
  }

  // Agrupa avisos al profesor (máx. ~4 por segundo) para no saturar su navegador
  function notificarAdmin(comp) {
    if (!comp.adminSocketId || avisosAdminPendientes.has(comp.codigo)) return
    avisosAdminPendientes.set(comp.codigo, setTimeout(() => {
      avisosAdminPendientes.delete(comp.codigo)
      if (comp.adminSocketId) io.to(comp.adminSocketId).emit('competencia:admin-estado', vistaAdmin(comp))
    }, 250))
  }

  // ---------- Guardado en disco (por si el servidor se reinicia a mitad de la competencia) ----------

  function serializar() {
    return {
      contadorEnvios,
      competencias: [...competencias.values()].map(c => ({
        ...c,
        adminSocketId: null,
        participantes: c.participantes.map(p => ({ ...p, socketId: null, conectado: false, evaluando: false }))
      }))
    }
  }

  function guardarYa() {
    if (!rutaGuardado) return
    try {
      const tmp = rutaGuardado + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(serializar()))
      fs.renameSync(tmp, rutaGuardado)
    } catch (e) {
      console.error('[Competencia] No se pudo guardar el estado:', e.message)
    }
  }

  function guardar() {
    if (!rutaGuardado || temporizadorGuardado) return
    temporizadorGuardado = setTimeout(() => {
      temporizadorGuardado = null
      guardarYa()
    }, 1000)
  }

  function cargar() {
    if (!rutaGuardado || !fs.existsSync(rutaGuardado)) return
    try {
      const datos = JSON.parse(fs.readFileSync(rutaGuardado, 'utf-8'))
      contadorEnvios = datos.contadorEnvios || 0
      const limite = Date.now() - HORAS_CONSERVAR_TERMINADOS * 3600 * 1000
      for (const c of datos.competencias || []) {
        if (c.estado === 'terminado' && (c.terminadoEn || 0) < limite) continue
        competencias.set(c.codigo, c)
        // Los ítems cuyo tiempo venció mientras el servidor estaba apagado avanzan de inmediato
        if (c.estado === 'en-curso') c.participantes.forEach(p => programarItem(c, p))
      }
      if (competencias.size) console.log(`[Competencia] Recuperadas ${competencias.size} competencia(s) guardadas`)
    } catch (e) {
      console.error('[Competencia] No se pudo leer el estado guardado:', e.message)
    }
  }

  // ---------- Recorrido de cada estudiante ----------

  function programarItem(comp, p) {
    const clave = claveTemporizador(comp, p)
    clearTimeout(temporizadores.get(clave))
    temporizadores.delete(clave)
    if (comp.estado !== 'en-curso' || !itemActual(p)) return
    const indice = p.actual
    temporizadores.set(clave, setTimeout(() => vencerItem(comp, p, indice), Math.max(0, p.itemFin - Date.now())))
  }

  // Se acabó el tiempo del ítem: una pregunta sin responder cuenta como no respondida
  function vencerItem(comp, p, indice) {
    if (comp.estado !== 'en-curso' || p.actual !== indice) return
    const item = itemActual(p)
    if (item?.tipo === 'pregunta' && !p.respuestas[item.id]) {
      p.respuestas[item.id] = { respuesta: null, esCorrecta: false, puntos: 0, puntosBase: 0, bonus: 0, ms: p.itemFin - p.itemInicio }
    }
    avanzar(comp, p)
  }

  function avanzar(comp, p) {
    p.actual++
    if (p.actual >= p.orden.length) {
      p.terminado = true
      p.terminadoEn = Date.now()
      p.itemInicio = null
      p.itemFin = null
    } else {
      p.itemInicio = Date.now()
      p.itemFin = p.itemInicio + tiempoItemMs(p.orden[p.actual])
    }
    programarItem(comp, p)
    enviarMiEstado(comp, p)
    notificarAdmin(comp)
    guardar()
    // Cuando todos terminan su recorrido, la competencia termina sola
    if (comp.participantes.every(x => x.terminado)) terminar(comp)
  }

  // Detiene el reloj del ítem actual y pasa al siguiente después de la pausa del resultado
  function avanzarTrasPausa(comp, p) {
    const indice = p.actual
    clearTimeout(temporizadores.get(claveTemporizador(comp, p)))
    setTimeout(() => {
      if (comp.estado === 'en-curso' && p.actual === indice) avanzar(comp, p)
    }, cfg.pausaResultadoMs)
  }

  function empezarRecorrido(comp, p) {
    p.orden = barajar([
      ...comp.preguntaIds.map(id => ({ tipo: 'pregunta', id })),
      ...comp.problemaIds.map(id => ({ tipo: 'problema', id }))
    ])
    p.actual = -1
    avanzar(comp, p)
  }

  function terminar(comp) {
    if (comp.estado === 'terminado') return
    comp.estado = 'terminado'
    comp.terminadoEn = Date.now()
    comp.participantes.forEach(p => programarItem(comp, p)) // cancela los temporizadores
    console.log(`[Competencia ${comp.codigo}] Terminada`)
    enviarATodos(comp)
    notificarAdmin(comp)
    guardar()
  }

  // ---------- Contextos de socket ----------

  function competenciaDelAdmin(socket) {
    const comp = competencias.get(socket.data.competenciaAdmin)
    return comp && comp.adminSocketId === socket.id ? comp : null
  }

  function contextoEstudiante(socket) {
    if (socket.data.rol !== 'estudiante') return null
    const comp = competencias.get(socket.data.codigoSala)
    if (!comp) return null
    const p = comp.participantes.find(x => x.codigoEstudiante === socket.data.codigoEstudiante)
    // Si el estudiante abrió otra pestaña, solo la más reciente puede actuar
    if (!p || p.socketId !== socket.id) return null
    return { comp, p }
  }

  function tomarAdmin(socket, comp) {
    comp.adminSocketId = socket.id
    socket.data.competenciaAdmin = comp.codigo
    socket.data.rol = 'admin'
    socket.join(salaSocket(comp.codigo))
  }

  // Solo se puede probar o enviar el problema que el estudiante tiene abierto, y antes de que venza
  function validarCodigoEnvio(comp, p, datos) {
    const item = itemActual(p)
    const problemaId = texto(datos?.problemaId, 20)
    const lenguaje = texto(datos?.lenguaje, 10)
    const codigo = typeof datos?.codigo === 'string' ? datos.codigo : ''
    if (comp.estado !== 'en-curso') return { error: 'La competencia no está en curso.' }
    if (!item || item.tipo !== 'problema' || item.id !== problemaId) return { error: 'Ese problema ya no está activo.' }
    if (Date.now() >= p.itemFin) return { error: 'Se acabó el tiempo de este problema.' }
    if (!comp.lenguajes.includes(lenguaje) || !LENGUAJES[lenguaje]) return { error: 'Lenguaje no permitido en esta competencia.' }
    if (!codigo.trim()) return { error: 'Escribe tu código antes de ejecutarlo.' }
    if (codigo.length > MAX_CODIGO) return { error: `El código es demasiado largo (máx. ${MAX_CODIGO} caracteres).` }
    return { problema: problemasPorId.get(problemaId), problemaId, lenguaje, codigo }
  }

  // ---------- API pública del módulo ----------

  function existe(codigo) {
    return typeof codigo === 'string' && competencias.has(codigo)
  }

  // Para el panel del profesor (incluye las respuestas correctas de las preguntas)
  function bancoAdmin() {
    return {
      preguntas: bancoPreguntas.map(q => ({ ...q, tiempoS: tiempoPreguntaS(q) })),
      problemas: bancoProblemas.map(p => ({ ...problemaPublico(p), pruebasOcultas: (p.pruebas_ocultas || []).length }))
    }
  }

  // Un estudiante entra (o vuelve a entrar) a una competencia con el código de sala
  function unirse(socket, datos, callback = () => {}) {
    const nombre = texto(datos?.nombre, 60)
    const codigoEstudiante = texto(datos?.codigoEstudiante, 30)
    const codigoSala = texto(datos?.codigoSala, 20).toUpperCase()
    if (!nombre || !codigoEstudiante) return callback({ ok: false, mensaje: 'Nombre y código de estudiante son obligatorios.' })

    const comp = competencias.get(codigoSala)
    if (!comp) return callback({ ok: false, mensaje: 'Sala no encontrada. Verifica el código.' })

    let p = comp.participantes.find(x => x.codigoEstudiante === codigoEstudiante)
    if (p) {
      if (!mismoNombre(p.nombre, nombre)) {
        return callback({ ok: false, mensaje: 'Ese código de estudiante ya está en la competencia con otro nombre.' })
      }
      if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('competencia:sesion-reemplazada')
    } else {
      if (comp.estado === 'terminado') return callback({ ok: false, mensaje: 'Esta competencia ya terminó.' })
      p = {
        nombre, codigoEstudiante, socketId: null, conectado: false, salidasPestana: 0,
        orden: [], actual: -1, itemInicio: null, itemFin: null, terminado: false, terminadoEn: null,
        respuestas: {}, problemas: {}, ultimoEnvioTs: 0, ultimaPruebaTs: 0, evaluando: false
      }
      comp.participantes.push(p)
      console.log(`[Competencia ${comp.codigo}] Estudiante unido: ${nombre} (${codigoEstudiante})`)
    }

    p.socketId = socket.id
    p.conectado = true
    socket.join(salaSocket(comp.codigo))
    socket.data.rol = 'estudiante'
    socket.data.codigoSala = comp.codigo
    socket.data.codigoEstudiante = codigoEstudiante

    // Si llega tarde, empieza su recorrido ya (con su propio reloj)
    if (comp.estado === 'en-curso' && p.orden.length === 0) empezarRecorrido(comp, p)

    callback({ ok: true, nombre: p.nombre, codigoSala: comp.codigo, competencia: vistaEstudiante(comp, p) })
    notificarAdmin(comp)
    guardar()
  }

  function registrarSocket(socket) {
    // ----- Profesor -----
    socket.on('admin:competencia:crear', (datos, cb = () => {}) => {
      if (datos?.token !== adminToken) return cb({ ok: false, mensaje: 'No autorizado' })
      const unicos = (lista, mapa) => (Array.isArray(lista) ? lista : []).filter((id, i, arr) => mapa.has(id) && arr.indexOf(id) === i)
      const preguntaIds = unicos(datos.preguntaIds, preguntasPorId)
      const problemaIds = unicos(datos.problemaIds, problemasPorId)
      if (preguntaIds.length + problemaIds.length === 0) return cb({ ok: false, mensaje: 'Selecciona al menos una pregunta o un problema.' })
      const lenguajes = (Array.isArray(datos.lenguajes) ? datos.lenguajes : Object.keys(LENGUAJES)).filter(l => LENGUAJES[l])
      if (problemaIds.length > 0 && lenguajes.length === 0) return cb({ ok: false, mensaje: 'Selecciona al menos un lenguaje.' })

      const comp = {
        codigo: generarCodigo(),
        estado: 'esperando',
        creadoEn: Date.now(),
        adminSocketId: null,
        preguntaIds,
        problemaIds,
        lenguajes,
        intentosMax: entero(datos.intentosMax, 0, 20, 3),
        inicio: null,
        terminadoEn: null,
        participantes: [],
        envios: []
      }
      competencias.set(comp.codigo, comp)
      tomarAdmin(socket, comp)
      console.log(`[Competencia ${comp.codigo}] Creada (${preguntaIds.length} preguntas, ${problemaIds.length} problemas)`)
      cb({ ok: true, codigo: comp.codigo, competencia: vistaAdmin(comp) })
      guardar()
    })

    socket.on('admin:competencia:reconectar', (datos, cb = () => {}) => {
      if (datos?.token !== adminToken) return cb({ ok: false, mensaje: 'No autorizado' })
      const comp = competencias.get(datos?.codigo)
      if (!comp) return cb({ ok: false, mensaje: 'La competencia ya no existe.' })
      tomarAdmin(socket, comp)
      cb({ ok: true, competencia: vistaAdmin(comp) })
    })

    socket.on('admin:competencia:iniciar', (_datos, cb = () => {}) => {
      const comp = competenciaDelAdmin(socket)
      if (!comp || comp.estado !== 'esperando') return cb({ ok: false, mensaje: 'La competencia no se puede iniciar.' })
      if (comp.participantes.length === 0) return cb({ ok: false, mensaje: 'Aún no hay estudiantes.' })
      comp.estado = 'en-curso'
      comp.inicio = Date.now()
      console.log(`[Competencia ${comp.codigo}] Iniciada`)
      comp.participantes.forEach(p => empezarRecorrido(comp, p))
      notificarAdmin(comp)
      guardar()
      cb({ ok: true })
    })

    socket.on('admin:competencia:terminar', (_datos, cb = () => {}) => {
      const comp = competenciaDelAdmin(socket)
      if (!comp) return cb({ ok: false })
      terminar(comp)
      cb({ ok: true })
    })

    socket.on('admin:competencia:exportar', (_datos, cb = () => {}) => {
      const comp = competenciaDelAdmin(socket)
      if (!comp) return cb({ ok: false })
      cb({
        ok: true,
        ranking: calcularRanking(comp),
        envios: comp.envios,
        preguntas: comp.preguntaIds.map(id => preguntasPorId.get(id)),
        problemas: vistaAdmin(comp).problemas,
        respuestas: comp.participantes.map(p => ({ nombre: p.nombre, codigoEstudiante: p.codigoEstudiante, respuestas: p.respuestas }))
      })
    })

    // ----- Estudiante -----
    socket.on('estudiante:responder', (datos, cb = () => {}) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx) return cb({ ok: false, mensaje: 'Tu sesión no está activa. Recarga la página.' })
      const { comp, p } = ctx
      const item = itemActual(p)
      if (comp.estado !== 'en-curso' || !item || item.tipo !== 'pregunta' || item.id !== datos?.preguntaId) {
        return cb({ ok: false, mensaje: 'Esa pregunta ya no está activa.' })
      }
      const ahora = Date.now()
      if (ahora >= p.itemFin) return cb({ ok: false, mensaje: 'Se acabó el tiempo de esta pregunta.' })
      const q = preguntasPorId.get(item.id)
      if (p.respuestas[q.id]) return cb({ ok: false, mensaje: 'Ya respondiste esta pregunta.' })
      const respuesta = datos?.respuesta
      if (!Number.isInteger(respuesta) || respuesta < 0 || respuesta >= q.opciones.length) {
        return cb({ ok: false, mensaje: 'Respuesta inválida.' })
      }

      // Bonus por tiempo sobrante: segundos que le quedaban × 0,1
      const ms = ahora - p.itemInicio
      const esCorrecta = respuesta === q.respuesta_correcta
      const puntosBase = esCorrecta ? q.puntos : 0
      const bonus = esCorrecta ? bonusTiempo(p.itemFin, ahora) : 0
      p.respuestas[q.id] = { respuesta, esCorrecta, puntos: puntosBase + bonus, puntosBase, bonus, ms }

      // Dice si acertó, pero no cuál era la correcta (eso se revela al final)
      cb({ ok: true, esCorrecta, puntos: puntosBase + bonus, puntosBase, bonus })
      avanzarTrasPausa(comp, p)
      notificarAdmin(comp)
      guardar()
    })

    socket.on('estudiante:probar', async (datos, cb = () => {}) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx) return cb({ ok: false, mensaje: 'Tu sesión no está activa. Recarga la página.' })
      const { comp, p } = ctx
      const v = validarCodigoEnvio(comp, p, datos)
      if (v.error) return cb({ ok: false, mensaje: v.error })
      const espera = cfg.esperaPruebaMs - (Date.now() - p.ultimaPruebaTs)
      if (espera > 0) return cb({ ok: false, mensaje: `Espera ${Math.ceil(espera / 1000)} s antes de volver a probar.` })
      p.ultimaPruebaTs = Date.now()

      const personalizada = typeof datos?.entradaPersonalizada === 'string'
      const casos = personalizada
        ? [{ entrada: datos.entradaPersonalizada.slice(0, 5000), salida: null }]
        : v.problema.ejemplos
      try {
        const evaluacion = await cola.agregar(
          () => correrCasos({ ejecutar, lenguaje: v.lenguaje, codigo: v.codigo, casos, limiteMs: v.problema.limite_tiempo_ms || 2000, paralelas: cfg.pruebasParalelas }),
          (posicion) => io.to(socket.id).emit('competencia:cola', { tipo: 'prueba', posicion })
        )
        if (evaluacion.internoError) return cb({ ok: false, mensaje: 'El motor de ejecución falló: ' + evaluacion.internoError })
        cb({
          ok: true,
          personalizada,
          compilacion: evaluacion.compilacion,
          casos: evaluacion.casos.map((c, i) => ({
            entrada: casos[i].entrada,
            esperada: personalizada ? null : casos[i].salida,
            obtenida: c.salida,
            ok: personalizada ? null : c.ok,
            estado: c.estado,
            error: c.error,
            ms: c.ms
          }))
        })
      } catch (e) {
        cb({ ok: false, mensaje: 'Error al ejecutar: ' + e.message })
      }
    })

    socket.on('estudiante:enviar', async (datos, cb = () => {}) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx) return cb({ ok: false, mensaje: 'Tu sesión no está activa. Recarga la página.' })
      const { comp, p } = ctx
      const v = validarCodigoEnvio(comp, p, datos)
      if (v.error) return cb({ ok: false, mensaje: v.error })

      const e = estadoProblema(p, v.problemaId)
      if (e.aceptado) return cb({ ok: false, mensaje: 'Ya resolviste este problema por completo.' })
      if (e.bloqueado) return cb({ ok: false, mensaje: 'Agotaste tus intentos en este problema.' })
      if (p.evaluando) return cb({ ok: false, mensaje: 'Ya tienes un envío en evaluación. Espera el resultado.' })
      const espera = cfg.esperaEnvioMs - (Date.now() - p.ultimoEnvioTs)
      if (espera > 0) return cb({ ok: false, mensaje: `Espera ${Math.ceil(espera / 1000)} s antes de volver a enviar.` })

      // Un envío hecho a tiempo se califica aunque el tiempo del problema venza mientras se evalúa
      const tsEnvio = Date.now()
      const indiceItem = p.actual
      const tiempoMs = tsEnvio - p.itemInicio
      p.evaluando = true
      p.ultimoEnvioTs = tsEnvio
      const ejemplos = v.problema.ejemplos || []
      const casos = [...ejemplos, ...(v.problema.pruebas_ocultas || [])]
      try {
        const evaluacion = await cola.agregar(
          () => correrCasos({ ejecutar, lenguaje: v.lenguaje, codigo: v.codigo, casos, limiteMs: v.problema.limite_tiempo_ms || 2000, paralelas: cfg.pruebasParalelas }),
          (posicion) => { if (p.socketId) io.to(p.socketId).emit('competencia:cola', { tipo: 'envio', posicion }) }
        )
        const r = resumir(evaluacion, casos.length, ejemplos.length)

        if (r.veredicto === 'INTERNO') {
          p.ultimoEnvioTs = 0 // no fue culpa del estudiante: puede reintentar de inmediato
          return cb({ ok: false, mensaje: 'El motor de ejecución falló y tu envío NO se contó. Intenta de nuevo. (' + r.mensaje + ')' })
        }

        const puntosBase = r.total ? Math.round(v.problema.puntos * (r.pasadas / r.total)) : 0
        // Garantizamos que el bonus se de solo si el estudainte hizo y terino el punbto correctamente
        const bonus = r.veredicto === 'ACEPTADO' ? bonusTiempo(p.itemFin, tsEnvio) : 0
        const puntos = puntosBase + bonus
        e.envios++
        if (r.veredicto !== 'ACEPTADO' && r.veredicto !== 'COMPILACION') e.intentosFallidos++
        if (puntos > e.puntos) {
          e.puntos = puntos
          e.pasadas = r.pasadas
          e.tiempoMs = tiempoMs
        }
        if (r.veredicto === 'ACEPTADO') e.aceptado = true
        if (!e.aceptado && comp.intentosMax > 0 && e.intentosFallidos >= comp.intentosMax) e.bloqueado = true
        e.ultimoVeredicto = r.veredicto

        const envio = {
          id: ++contadorEnvios,
          codigoEstudiante: p.codigoEstudiante,
          nombre: p.nombre,
          problemaId: v.problemaId,
          lenguaje: v.lenguaje,
          ts: tsEnvio,
          tiempoMs,
          veredicto: r.veredicto,
          pasadas: r.pasadas,
          total: r.total,
          puntos,
          mensaje: (r.mensaje || '').slice(0, 1500),
          codigo: v.codigo
        }
        comp.envios.push(envio)
        console.log(`[Competencia ${comp.codigo}] ${p.nombre} · ${v.problemaId} · ${r.veredicto} ${r.pasadas}/${r.total}`)

        cb({ ok: true, envio: sinCodigo(envio), intentosFallidos: e.intentosFallidos, bloqueado: e.bloqueado, mejorPuntaje: e.puntos })
        // Resuelto o sin intentos: pasa al siguiente ítem (si no avanzó ya por tiempo)
        if ((e.aceptado || e.bloqueado) && comp.estado === 'en-curso' && p.actual === indiceItem) avanzarTrasPausa(comp, p)
        enviarMiEstado(comp, p)
        notificarAdmin(comp)
        guardar()
      } catch (err) {
        cb({ ok: false, mensaje: 'Error al evaluar: ' + err.message })
      } finally {
        p.evaluando = false
      }
    })

    // Registro de cambios de pestaña (informativo para el profesor)
    socket.on('estudiante:foco', (datos) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx || ctx.comp.estado !== 'en-curso' || datos?.visible !== false) return
      ctx.p.salidasPestana = (ctx.p.salidasPestana || 0) + 1
      notificarAdmin(ctx.comp)
    })

    socket.on('disconnect', () => {
      if (socket.data.rol === 'estudiante') {
        const comp = competencias.get(socket.data.codigoSala)
        const p = comp?.participantes.find(x => x.codigoEstudiante === socket.data.codigoEstudiante)
        if (p && p.socketId === socket.id) {
          p.conectado = false
          notificarAdmin(comp)
        }
      } else if (socket.data.rol === 'admin') {
        const comp = competencias.get(socket.data.competenciaAdmin)
        if (comp && comp.adminSocketId === socket.id) comp.adminSocketId = null
      }
    })
  }

  cargar()

  return {
    existe,
    unirse,
    registrarSocket,
    bancoAdmin,
    estadoMotor,
    guardarYa,
    _competencias: competencias // solo para pruebas
  }
}

module.exports = { crearGestorCompetencias }
