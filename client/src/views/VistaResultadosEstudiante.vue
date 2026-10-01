<template>
  <div class="resultados-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.svg" alt="ACEIS" class="logo" />
      <h1>Hello World Quiz</h1>
    </header>

    <main class="container" style="padding-top: 32px;" v-if="miResultado">
      <!-- Puntaje principal -->
      <div class="card resultado-hero fade-in">
        <div class="trofeo">{{ clasificacionEmoji }}</div>
        <h2 class="clasificacion-label">{{ clasificacionLabel }}</h2>
        <div class="puntaje-grande">{{ puntajeAnimado }}</div>
        <div class="puntaje-sub">puntos</div>
        <div class="estadisticas">
          <div class="stat">
            <span class="stat-valor">{{ miResultado.totalCorrectas }}</span>
            <span class="stat-label">Correctas</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-valor">{{ miResultado.totalPreguntas - miResultado.totalCorrectas }}</span>
            <span class="stat-label">Incorrectas</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-valor">{{ porcentaje }}%</span>
            <span class="stat-label">Aciertos</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-valor">#{{ miPosicion }}</span>
            <span class="stat-label">Posici&#xF3;n</span>
          </div>
        </div>
      </div>
      <!-- Detalle por pregunta -->
      <div class="card" style="margin-top: 16px;">
        <h3 style="margin-bottom: 16px; color: var(--color-primary);">Resumen por pregunta</h3>
        <div class="resumen-lista">
          <div
            v-for="(r, idx) in miResultado.respuestas"
            :key="idx"
            class="resumen-item"
            :class="r.esCorrecta ? 'correcto' : 'incorrecto'"
          >
            <div class="resumen-numero">{{ idx + 1 }}</div>
            <div class="resumen-contenido">
              <div class="resumen-enunciado">{{ r.enunciado }}...</div>
              <div class="resumen-detalles">
                <span class="resp-tuya" :class="r.esCorrecta ? 'bien' : 'mal'">
                  Tu respuesta: {{ r.opcionDada || 'No respondiste' }}
                </span>
                <span v-if="!r.esCorrecta" class="resp-correcta">
                  &#x2713; Correcta: {{ r.opcionCorrecta }}
                </span>
              </div>
              <div class="resumen-explicacion">{{ r.explicacion }}</div>
              <div class="resumen-tema">&#x1F4DA; {{ r.tema }}</div>
            </div>
            <div class="resumen-puntos">
              <span :class="r.esCorrecta ? 'puntos-ok' : 'puntos-no'">
                {{ r.esCorrecta ? '+' + r.puntos : '0' }} pts
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-else class="container-sm" style="padding-top: 80px; text-align: center;">
      <div class="spinner" style="margin: 0 auto 16px;"></div>
      <p>Cargando resultados...</p>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuiz } from '../composables/useQuiz'

const { state } = useQuiz()

const puntajeAnimado = ref(0)

const miResultado = computed(() => {
  if (!state.resultados) return null
  return state.resultados.find(r => r.codigoEstudiante === state.codigoEstudiante) || state.resultados[0]
})

const miPosicion = computed(() => {
  if (!state.resultados || !miResultado.value) return '-'
  return state.resultados.findIndex(r => r.codigoEstudiante === miResultado.value.codigoEstudiante) + 1
})

const porcentaje = computed(() => {
  if (!miResultado.value) return 0
  return Math.round((miResultado.value.totalCorrectas / miResultado.value.totalPreguntas) * 100)
})

const clasificacionLabel = computed(() => {
  const p = porcentaje.value
  if (p >= 80) return 'Excelente'
  if (p >= 60) return 'Bueno'
  return 'Sigue practicando'
})

const clasificacionEmoji = computed(() => {
  const p = porcentaje.value
  if (p >= 80) return '🏆'
  if (p >= 60) return '🎯'
  return '📚'
})

onMounted(() => {
  if (!miResultado.value) return
  const target = miResultado.value.puntaje
  const duration = 1200
  const steps = 60
  const increment = target / steps
  let current = 0
  const interval = setInterval(() => {
    current = Math.min(current + increment, target)
    puntajeAnimado.value = Math.round(current)
    if (current >= target) clearInterval(interval)
  }, duration / steps)
})
</script>
<style scoped>
.resultados-page { min-height: 100vh; background: var(--color-bg); }
.resultado-hero {
  text-align: center;
  padding: 40px 24px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  color: white;
}
.trofeo { font-size: 72px; margin-bottom: 8px; }
.clasificacion-label { font-size: 20px; margin-bottom: 8px; opacity: 0.9; }
.puntaje-grande { font-size: 72px; font-weight: 800; line-height: 1; }
.puntaje-sub { font-size: 14px; opacity: 0.7; margin-bottom: 24px; }
.estadisticas { display: flex; justify-content: center; align-items: center; gap: 0; flex-wrap: wrap; }
.stat { padding: 0 20px; text-align: center; }
.stat-valor { display: block; font-size: 24px; font-weight: 700; }
.stat-label { display: block; font-size: 12px; opacity: 0.8; }
.stat-divider { width: 1px; height: 36px; background: rgba(255,255,255,0.3); }

.resumen-lista { display: flex; flex-direction: column; gap: 12px; }
.resumen-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border-radius: var(--radius-sm);
  border-left: 4px solid;
}
.resumen-item.correcto { background: var(--color-success-light); border-color: var(--color-success); }
.resumen-item.incorrecto { background: var(--color-error-light); border-color: var(--color-error); }
.resumen-numero {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.resumen-contenido { flex: 1; }
.resumen-enunciado { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.resumen-detalles { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; font-size: 13px; }
.resp-tuya.bien { color: #155724; font-weight: 600; }
.resp-tuya.mal { color: #721c24; }
.resp-correcta { color: #155724; font-weight: 600; }
.resumen-explicacion { font-size: 13px; color: var(--color-text-light); margin-bottom: 2px; }
.resumen-tema { font-size: 12px; color: var(--color-text-light); }
.resumen-puntos { font-weight: 700; font-size: 15px; flex-shrink: 0; }
.puntos-ok { color: var(--color-success); }
.puntos-no { color: var(--color-text-light); }
</style>