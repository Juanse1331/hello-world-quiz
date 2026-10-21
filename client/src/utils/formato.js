// Utilidades de formato compartidas por las vistas del reto

// 125000 ms -> "2:05" ; 3725000 ms -> "1:02:05"
export function formatoReloj(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dos = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`
}

export function nivelLabel(nivel) {
  return { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }[nivel] || nivel
}

export function lenguajeLabel(lenguaje) {
  return { python: 'Python', cpp: 'C++' }[lenguaje] || lenguaje
}

// Texto, color e ícono de cada veredicto del juez
export function veredictoInfo(veredicto) {
  return {
    ACEPTADO: { texto: 'Aceptado', clase: 'v-aceptado', icono: 'check-circle' },
    PARCIAL: { texto: 'Parcial', clase: 'v-parcial', icono: 'target' },
    INCORRECTO: { texto: 'Respuesta incorrecta', clase: 'v-error', icono: 'x-circle' },
    TIEMPO: { texto: 'Tiempo excedido', clase: 'v-error', icono: 'clock' },
    EJECUCION: { texto: 'Error en ejecución', clase: 'v-error', icono: 'alert-triangle' },
    COMPILACION: { texto: 'Error de compilación', clase: 'v-compilacion', icono: 'code' }
  }[veredicto] || { texto: veredicto || '—', clase: '', icono: 'clock' }
}
