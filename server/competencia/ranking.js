// Ranking de la competencia.
//  1. Más puntos (preguntas + problemas).
//  2. Desempate: menor tiempo total. Para una pregunta acertada, lo que tardó en responderla;
//     para un problema, lo que tardó (desde que se le abrió) en lograr su mejor puntaje.
//  3. Si siguen empatados: quien tenga menos intentos fallidos.

function filaRanking(reto, p) {
  let puntos = 0
  let tiempoTotalMs = 0
  let resueltos = 0
  let intentosFallidos = 0
  let correctas = 0
  let respondidas = 0
  let puntosPreguntas = 0
  const problemas = {}

  for (const id of reto.preguntaIds) {
    const r = p.respuestas[id]
    if (!r) continue
    if (r.respuesta !== null) respondidas++
    if (r.esCorrecta) {
      correctas++
      puntosPreguntas += r.puntos
      tiempoTotalMs += r.ms
    }
  }
  puntos += puntosPreguntas

  for (const id of reto.problemaIds) {
    const e = p.problemas[id] || null
    if (e) {
      puntos += e.puntos
      intentosFallidos += e.intentosFallidos
      if (e.puntos > 0) tiempoTotalMs += e.tiempoMs
      if (e.aceptado) resueltos++
    }
    problemas[id] = e
      ? {
          puntos: e.puntos, pasadas: e.pasadas, total: e.total, intentosFallidos: e.intentosFallidos,
          envios: e.envios, aceptado: e.aceptado, bloqueado: e.bloqueado, tiempoMs: e.tiempoMs,
          ultimoVeredicto: e.ultimoVeredicto
        }
      : null
  }

  return {
    nombre: p.nombre,
    codigoEstudiante: p.codigoEstudiante,
    conectado: p.conectado,
    salidasPestana: p.salidasPestana || 0,
    // Progreso por su recorrido: ítem en el que va (1..total) o terminado
    progreso: { actual: Math.min(p.actual + 1, p.orden.length), total: p.orden.length, terminado: !!p.terminado },
    puntos,
    tiempoTotalMs,
    resueltos,
    intentosFallidos,
    preguntas: { correctas, respondidas, total: reto.preguntaIds.length, puntos: puntosPreguntas },
    problemas
  }
}

function calcularRanking(reto) {
  const filas = reto.participantes.map(p => filaRanking(reto, p))
  filas.sort((a, b) =>
    b.puntos - a.puntos ||
    a.tiempoTotalMs - b.tiempoTotalMs ||
    a.intentosFallidos - b.intentosFallidos ||
    a.nombre.localeCompare(b.nombre, 'es')
  )
  filas.forEach((f, i) => { f.posicion = i + 1 })
  return filas
}

module.exports = { calcularRanking }
