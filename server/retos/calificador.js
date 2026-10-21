// Calificador: ejecuta el código del estudiante contra los casos de prueba y compara las salidas.

// Compara de forma tolerante: ignora espacios repetidos, espacios al final de cada línea,
// líneas vacías al inicio/final y la diferencia entre saltos de línea de Windows y Linux.
// Sí distingue mayúsculas de minúsculas (PAR no es lo mismo que par).
function normalizar(texto) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(linea => linea.trim().replace(/\s+/g, ' '))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

function salidasIguales(obtenida, esperada) {
  return normalizar(obtenida) === normalizar(esperada)
}

// Ejecuta tareas con un máximo de 'limite' al mismo tiempo, conservando el orden de los resultados
async function enParalelo(items, limite, fn) {
  const resultados = new Array(items.length)
  let siguiente = 0
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++
      resultados[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador))
  return resultados
}

/**
 * Corre el programa con cada caso de prueba.
 * Si el primer caso da error de compilación, no corre los demás (fallarían igual).
 * Devuelve { compilacion: null | mensaje, internoError: null | mensaje, casos: [{ ok, estado, salida, error, ms }] }
 */
async function correrCasos({ ejecutar, lenguaje, codigo, casos, limiteMs, paralelas = 3 }) {
  const correr = async (caso) => {
    const r = await ejecutar({ lenguaje, codigo, entrada: caso.entrada, limiteMs })
    return { ...r, ok: r.estado === 'OK' && salidasIguales(r.salida, caso.salida) }
  }

  if (casos.length === 0) return { compilacion: null, internoError: null, casos: [] }

  const primero = await correr(casos[0])
  if (primero.estado === 'COMPILACION') return { compilacion: primero.error, internoError: null, casos: [] }
  if (primero.estado === 'INTERNO') return { compilacion: null, internoError: primero.error, casos: [] }

  const resto = await enParalelo(casos.slice(1), paralelas, correr)
  const todos = [primero, ...resto]
  const interno = todos.find(c => c.estado === 'INTERNO')
  return { compilacion: null, internoError: interno ? interno.error : null, casos: todos }
}

/**
 * Resume una evaluación en un veredicto.
 *   ACEPTADO    todas las pruebas correctas
 *   PARCIAL     al menos una correcta
 *   INCORRECTO  ninguna correcta (respuesta equivocada)
 *   TIEMPO      ninguna correcta y alguna superó el tiempo
 *   EJECUCION   ninguna correcta y el programa falló al correr
 *   COMPILACION no compiló
 *   INTERNO     falló el motor (no es culpa del estudiante)
 */
function resumir(evaluacion, totalCasos) {
  if (evaluacion.internoError) {
    return { veredicto: 'INTERNO', pasadas: 0, total: totalCasos, mensaje: evaluacion.internoError, conteo: {} }
  }
  if (evaluacion.compilacion !== null) {
    return { veredicto: 'COMPILACION', pasadas: 0, total: totalCasos, mensaje: evaluacion.compilacion, conteo: {} }
  }
  const casos = evaluacion.casos
  const conteo = {
    correctas: casos.filter(c => c.ok).length,
    incorrectas: casos.filter(c => !c.ok && c.estado === 'OK').length,
    tiempo: casos.filter(c => c.estado === 'TIEMPO').length,
    ejecucion: casos.filter(c => c.estado === 'EJECUCION').length
  }
  const pasadas = conteo.correctas
  let veredicto
  if (pasadas === casos.length) veredicto = 'ACEPTADO'
  else if (pasadas > 0) veredicto = 'PARCIAL'
  else if (conteo.ejecucion > 0) veredicto = 'EJECUCION'
  else if (conteo.tiempo > 0) veredicto = 'TIEMPO'
  else veredicto = 'INCORRECTO'

  // Primer mensaje de error útil (sin revelar entradas ocultas)
  const conError = casos.find(c => !c.ok && c.error)
  return { veredicto, pasadas, total: casos.length, mensaje: conError ? conError.error : '', conteo }
}

module.exports = { normalizar, salidasIguales, correrCasos, resumir, enParalelo }
