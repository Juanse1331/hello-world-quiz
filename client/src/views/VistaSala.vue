<template>
  <div class="sala-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.svg" alt="ACEIS" class="logo" />
      <h1>Hello World Quiz</h1>
      <div class="header-info" v-if="state.nombre">
        <span class="nombre-chip">{{ state.nombre }}</span>
        <span class="puntaje-chip">{{ puntajeActual }} pts</span>
      </div>
    </header>

    <!-- Sala de espera -->
    <div v-if="!state.preguntaActual" class="container-sm" style="padding-top: 48px;">
      <div class="card fade-in espera-card">
        <div class="espera-icon">⏳</div>
        <h2>Esperando al profesor...</h2>
        <p>El quiz comenzará cuando el profesor lo inicie</p>

        <div class="participantes-lista" v-if="state.participantes.length > 0">
          <h3>Participantes conectados ({{ state.participantes.length }})</h3>
          <div class="participantes-grid">
            <div
              v-for="p in state.participantes"
              :key="p.codigoEstudiante"
              class="participante-chip"
              :class="{ 'yo': p.codigoEstudiante === state.codigoEstudiante }"
            >
              {{ p.nombre }}
              <span v-if="p.codigoEstudiante === state.codigoEstudiante" class="yo-label">(tú)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pregunta activa -->
    <div v-else class="container" style="padding-top: 24px;">
      <!-- Barra de progreso / timer -->
      <div class="pregunta-header">
        <div class="pregunta-numero">
          Pregunta {{ state.preguntaActual.numero }} / {{ state.preguntaActual.total }}
        </div>
        <div class="badges">
          <span class="badge" :class="'badge-' + state.preguntaActual.nivel">
            {{ nivelLabel(state.preguntaActual.nivel) }}
          </span>
          <span class="badge badge-tipo">{{ tipoLabel(state.preguntaActual.tipo) }}</span>
          <span class="badge badge-puntos">{{ state.preguntaActual.puntos }} pts</span>
        </div>
        <div v-if="state.timerActivo || state.tiempoRestante > 0" class="timer-container">
          <div class="timer-bar">
            <div
              class="timer-fill"
              :style="{ width: timerPorcentaje + '%' }"
              :class="{ 'urgente': state.tiempoRestante <= 5 }"
            ></div>
          </div>
          <span class="timer-texto" :class="{ 'urgente': state.tiempoRestante <= 5 }">
            {{ state.tiempoRestante }}s
          </span>
        </div>
      </div>

      <!-- Enunciado -->
      <div class="card pregunta-card fade-in">
        <pre v-if="tieneCodigoEnunciado" class="enunciado-codigo">{{ state.preguntaActual.enunciado }}</pre>
        <p v-else class="enunciado-texto">{{ state.preguntaActual.enunciado }}</p>
      </div>

      <!-- Opciones -->
      <div class="opciones-grid" :class="{ 'dos-columnas': state.preguntaActual.tipo === 'VF' }">
        <button
          v-for="(opcion, idx) in state.preguntaActual.opciones"
          :key="idx"
          class="opcion-btn"
          :class="opcionClase(idx)"
          :disabled="state.yaRespondio"
          @click="responder(idx)"
        >
          <span class="opcion-letra">{{ letras[idx] }}</span>
          <span class="opcion-texto">{{ opcion }}</span>
          <span v-if="state.feedbackRespuesta && idx === state.feedbackRespuesta.respuestaCorrecta" class="opcion-icono">✅</span>
          <span v-else-if="state.feedbackRespuesta && idx === respuestaSeleccionada && !state.feedbackRespuesta.esCorrecta" class="opcion-icono">❌</span>
        </button>
      </div>

      <!-- Feedback -->
      <transition name="slide-up">
        <div v-if="state.feedbackRespuesta" class="feedback-card" :class="state.feedbackRespuesta.esCorrecta ? 'correcto' : 'incorrecto'">
          <div class="feedback-titulo">
            <span v-if="state.feedbackRespuesta.esCorrecta">✅ ¡Correcto! +{{ state.feedbackRespuesta.puntos }} puntos</span>
            <span v-else>❌ Incorrecto — 0 puntos</span>
          </div>
          <p class="feedback-explicacion">{{ state.feedbackRespuesta.explicacion }}</p>
          <p class="feedback-tema">📚 Tema: {{ state.feedbackRespuesta.tema }}</p>
          <p class="esperando-msg">Esperando al profesor para la siguiente pregunta...</p>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuiz } from '../composables/useQuiz'

const router = useRouter()
const { state, stateRaw } = useQuiz()

if (!state.codigoSala && !state.salaCreada) {
  router.push('/')
}

const letras = ['A', 'B', 'C', 'D']
const respuestaSeleccionada = ref(null)

const puntajeActual = computed(() => {
  if (!state.resultados) return stateRaw.puntajeAcumulado
  const yo = state.resultados.find(r => r.codigoEstudiante === state.codigoEstudiante)
  return yo?.puntaje || stateRaw.puntajeAcumulado
})

const timerPorcentaje = computed(() => {
  if (!state.preguntaActual) return 0
  // Necesitamos el total de segundos — lo guardamos al primer tick
  return Math.max(0, (state.tiempoRestante / (stateRaw.totalSegundos || 1)) * 100)
})

const tieneCodigoEnunciado = computed(() => {
  const tipo = state.preguntaActual?.tipo
  return ['IMP', 'ERR', 'COMP', 'DF'].includes(tipo)
})

function nivelLabel(nivel) {
  return { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }[nivel] || nivel
}

function tipoLabel(tipo) {
  return { SM: 'Sel. Múltiple', VF: 'V / F', COMP: 'Completar', IMP: '¿Qué imprime?', ERR: 'Encontrar error', DF: 'Diagrama' }[tipo] || tipo
}

function opcionClase(idx) {
  if (!state.feedbackRespuesta) return {}
  return {
    'opcion-correcta': idx === state.feedbackRespuesta.respuestaCorrecta,
    'opcion-incorrecta': idx === respuestaSeleccionada.value && !state.feedbackRespuesta.esCorrecta
  }
}

function responder(idx) {
  if (state.yaRespondio) return
  respuestaSeleccionada.value = idx
  stateRaw.yaRespondio = true

  state.socket.emit('estudiante:responder', { respuesta: idx }, (res) => {
    if (res.ok) {
      stateRaw.feedbackRespuesta = {
        esCorrecta: res.esCorrecta,
        puntos: res.puntos,
        respuestaCorrecta: res.respuestaCorrecta,
        explicacion: res.explicacion,
        tema: res.tema
      }
      if (res.esCorrecta) {
        stateRaw.puntajeAcumulado += res.puntos
      }
    } else if (!stateRaw.feedbackRespuesta) {
      // Respuesta rechazada (p. ej. tiempo agotado): el handler de tiempo-agotado mostrará el feedback
      stateRaw.yaRespondio = res.mensaje === 'Ya respondiste esta pregunta'
    }
  })
}
</script>

<style scoped>
.sala-page { min-height: 100vh; background: var(--color-bg); }
.header-info { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.nombre-chip {
  background: rgba(255,255,255,0.2);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}
.puntaje-chip {
  background: var(--color-accent);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
}

/* Espera */
.espera-card { text-align: center; padding: 48px 32px; }
.espera-icon { font-size: 64px; margin-bottom: 16px; }
.espera-card h2 { color: var(--color-primary); font-size: 24px; margin-bottom: 8px; }
.espera-card p { color: var(--color-text-light); }
.participantes-lista { margin-top: 32px; text-align: left; }
.participantes-lista h3 { color: var(--color-text-light); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.participantes-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.participante-chip {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
}
.participante-chip.yo {
  background: rgba(27,27,143,0.08);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}
.yo-label { font-size: 11px; color: var(--color-primary); }

/* Pregunta */
.pregunta-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.pregunta-numero {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badges { display: flex; gap: 6px; }
.badge-puntos { background: rgba(27,27,143,0.1); color: var(--color-primary); }
.timer-container {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}
.timer-bar {
  flex: 1;
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}
.timer-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 4px;
  transition: width 1s linear;
}
.timer-fill.urgente { background: var(--color-error); }
.timer-texto { font-weight: 700; font-size: 16px; min-width: 32px; color: var(--color-text); }
.timer-texto.urgente { color: var(--color-error); }

.pregunta-card { margin-bottom: 16px; }
.enunciado-texto { font-size: 18px; line-height: 1.7; color: var(--color-text); }
.enunciado-codigo {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--color-text);
  background: var(--color-bg);
  padding: 16px;
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--color-primary);
}

.opciones-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.opciones-grid.dos-columnas { grid-template-columns: 1fr 1fr; }
.opcion-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  font-size: 15px;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-sm);
}
.opcion-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: rgba(27,27,143,0.04);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.opcion-btn:disabled { cursor: not-allowed; }
.opcion-letra {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: var(--color-primary);
  flex-shrink: 0;
}
.opcion-texto { flex: 1; }
.opcion-icono { margin-left: auto; font-size: 18px; }
.opcion-correcta {
  border-color: var(--color-success) !important;
  background: var(--color-success-light) !important;
}
.opcion-correcta .opcion-letra { background: var(--color-success); color: white; }
.opcion-incorrecta {
  border-color: var(--color-error) !important;
  background: var(--color-error-light) !important;
}
.opcion-incorrecta .opcion-letra { background: var(--color-error); color: white; }

/* Feedback */
.feedback-card {
  padding: 20px 24px;
  border-radius: var(--radius-md);
  margin-top: 8px;
}
.feedback-card.correcto { background: var(--color-success-light); border-left: 4px solid var(--color-success); }
.feedback-card.incorrecto { background: var(--color-error-light); border-left: 4px solid var(--color-error); }
.feedback-titulo { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
.feedback-explicacion { font-size: 14px; margin-bottom: 6px; }
.feedback-tema { font-size: 13px; color: var(--color-text-light); margin-bottom: 8px; }
.esperando-msg { font-size: 13px; color: var(--color-text-light); font-style: italic; }

/* Animaciones */
.slide-up-enter-active { transition: all 0.3s ease; }
.slide-up-enter-from { opacity: 0; transform: translateY(16px); }

@media (max-width: 540px) {
  .opciones-grid { grid-template-columns: 1fr; }
  .pregunta-header { flex-direction: column; align-items: flex-start; }
  .timer-container { width: 100%; margin-left: 0; }
}
</style>