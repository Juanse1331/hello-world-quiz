// Preguntas de completar (tipo COMP) con varios espacios: cada espacio tiene un número y un color,
// y las opciones se muestran como "fichas" del mismo color, para que un "/" o un "·" no se confunda
// con parte de la respuesta.
//
// En el banco, los espacios del enunciado se escriben __(1)__, __(2)__ ... y las opciones así:
//   "(1) != 0 · (2) suma + numero"
// (también funciona "valor1 / valor2" si el número de partes coincide con el número de espacios).

const MARCA_ESPACIO = /__\((\d+)\)__/g

// Número de color (1..5) para el espacio n
export function colorEspacio(n) {
  return ((Number(n) - 1) % 5) + 1
}

// Parte el enunciado en trozos de texto y espacios: [{ texto }, { espacio: 1, texto: '(1)' }, ...]
export function segmentosEnunciado(tipo, enunciado) {
  if (tipo !== 'COMP' || !MARCA_ESPACIO.test(enunciado)) return [{ texto: enunciado }]
  MARCA_ESPACIO.lastIndex = 0
  const segmentos = []
  let ultimo = 0
  for (const m of enunciado.matchAll(MARCA_ESPACIO)) {
    if (m.index > ultimo) segmentos.push({ texto: enunciado.slice(ultimo, m.index) })
    segmentos.push({ espacio: Number(m[1]), texto: `(${m[1]})` })
    ultimo = m.index + m[0].length
  }
  if (ultimo < enunciado.length) segmentos.push({ texto: enunciado.slice(ultimo) })
  return segmentos
}

function contarEspacios(enunciado) {
  return new Set([...String(enunciado).matchAll(MARCA_ESPACIO)].map(m => m[1])).size
}

// Parte una opción en [{ n, valor }] o devuelve null si no es de completar varios espacios
export function partesOpcion(tipo, enunciado, opcion) {
  if (tipo !== 'COMP' || typeof opcion !== 'string') return null
  // Formato "(1) valor · (2) valor": se corta por las marcas (n), no por el separador,
  // así un "/" que sea parte de la respuesta (una división, por ejemplo) no se pierde.
  const marcas = [...opcion.matchAll(/\((\d+)\)/g)]
  if (marcas.length >= 2) {
    return marcas.map((m, i) => {
      const fin = i + 1 < marcas.length ? marcas[i + 1].index : opcion.length
      const valor = opcion.slice(m.index + m[0].length, fin).trim().replace(/\s*[·/|;,]\s*$/, '').trim()
      return { n: Number(m[1]), valor }
    })
  }
  // Formato "valor / valor": solo si el número de partes coincide con el número de espacios
  const espacios = contarEspacios(enunciado)
  if (espacios >= 2) {
    const partes = opcion.split(/\s+[·/|]\s+/)
    if (partes.length === espacios) return partes.map((valor, i) => ({ n: i + 1, valor: valor.trim() }))
  }
  return null
}
