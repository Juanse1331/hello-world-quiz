// Modo reto de programación: los estudiantes resuelven problemas en Python o C++
// y el servidor califica su código con pruebas ocultas.
//
// Reglas:
//  - Puntaje parcial: puntos del problema × (pruebas superadas / total de pruebas). Cuenta el mejor envío.
//  - Intentos: cada envío que no sea 100 % correcto gasta un intento (los errores de compilación no gastan).
//    Al agotar los intentos (por defecto 3) el problema se bloquea para ese estudiante.
//  - Desempate: menor tiempo total (ver ranking.js).
//  - La duración la define el profesor (por defecto 30 min) y puede agregar tiempo durante el reto.

const fs = require('fs')
const path = require('path')
const { ejecutar: ejecutarPiston, estadoMotor, LENGUAJES } = require('./ejecutor')
const { Cola } = require('./cola')
const { correrCasos, resumir } = require('./calificador')
const { calcularRanking } = require('./ranking')

const MAX_CODIGO = 20000 // caracteres
const HORAS_CONSERVAR_TERMINADOS = 24

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

function crearGestorRetos({ io, bancoProblemas, adminToken, generarCodigo, rutaGuardado, ejecutar = ejecutarPiston, config = {} }) {
  const cfg = {
    enviosSimultaneos: 4,
    pruebasParalelas: 3,
    esperaEnvioMs: 10000,
    esperaPruebaMs: 3000,
    ...config
  }
  const retos = new Map()
  const problemasPorId = new Map(bancoProblemas.map(p => [p.id, p]))
  const cola = new Cola(cfg.enviosSimultaneos)
  const temporizadoresFin = new Map()
  const avisosAdminPendientes = new Map()
  let temporizadorGuardado = null
  let contadorEnvios = 0

  const salaSocket = (codigo) => 'reto:' + codigo

  // ---------- Vistas (lo que se envía a cada quien) ----------

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
      plantilla: p.plantilla || {},
      ejemplos: p.ejemplos || [],
      totalPruebas: (p.ejemplos || []).length + (p.pruebas_ocultas || []).length
    }
  }

  function totalCasos(problema) {
    return (problema.ejemplos || []).length + (problema.pruebas_ocultas || []).length
  }

  function estadoProblema(participante, problemaId) {
    if (!participante.problemas[problemaId]) {
      participante.problemas[problemaId] = {
        puntos: 0, pasadas: 0, total: totalCasos(problemasPorId.get(problemaId)),
        intentosFallidos: 0, envios: 0, aceptado: false, bloqueado: false, tiempoMs: 0, ultimoVeredicto: null
      }
    }
    return participante.problemas[problemaId]
  }

  function vistaEstudiante(reto, p) {
    const problemas = reto.estado === 'esperando'
      ? []
      : reto.problemaIds.map(id => problemasPorId.get(id)).filter(Boolean).map(problemaPublico)
    const miEstado = {}
    reto.problemaIds.forEach(id => { miEstado[id] = estadoProblema(p, id) })
    const ranking = calcularRanking(reto)
    const yo = ranking.find(f => f.codigoEstudiante === p.codigoEstudiante)
    return {
      codigo: reto.codigo,
      estado: reto.estado,
      inicio: reto.inicio,
      fin: reto.fin,
      ahora: Date.now(),
      duracionMs: reto.duracionMs,
      intentosMax: reto.intentosMax,
      lenguajes: reto.lenguajes,
      esperaEnvioS: Math.round(cfg.esperaEnvioMs / 1000),
      nombre: p.nombre,
      codigoEstudiante: p.codigoEstudiante,
      problemas,
      miEstado,
      misPuntos: yo ? yo.puntos : 0,
      miTiempoTotalMs: yo ? yo.tiempoTotalMs : 0,
      misEnvios: reto.envios.filter(e => e.codigoEstudiante === p.codigoEstudiante).slice(-50).map(sinCodigo),
      // El ranking solo se revela al final
      ranking: reto.estado === 'terminado' ? ranking : null,
      miPosicion: reto.estado === 'terminado' && yo ? yo.posicion : null
    }
  }

  function vistaAdmin(reto) {
    return {
      codigo: reto.codigo,
      estado: reto.estado,
      inicio: reto.inicio,
      fin: reto.fin,
      ahora: Date.now(),
      duracionMs: reto.duracionMs,
      intentosMax: reto.intentosMax,
      lenguajes: reto.lenguajes,
      problemas: reto.problemaIds.map(id => problemasPorId.get(id)).filter(Boolean)
        .map(p => ({ id: p.id, titulo: p.titulo, nivel: p.nivel, puntos: p.puntos, totalPruebas: totalCasos(p) })),
      ranking: calcularRanking(reto),
      enviosRecientes: reto.envios.slice(-30).reverse().map(sinCodigo),
      totalEnvios: reto.envios.length,
      cola: cola.estado()
    }
  }

  // ---------- Notificaciones ----------

  function emitirEstado(reto) {
    io.to(salaSocket(reto.codigo)).emit('reto:estado', {
      estado: reto.estado, inicio: reto.inicio, fin: reto.fin, ahora: Date.now()
    })
  }

  function enviarMiEstado(reto, p) {
    if (p.socketId) io.to(p.socketId).emit('reto:mi-estado', vistaEstudiante(reto, p))
  }

  function enviarATodos(reto) {
    reto.participantes.forEach(p => enviarMiEstado(reto, p))
  }

  // Agrupa avisos al profesor (máx. ~4 por segundo) para no saturar su navegador
  function notificarAdmin(reto) {
    if (!reto.adminSocketId || avisosAdminPendientes.has(reto.codigo)) return
    avisosAdminPendientes.set(reto.codigo, setTimeout(() => {
      avisosAdminPendientes.delete(reto.codigo)
      if (reto.adminSocketId) io.to(reto.adminSocketId).emit('reto:admin-estado', vistaAdmin(reto))
    }, 250))
  }

  // ---------- Guardado en disco (por si el servidor se reinicia a mitad del reto) ----------

  function serializar() {
    return {
      contadorEnvios,
      retos: [...retos.values()].map(r => ({
        ...r,
        adminSocketId: null,
        participantes: r.participantes.map(p => ({ ...p, socketId: null, conectado: false, evaluando: false }))
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
      console.error('[Retos] No se pudo guardar el estado:', e.message)
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
      for (const r of datos.retos || []) {
        if (r.estado === 'terminado' && (r.terminadoEn || 0) < limite) continue
        retos.set(r.codigo, r)
        if (r.estado === 'en-curso') {
          if (Date.now() >= r.fin) terminar(r)
          else programarFin(r)
        }
      }
      if (retos.size) console.log(`[Retos] Recuperados ${retos.size} reto(s) guardados`)
    } catch (e) {
      console.error('[Retos] No se pudo leer el estado guardado:', e.message)
    }
  }

  // ---------- Ciclo de vida del reto ----------

  function programarFin(reto) {
    clearTimeout(temporizadoresFin.get(reto.codigo))
    const restante = Math.max(0, reto.fin - Date.now())
    temporizadoresFin.set(reto.codigo, setTimeout(() => terminar(reto), restante))
  }

  function terminar(reto) {
    if (reto.estado === 'terminado') return
    clearTimeout(temporizadoresFin.get(reto.codigo))
    temporizadoresFin.delete(reto.codigo)
    reto.estado = 'terminado'
    reto.terminadoEn = Date.now()
    console.log(`[Reto ${reto.codigo}] Terminado`)
    emitirEstado(reto)
    enviarATodos(reto)
    notificarAdmin(reto)
    guardar()
  }

  // ---------- Contextos de socket ----------

  function retoDelAdmin(socket) {
    const reto = retos.get(socket.data.retoAdmin)
    return reto && reto.adminSocketId === socket.id ? reto : null
  }

  function contextoEstudiante(socket) {
    if (socket.data.rol !== 'estudiante-reto') return null
    const reto = retos.get(socket.data.codigoSala)
    if (!reto) return null
    const p = reto.participantes.find(x => x.codigoEstudiante === socket.data.codigoEstudiante)
    // Si el estudiante abrió otra pestaña, solo la más reciente puede actuar
    if (!p || p.socketId !== socket.id) return null
    return { reto, p }
  }

  function tomarAdmin(socket, reto) {
    reto.adminSocketId = socket.id
    socket.data.retoAdmin = reto.codigo
    socket.data.rol = 'admin-reto'
    socket.join(salaSocket(reto.codigo))
  }

  function validarCodigoEnvio(reto, datos) {
    const problemaId = texto(datos?.problemaId, 20)
    const lenguaje = texto(datos?.lenguaje, 10)
    const codigo = typeof datos?.codigo === 'string' ? datos.codigo : ''
    const problema = problemasPorId.get(problemaId)
    if (!problema || !reto.problemaIds.includes(problemaId)) return { error: 'Problema no válido.' }
    if (!reto.lenguajes.includes(lenguaje) || !LENGUAJES[lenguaje]) return { error: 'Lenguaje no permitido en este reto.' }
    if (!codigo.trim()) return { error: 'Escribe tu código antes de ejecutarlo.' }
    if (codigo.length > MAX_CODIGO) return { error: `El código es demasiado largo (máx. ${MAX_CODIGO} caracteres).` }
    return { problema, problemaId, lenguaje, codigo }
  }

  // ---------- API pública del módulo ----------

  function existe(codigo) {
    return typeof codigo === 'string' && retos.has(codigo)
  }

  function listarProblemasAdmin() {
    return bancoProblemas.map(p => ({
      ...problemaPublico(p),
      pruebasOcultas: (p.pruebas_ocultas || []).length
    }))
  }

  // Un estudiante entra (o vuelve a entrar) a un reto con el código de sala
  function unirse(socket, datos, callback = () => {}) {
    const nombre = texto(datos?.nombre, 60)
    const codigoEstudiante = texto(datos?.codigoEstudiante, 30)
    const codigoSala = texto(datos?.codigoSala, 20)
    if (!nombre || !codigoEstudiante) return callback({ ok: false, mensaje: 'Nombre y código de estudiante son obligatorios.' })

    const reto = retos.get(codigoSala)
    if (!reto) return callback({ ok: false, mensaje: 'Sala no encontrada. Verifica el código.' })

    let p = reto.participantes.find(x => x.codigoEstudiante === codigoEstudiante)
    if (p) {
      if (!mismoNombre(p.nombre, nombre)) {
        return callback({ ok: false, mensaje: 'Ese código de estudiante ya está en el reto con otro nombre.' })
      }
      if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('reto:sesion-reemplazada')
    } else {
      if (reto.estado === 'terminado') return callback({ ok: false, mensaje: 'Este reto ya terminó.' })
      p = {
        nombre, codigoEstudiante, socketId: null, conectado: false, salidasPestana: 0,
        problemas: {}, ultimoEnvioTs: 0, ultimaPruebaTs: 0, evaluando: false
      }
      reto.participantes.push(p)
      console.log(`[Reto ${reto.codigo}] Estudiante unido: ${nombre} (${codigoEstudiante})`)
    }

    p.socketId = socket.id
    p.conectado = true
    socket.join(salaSocket(reto.codigo))
    socket.data.rol = 'estudiante-reto'
    socket.data.codigoSala = reto.codigo
    socket.data.codigoEstudiante = codigoEstudiante

    callback({ ok: true, modo: 'reto', nombre: p.nombre, codigoSala: reto.codigo, reto: vistaEstudiante(reto, p) })
    notificarAdmin(reto)
    guardar()
  }

  function registrarSocket(socket) {
    // ----- Profesor -----
    socket.on('admin:reto:crear', (datos, cb = () => {}) => {
      if (datos?.token !== adminToken) return cb({ ok: false, mensaje: 'No autorizado' })
      const problemaIds = (Array.isArray(datos.problemaIds) ? datos.problemaIds : [])
        .filter((id, i, arr) => problemasPorId.has(id) && arr.indexOf(id) === i)
      if (problemaIds.length === 0) return cb({ ok: false, mensaje: 'Selecciona al menos un problema.' })
      const lenguajes = (Array.isArray(datos.lenguajes) ? datos.lenguajes : Object.keys(LENGUAJES))
        .filter(l => LENGUAJES[l])
      if (lenguajes.length === 0) return cb({ ok: false, mensaje: 'Selecciona al menos un lenguaje.' })

      const reto = {
        codigo: generarCodigo(),
        tipo: 'reto',
        estado: 'esperando',
        creadoEn: Date.now(),
        adminSocketId: null,
        problemaIds,
        lenguajes,
        duracionMs: entero(datos.duracionMin, 5, 300, 30) * 60000,
        intentosMax: entero(datos.intentosMax, 0, 20, 3),
        inicio: null,
        fin: null,
        terminadoEn: null,
        participantes: [],
        envios: []
      }
      retos.set(reto.codigo, reto)
      tomarAdmin(socket, reto)
      console.log(`[Reto ${reto.codigo}] Creado (${problemaIds.length} problemas, ${reto.duracionMs / 60000} min)`)
      cb({ ok: true, codigo: reto.codigo, reto: vistaAdmin(reto) })
      guardar()
    })

    socket.on('admin:reto:reconectar', (datos, cb = () => {}) => {
      if (datos?.token !== adminToken) return cb({ ok: false, mensaje: 'No autorizado' })
      const reto = retos.get(datos?.codigo)
      if (!reto) return cb({ ok: false, mensaje: 'El reto ya no existe.' })
      tomarAdmin(socket, reto)
      cb({ ok: true, reto: vistaAdmin(reto) })
    })

    socket.on('admin:reto:iniciar', (_datos, cb = () => {}) => {
      const reto = retoDelAdmin(socket)
      if (!reto || reto.estado !== 'esperando') return cb({ ok: false, mensaje: 'El reto no se puede iniciar.' })
      reto.estado = 'en-curso'
      reto.inicio = Date.now()
      reto.fin = reto.inicio + reto.duracionMs
      programarFin(reto)
      console.log(`[Reto ${reto.codigo}] Iniciado`)
      emitirEstado(reto)
      enviarATodos(reto)
      notificarAdmin(reto)
      guardar()
      cb({ ok: true })
    })

    socket.on('admin:reto:agregar-tiempo', (datos, cb = () => {}) => {
      const reto = retoDelAdmin(socket)
      if (!reto || reto.estado !== 'en-curso') return cb({ ok: false, mensaje: 'El reto no está en curso.' })
      const minutos = entero(datos?.minutos, 1, 120, 5)
      reto.fin += minutos * 60000
      reto.duracionMs += minutos * 60000
      programarFin(reto)
      emitirEstado(reto)
      notificarAdmin(reto)
      guardar()
      cb({ ok: true })
    })

    socket.on('admin:reto:terminar', (_datos, cb = () => {}) => {
      const reto = retoDelAdmin(socket)
      if (!reto) return cb({ ok: false })
      terminar(reto)
      cb({ ok: true })
    })

    socket.on('admin:reto:exportar', (_datos, cb = () => {}) => {
      const reto = retoDelAdmin(socket)
      if (!reto) return cb({ ok: false })
      cb({ ok: true, ranking: calcularRanking(reto), envios: reto.envios, problemas: vistaAdmin(reto).problemas })
    })

    // ----- Estudiante -----
    socket.on('estudiante:reto:probar', async (datos, cb = () => {}) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx) return cb({ ok: false, mensaje: 'Tu sesión no está activa. Recarga la página.' })
      const { reto, p } = ctx
      if (reto.estado !== 'en-curso') return cb({ ok: false, mensaje: 'El reto no está en curso.' })
      const v = validarCodigoEnvio(reto, datos)
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
          (posicion) => io.to(socket.id).emit('reto:cola', { tipo: 'prueba', posicion })
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

    socket.on('estudiante:reto:enviar', async (datos, cb = () => {}) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx) return cb({ ok: false, mensaje: 'Tu sesión no está activa. Recarga la página.' })
      const { reto, p } = ctx
      if (reto.estado !== 'en-curso' || Date.now() >= reto.fin) return cb({ ok: false, mensaje: 'El reto no está en curso.' })
      const v = validarCodigoEnvio(reto, datos)
      if (v.error) return cb({ ok: false, mensaje: v.error })

      const e = estadoProblema(p, v.problemaId)
      if (e.aceptado) return cb({ ok: false, mensaje: 'Ya resolviste este problema por completo.' })
      if (e.bloqueado) return cb({ ok: false, mensaje: 'Agotaste tus intentos en este problema.' })
      if (p.evaluando) return cb({ ok: false, mensaje: 'Ya tienes un envío en evaluación. Espera el resultado.' })
      const espera = cfg.esperaEnvioMs - (Date.now() - p.ultimoEnvioTs)
      if (espera > 0) return cb({ ok: false, mensaje: `Espera ${Math.ceil(espera / 1000)} s antes de volver a enviar.` })

      const tsEnvio = Date.now()
      p.evaluando = true
      p.ultimoEnvioTs = tsEnvio
      const casos = [...(v.problema.ejemplos || []), ...(v.problema.pruebas_ocultas || [])]
      try {
        const evaluacion = await cola.agregar(
          () => correrCasos({ ejecutar, lenguaje: v.lenguaje, codigo: v.codigo, casos, limiteMs: v.problema.limite_tiempo_ms || 2000, paralelas: cfg.pruebasParalelas }),
          (posicion) => { if (p.socketId) io.to(p.socketId).emit('reto:cola', { tipo: 'envio', posicion }) }
        )
        const r = resumir(evaluacion, casos.length)

        if (r.veredicto === 'INTERNO') {
          p.ultimoEnvioTs = 0 // no fue culpa del estudiante: puede reintentar de inmediato
          return cb({ ok: false, mensaje: 'El motor de ejecución falló y tu envío NO se contó. Intenta de nuevo. (' + r.mensaje + ')' })
        }

        const puntos = Math.round(v.problema.puntos * r.pasadas / r.total)
        const tiempoMs = tsEnvio - reto.inicio
        e.envios++
        if (r.veredicto !== 'ACEPTADO' && r.veredicto !== 'COMPILACION') e.intentosFallidos++
        if (puntos > e.puntos) {
          e.puntos = puntos
          e.pasadas = r.pasadas
          e.tiempoMs = tiempoMs
        }
        if (r.veredicto === 'ACEPTADO') e.aceptado = true
        if (!e.aceptado && reto.intentosMax > 0 && e.intentosFallidos >= reto.intentosMax) e.bloqueado = true
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
        reto.envios.push(envio)
        console.log(`[Reto ${reto.codigo}] ${p.nombre} · ${v.problemaId} · ${r.veredicto} ${r.pasadas}/${r.total}`)

        cb({
          ok: true,
          envio: sinCodigo(envio),
          intentosFallidos: e.intentosFallidos,
          bloqueado: e.bloqueado,
          mejorPuntaje: e.puntos
        })
        enviarMiEstado(reto, p)
        notificarAdmin(reto)
        // Si el profesor terminó el reto mientras se evaluaba, se actualizan los resultados finales
        if (reto.estado === 'terminado') enviarATodos(reto)
        guardar()
      } catch (err) {
        cb({ ok: false, mensaje: 'Error al evaluar: ' + err.message })
      } finally {
        p.evaluando = false
      }
    })

    // Registro de cambios de pestaña (informativo para el profesor)
    socket.on('estudiante:reto:foco', (datos) => {
      const ctx = contextoEstudiante(socket)
      if (!ctx || ctx.reto.estado !== 'en-curso' || datos?.visible !== false) return
      ctx.p.salidasPestana = (ctx.p.salidasPestana || 0) + 1
      notificarAdmin(ctx.reto)
    })

    socket.on('disconnect', () => {
      if (socket.data.rol === 'estudiante-reto') {
        const reto = retos.get(socket.data.codigoSala)
        const p = reto?.participantes.find(x => x.codigoEstudiante === socket.data.codigoEstudiante)
        if (p && p.socketId === socket.id) {
          p.conectado = false
          notificarAdmin(reto)
        }
      } else if (socket.data.rol === 'admin-reto') {
        const reto = retos.get(socket.data.retoAdmin)
        if (reto && reto.adminSocketId === socket.id) reto.adminSocketId = null
      }
    })
  }

  cargar()

  return {
    existe,
    unirse,
    registrarSocket,
    listarProblemasAdmin,
    estadoMotor,
    guardarYa,
    _retos: retos // solo para pruebas
  }
}

module.exports = { crearGestorRetos }
