// Ranking del reto.
//  1. Más puntos.
//  2. Desempate: menor tiempo total. El tiempo de cada problema es el momento (desde que inició el reto)
//     en que el estudiante logró su mejor puntaje en ese problema.
//  3. Si siguen empatados: quien tenga menos intentos fallidos.

function filaRanking(reto, p) {
  let puntos = 0
  let tiempoTotalMs = 0
  let resueltos = 0
  let intentosFallidos = 0
  const problemas = {}

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
    puntos,
    tiempoTotalMs,
    resueltos,
    intentosFallidos,
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
