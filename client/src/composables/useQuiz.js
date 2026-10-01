import { reactive, readonly, markRaw } from 'vue'
import { io } from 'socket.io-client'

const state = reactive({
  socket: null,
  conectado: false,
  rol: null, // 'estudiante' | 'admin'
  // Estudiante
  nombre: '',
  codigoEstudiante: '',
  codigoSala: '',
  // Quiz en curso
  preguntaActual: null,
  tiempoRestante: 0,
  timerActivo: false,
  yaRespondio: false,
  feedbackRespuesta: null, // { esCorrecta, puntos, respuestaCorrecta, explicacion, tema }
  puntajeAcumulado: 0,
  totalSegundos: 0,
  // Admin
  salaCreada: null,
  participantes: [],
  respuestasEnCurso: {}, // participanteId -> { esCorrecta, puntos }
  // Resultados
  resultados: null,
  error: ''
})

let socketInstance = null

function conectar() {
  if (socketInstance) return socketInstance

  const url = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000'
  socketInstance = io(url, { transports: ['websocket', 'polling'] })
  state.socket = markRaw(socketInstance)

  socketInstance.on('connect', () => {
    state.conectado = true
    state.error = ''
  })

  socketInstance.on('disconnect', () => {
    state.conectado = false
  })

  socketInstance.on('connect_error', () => {
    state.error = 'No se pudo conectar al servidor. Verifica que esté corriendo.'
  })

  return socketInstance
}

const EVENTOS = [
  'sala:lista-participantes', 'sala:nueva-pregunta', 'sala:timer-tick', 'sala:tiempo-agotado',
  'sala:quiz-terminado', 'sala:participante-unido', 'sala:participante-desconectado',
  'sala:respuesta-recibida'
]

// Evita handlers duplicados cuando una vista se monta más de una vez
function quitarEventos(s) {
  EVENTOS.forEach(e => s.off(e))
}

function registrarEventosEstudiante(router) {
  const s = socketInstance
  if (!s) return
  quitarEventos(s)

  s.on('sala:lista-participantes', (lista) => {
    state.participantes = lista
  })

  s.on('sala:nueva-pregunta', (pregunta) => {
    state.preguntaActual = pregunta
    state.yaRespondio = false
    state.feedbackRespuesta = null
    state.totalSegundos = pregunta.segundos || 0
    state.tiempoRestante = pregunta.segundos || 0
    state.timerActivo = !!pregunta.segundos
    router.push('/sala')
  })

  s.on('sala:timer-tick', ({ tiempoRestante }) => {
    state.tiempoRestante = tiempoRestante
    state.timerActivo = tiempoRestante > 0
  })

  s.on('sala:tiempo-agotado', (data) => {
    state.timerActivo = false
    state.tiempoRestante = 0
    if (!state.yaRespondio) {
      state.yaRespondio = true
      state.feedbackRespuesta = {
        esCorrecta: false,
        puntos: 0,
        respuestaCorrecta: data?.respuestaCorrecta ?? -1,
        explicacion: 'Tiempo agotado. ' + (data?.explicacion || ''),
        tema: data?.tema ?? ''
      }
    }
  })

  s.on('sala:quiz-terminado', ({ resultados }) => {
    state.resultados = resultados
    state.preguntaActual = null
    router.push('/resultados')
  })
}

function registrarEventosAdmin() {
  const s = socketInstance
  if (!s) return
  quitarEventos(s)

  s.on('sala:participante-unido', ({ participante, totalParticipantes }) => {
    const existe = state.participantes.find(p => p.id === participante.id)
    if (!existe) state.participantes.push({ ...participante, puntaje: 0, respuestas: [] })
  })

  s.on('sala:participante-desconectado', ({ participanteId, nombre }) => {
    const p = state.participantes.find(x => x.id === participanteId)
    if (p) p.desconectado = true
  })

  s.on('sala:respuesta-recibida', (data) => {
    const { participanteId, idxPregunta, respuesta, esCorrecta, puntos, puntajeTotal } = data
    const p = state.participantes.find(x => x.id === participanteId)
    if (p) {
      if (!p.respuestas) p.respuestas = []
      p.respuestas[idxPregunta] = { respuesta, esCorrecta, puntos }
      p.puntaje = puntajeTotal
    }
  })

  s.on('sala:nueva-pregunta', (pregunta) => {
    state.preguntaActual = pregunta
    state.tiempoRestante = 0
    // Limpiar estado de respuestas actuales
    state.participantes.forEach(p => {
      if (!p.respuestas) p.respuestas = []
    })
  })

  s.on('sala:timer-tick', ({ tiempoRestante }) => {
    state.tiempoRestante = tiempoRestante
    state.timerActivo = tiempoRestante > 0
  })

  s.on('sala:tiempo-agotado', () => {
    state.timerActivo = false
    state.tiempoRestante = 0
  })

  s.on('sala:quiz-terminado', ({ resultados }) => {
    state.resultados = resultados
  })
}

function resetearEstado() {
  state.nombre = ''
  state.codigoEstudiante = ''
  state.codigoSala = ''
  state.preguntaActual = null
  state.tiempoRestante = 0
  state.timerActivo = false
  state.yaRespondio = false
  state.feedbackRespuesta = null
  state.puntajeAcumulado = 0
  state.totalSegundos = 0
  state.salaCreada = null
  state.participantes = []
  state.respuestasEnCurso = {}
  state.resultados = null
  state.error = ''
  state.rol = null
}

export function useQuiz() {
  return {
    state: readonly(state),
    stateRaw: state,
    conectar,
    registrarEventosEstudiante,
    registrarEventosAdmin,
    resetearEstado
  }
}