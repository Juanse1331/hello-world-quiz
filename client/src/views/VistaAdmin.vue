<template>
  <div class="admin-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.png" alt="ACEIS" class="logo" />
      <h1>Hello World Quiz · Admin</h1>
      <div class="header-info" v-if="autenticado">
        <span class="nombre-chip">Profesor</span>
        <button class="btn btn-sm btn-secondary" @click="cerrarSesion">Cerrar sesión</button>
      </div>
    </header>
    <div v-if="!autenticado" class="container-sm" style="padding-top: 80px;">
      <div class="card fade-in">
        <div class="card-header-aceis">
          <h2><Icon name="lock" :size="22" /> Acceso Administrador</h2>
          <p>Ingresa la contraseña para continuar</p>
        </div>
        <form @submit.prevent="iniciarSesion" style="margin-top: 24px;">
          <div class="form-group">
            <label>contraseña</label>
            <input v-model="password" type="password" class="form-control" placeholder="contraseña admin" required autofocus />
          </div>
          <div v-if="errorLogin" class="alert alert-error">{{ errorLogin }}</div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="cargandoLogin">
            {{ cargandoLogin ? 'Verificando...' : 'Entrar' }}
          </button>
        </form>
        <div style="text-align:center; margin-top:16px;">
          <router-link to="/" style="color: var(--color-text-light); font-size:13px;"><Icon name="arrow-left" :size="14" /> Volver al inicio</router-link>
        </div>
      </div>
    </div>
    <div v-else-if="!salaActiva" class="container" style="padding-top: 24px;">
      <div class="seccion-titulo">
        <h2>Nueva sesión de quiz</h2>
        <p>Selecciona las preguntas y configura el quiz</p>
      </div>
      <div class="card config-timer">
        <div class="timer-toggle">
          <label class="switch-label">
            <input type="checkbox" v-model="timerActivo" class="switch-input" />
            <span class="switch-track"></span>
            <span>Activar temporizador por pregunta</span>
          </label>
          <div v-if="timerActivo" class="timer-segundos">
            <label>Segundos por pregunta:</label>
            <input v-model.number="segundosPorPregunta" type="number" min="15" max="120" class="form-control" style="width: 80px; display: inline-block;" />
          </div>
        </div>
      </div>
      <div class="card filtros-card">
        <div class="filtros-row">
          <div class="filtro-grupo">
            <span class="filtro-label">Nivel:</span>
            <button v-for="nivel in ['todos', 'facil', 'medio', 'dificil']" :key="nivel" class="btn btn-sm" :class="filtroNivel === nivel ? 'btn-primary' : 'btn-secondary'" @click="filtroNivel = nivel">{{ nivelLabel(nivel) }}</button>
          </div>
          <div class="filtro-grupo">
            <span class="filtro-label">Tipo:</span>
            <button v-for="tipo in ['todos', 'SM', 'VF', 'COMP', 'IMP', 'ERR', 'DF']" :key="tipo" class="btn btn-sm" :class="filtroTipo === tipo ? 'btn-primary' : 'btn-secondary'" @click="filtroTipo = tipo">{{ tipoLabel(tipo) }}</button>
          </div>
          <div class="filtro-grupo">
            <button class="btn btn-sm btn-secondary" @click="seleccionarNivel">Seleccionar nivel actual</button>
            <button class="btn btn-sm btn-secondary" @click="limpiarSeleccion">Limpiar</button>
          </div>
        </div>
      </div>
      <div class="config-grid">
        <div class="card">
          <h3 style="margin-bottom: 12px;">Banco de preguntas <span class="count-badge">{{ preguntasFiltradas.length }}</span></h3>
          <div class="preguntas-lista">
            <div v-for="p in preguntasFiltradas" :key="p.id" class="pregunta-item" :class="{ seleccionada: estaSeleccionada(p.id) }" @click="togglePregunta(p)">
              <input type="checkbox" :checked="estaSeleccionada(p.id)" class="pregunta-check" />
              <div class="pregunta-info">
                <div class="pregunta-preview">{{ p.enunciado.substring(0, 80) }}{{ p.enunciado.length > 80 ? '...' : '' }}</div>
                <div class="pregunta-meta">
                  <span class="badge" :class="'badge-' + p.nivel">{{ nivelLabel(p.nivel) }}</span>
                  <span class="badge badge-tipo">{{ tipoLabel(p.tipo) }}</span>
                  <span class="badge" style="background:#E9EDF5; color:#202C45;">{{ p.puntos }} pts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <h3 style="margin-bottom: 12px;">Seleccionadas <span class="count-badge">{{ seleccionadas.length }}</span></h3>
          <div v-if="seleccionadas.length === 0" class="empty-state">
            <p>Haz clic en preguntas para agregarlas</p>
          </div>
          <div v-else class="preguntas-lista seleccionadas-lista">
            <div v-for="(p, idx) in seleccionadas" :key="p.id" class="pregunta-item seleccionada">
              <span class="orden-num">{{ idx + 1 }}</span>
              <div class="pregunta-info">
                <div class="pregunta-preview">{{ p.enunciado.substring(0, 60) }}...</div>
                <div class="pregunta-meta">
                  <span class="badge" :class="'badge-' + p.nivel">{{ nivelLabel(p.nivel) }}</span>
                  <span class="badge badge-tipo">{{ tipoLabel(p.tipo) }}</span>
                </div>
              </div>
              <div class="orden-controls">
                <button @click="moverArriba(idx)" :disabled="idx === 0" class="btn-orden" aria-label="Subir"><Icon name="chevron-up" :size="14" /></button>
                <button @click="moverAbajo(idx)" :disabled="idx === seleccionadas.length - 1" class="btn-orden" aria-label="Bajar"><Icon name="chevron-down" :size="14" /></button>
                <button @click="quitarPregunta(idx)" class="btn-orden btn-quitar" aria-label="Quitar"><Icon name="x" :size="14" /></button>
              </div>
            </div>
          </div>
          <div class="seleccionadas-footer">
            <div class="total-puntos">Puntos base: <strong>{{ totalPuntos }}</strong> (hasta +50% por rapidez)</div>
            <button class="btn btn-primary btn-lg btn-block" :disabled="seleccionadas.length === 0 || cargandoSala" @click="crearSala">
              {{ cargandoSala ? 'Creando sala...' : 'Crear sala' }}
            </button>
            <div v-if="errorSala" class="alert alert-error" style="margin-top: 8px;">{{ errorSala }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="container" style="padding-top: 24px;">
      <div class="card sala-Código-card" v-if="!quizIniciado">
        <div class="sala-Código-display">
          <div class="sala-Código-label">Código de sala para compartir</div>
          <div class="sala-Código-valor">{{ codigoSalaActiva }}</div>
          <p class="sala-Código-hint">Los estudiantes deben ingresar este código en la pantalla de ingreso</p>
        </div>
        <div class="sala-info">
          <div class="participantes-count">
            <span class="count-grande">{{ state.participantes.length }}</span>
            <span>participantes conectados</span>
          </div>
        </div>
        <div class="sala-acciones">
          <button class="btn btn-success btn-lg" :disabled="state.participantes.length === 0" @click="iniciarQuiz">
            <Icon name="play" :size="18" /> Iniciar Quiz ({{ state.participantes.length }} participantes)
          </button>
          <button class="btn btn-secondary" @click="nuevaSesion">Cancelar y Nueva sesión</button>
        </div>        <div v-if="state.participantes.length > 0" class="participantes-espera">
          <h4>Participantes en sala:</h4>
          <div class="participantes-chips">
            <div v-for="p in state.participantes" :key="p.id" class="participante-chip-admin">
              <strong>{{ p.nombre }}</strong>
              <span class="Código-est">{{ p.codigoEstudiante }}</span>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="monitor-control">
          <div class="control-info">
            <div class="sala-badge">{{ codigoSalaActiva }}</div>
            <div class="pregunta-info-control">
              Pregunta {{ preguntaActualMonitor?.numero || '-' }} / {{ seleccionadas.length }}
            </div>
            <div v-if="state.timerActivo || state.tiempoRestante > 0" class="timer-monitor">
              <div class="timer-bar-mini">
                <div class="timer-fill-mini" :style="{ width: timerPorcentajeAdmin + '%' }" :class="{ urgente: state.tiempoRestante <= 5 }"></div>
              </div>
              <span :class="{ 'urgente-text': state.tiempoRestante <= 5 }">{{ state.tiempoRestante }}s</span>
            </div>
          </div>
          <div class="control-botones">
            <button class="btn btn-primary" @click="siguientePregunta" :disabled="quizTerminado">
              <template v-if="esUltimaPregunta"><Icon name="square" :size="16" /> Terminar Quiz</template>
              <template v-else><Icon name="skip-forward" :size="16" /> Siguiente pregunta</template>
            </button>
            <button class="btn btn-danger btn-sm" @click="terminarQuizForzado" v-if="!quizTerminado && !esUltimaPregunta">
              Terminar ahora
            </button>
          </div>
        </div>
        <div class="card" style="margin-bottom: 16px; overflow-x: auto;">
          <table class="monitor-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Código</th>
                <th>Progreso</th>
                <th>Estado actual</th>
                <th>Puntaje</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, idx) in participantesOrdenados" :key="p.id" class="participante-row" :class="{ desconectado: p.desconectado }" @click="toggleDetalle(p.id)">
                <td class="td-pos">{{ idx + 1 }}</td>
                <td class="td-nombre">
                  {{ p.nombre }}
                  <span v-if="p.desconectado" class="desconectado-badge">desconectado</span>
                </td>
                <td class="td-Código">{{ p.codigoEstudiante }}</td>
                <td class="td-progreso">{{ (p.respuestas || []).filter(r => r !== undefined).length }} / {{ seleccionadas.length }}</td>
                <td class="td-estado">
                  <span v-if="estadoActual(p) === 'respondio-correcto'" class="estado-chip correcto"><Icon name="check-circle" :size="14" /> Correcto</span>
                  <span v-else-if="estadoActual(p) === 'respondio-incorrecto'" class="estado-chip incorrecto"><Icon name="x-circle" :size="14" /> Incorrecto</span>
                  <span v-else class="estado-chip esperando"><Icon name="clock" :size="14" /> Esperando</span>
                </td>
                <td class="td-puntaje"><strong>{{ p.puntaje || 0 }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="participanteDetalle" class="card detalle-card fade-in">
          <div class="detalle-header">
            <h3>Detalle: {{ participanteDetalle.nombre }} ({{ participanteDetalle.codigoEstudiante }})</h3>
            <button class="btn btn-sm btn-secondary" @click="participanteDetalleId = null">Cerrar</button>
          </div>
          <table class="detalle-tabla">
            <thead>
              <tr><th>#</th><th>Pregunta</th><th>Respondio</th><th>Correcta</th><th>Pts</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in participanteDetalle.respuestas" :key="idx" :class="r ? (r.esCorrecta ? 'fila-ok' : 'fila-mal') : ''">
                <td>{{ idx + 1 }}</td>
                <td class="td-enunciado-corto">{{ seleccionadas[idx]?.enunciado?.substring(0, 50) }}...</td>
                <td>{{ r ? r.opcionDada : '—' }}</td>
                <td>{{ seleccionadas[idx]?.opciones[seleccionadas[idx]?.respuesta_correcta] }}</td>
                <td><strong>{{ r ? r.puntos : 0 }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="quizTerminado && state.resultados" class="card resultados-admin fade-in">
          <div class="resultados-header">
            <h3><Icon name="trophy" :size="20" /> Resultados finales</h3>
            <button class="btn btn-success" @click="exportarExcel"><Icon name="download" :size="16" /> Exportar Excel</button>
            <button class="btn btn-secondary" @click="nuevaSesion">Nueva sesión</button>
          </div>
          <Podio :resultados="state.resultados" style="margin-bottom: 24px;" />
          <table class="monitor-tabla">
            <thead>
              <tr><th>Pos.</th><th>Nombre</th><th>Código</th><th>Correctas</th><th>Puntaje</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in state.resultados" :key="r.id" :class="idx === 0 ? 'primer-lugar' : ''">
                <td><Icon v-if="idx < 3" name="medal" :size="20" :class="'medalla-' + idx" /><template v-else>{{ idx + 1 }}</template></td>
                <td><strong>{{ r.nombre }}</strong></td>
                <td>{{ r.codigoEstudiante }}</td>
                <td>{{ r.totalCorrectas }} / {{ r.totalPreguntas }}</td>
                <td><strong>{{ r.puntaje }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuiz } from '../composables/useQuiz'
import Icon from '../components/Icon.vue'
import Podio from '../components/Podio.vue'

const { state, stateRaw, registrarEventosAdmin } = useQuiz()

const autenticado = ref(false)
const password = ref('')
const errorLogin = ref('')
const cargandoLogin = ref(false)
const timerActivo = ref(false)
const segundosPorPregunta = ref(30)
const filtroNivel = ref('todos')
const filtroTipo = ref('todos')
const seleccionadas = ref([])
const errorSala = ref('')
const cargandoSala = ref(false)
const salaActiva = ref(false)
const codigoSalaActiva = ref('')
const quizIniciado = ref(false)
const quizTerminado = ref(false)
const preguntaActualMonitor = ref(null)
const participanteDetalleId = ref(null)
const totalSegundosAdmin = ref(30)
const banco = ref([])

onMounted(async () => {
  try {
    const res = await fetch('/api/preguntas')
    banco.value = await res.json()
  } catch (e) {
    console.error('Error cargando banco', e)
  }
  const token = sessionStorage.getItem('admin-token')
  if (token) autenticado.value = true
  registrarEventosAdmin()
  state.socket?.on('sala:nueva-pregunta', (p) => {
    preguntaActualMonitor.value = p
    totalSegundosAdmin.value = segundosPorPregunta.value
  })
  state.socket?.on('sala:timer-tick', ({ tiempoRestante }) => {
    if (totalSegundosAdmin.value < tiempoRestante) totalSegundosAdmin.value = tiempoRestante
  })
  state.socket?.on('sala:quiz-terminado', () => {
    quizTerminado.value = true
  })
})
const preguntasFiltradas = computed(() => {
  return banco.value.filter(p => {
    const passNivel = filtroNivel.value === 'todos' || p.nivel === filtroNivel.value
    const passTipo = filtroTipo.value === 'todos' || p.tipo === filtroTipo.value
    return passNivel && passTipo
  })
})
const totalPuntos = computed(() => seleccionadas.value.reduce((a, p) => a + p.puntos, 0))
const participantesOrdenados = computed(() => [...state.participantes].sort((a, b) => (b.puntaje || 0) - (a.puntaje || 0)))
const esUltimaPregunta = computed(() => {
  if (!preguntaActualMonitor.value) return false
  return preguntaActualMonitor.value.numero >= seleccionadas.value.length
})
const timerPorcentajeAdmin = computed(() => {
  if (!totalSegundosAdmin.value) return 0
  return Math.max(0, (state.tiempoRestante / totalSegundosAdmin.value) * 100)
})
const participanteDetalle = computed(() => {
  if (!participanteDetalleId.value) return null
  return state.participantes.find(p => p.id === participanteDetalleId.value)
})

async function iniciarSesion() {
  errorLogin.value = ''
  cargandoLogin.value = true
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    const data = await res.json()
    if (data.ok) {
      sessionStorage.setItem('admin-token', data.token)
      autenticado.value = true
    } else {
      errorLogin.value = data.mensaje || 'contraseña incorrecta'
    }
  } catch (e) {
    errorLogin.value = 'Error de conexion con el servidor'
  } finally {
    cargandoLogin.value = false
  }
}
function cerrarSesion() {
  sessionStorage.removeItem('admin-token')
  autenticado.value = false
  nuevaSesion()
}
function nivelLabel(n) {
  return { todos: 'Todos', facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }[n] || n
}
function tipoLabel(t) {
  return { todos: 'Todos', SM: 'Sel. Múltiple', VF: 'V / F', COMP: 'Completar', IMP: '¿Qué imprime?', ERR: 'Error', DF: 'Diagrama' }[t] || t
}
function estaSeleccionada(id) { return seleccionadas.value.some(p => p.id === id) }
function togglePregunta(p) {
  const idx = seleccionadas.value.findIndex(x => x.id === p.id)
  if (idx >= 0) seleccionadas.value.splice(idx, 1)
  else seleccionadas.value.push({ ...p })
}
function seleccionarNivel() {
  preguntasFiltradas.value.forEach(p => { if (!estaSeleccionada(p.id)) seleccionadas.value.push({ ...p }) })
}
function limpiarSeleccion() { seleccionadas.value = [] }
function moverArriba(idx) {
  if (idx === 0) return
  const tmp = seleccionadas.value[idx - 1]
  seleccionadas.value[idx - 1] = seleccionadas.value[idx]
  seleccionadas.value[idx] = tmp
}
function moverAbajo(idx) {
  if (idx >= seleccionadas.value.length - 1) return
  const tmp = seleccionadas.value[idx + 1]
  seleccionadas.value[idx + 1] = seleccionadas.value[idx]
  seleccionadas.value[idx] = tmp
}
function quitarPregunta(idx) { seleccionadas.value.splice(idx, 1) }

async function crearSala() {
  errorSala.value = ''
  cargandoSala.value = true
  stateRaw.participantes = []
  if (!state.socket?.connected) {
    cargandoSala.value = false
    errorSala.value = 'Sin conexión con el servidor. Verifica que esté corriendo y recarga la página.'
    return
  }
  state.socket.timeout(8000).emit('admin:crear-sala', {
    token: sessionStorage.getItem('admin-token'),
    preguntaIds: seleccionadas.value.map(p => p.id),
    timerActivo: timerActivo.value,
    segundosPorPregunta: segundosPorPregunta.value
  }, (err, res) => {
    cargandoSala.value = false
    if (err) {
      errorSala.value = 'El servidor no respondió. Recarga la página (Ctrl+F5) e intenta de nuevo.'
      return
    }
    if (res.mensaje === 'No autorizado') {
      cerrarSesion()
      errorLogin.value = 'La sesión expiró. Ingresa la contraseña de nuevo.'
      return
    }
    if (res.ok) {
      codigoSalaActiva.value = res.codigo
      stateRaw.codigoSala = res.codigo
      stateRaw.rol = 'admin'
      stateRaw.salaCreada = res.codigo
      salaActiva.value = true
    } else {
      errorSala.value = res.mensaje || 'No se pudo crear la sala. Verifica la conexion.'
    }
  })
}
function iniciarQuiz() {
  state.socket.emit('admin:iniciar-quiz', {}, (res) => { if (res.ok) quizIniciado.value = true })
}
function siguientePregunta() {
  if (esUltimaPregunta.value) {
    state.socket.emit('admin:terminar-quiz', {}, (res) => { if (res.ok) quizTerminado.value = true })
  } else {
    state.socket.emit('admin:siguiente-pregunta', {})
  }
}
function terminarQuizForzado() {
  if (confirm('Seguro que quieres terminar el quiz ahora?')) {
    state.socket.emit('admin:terminar-quiz', {}, () => { quizTerminado.value = true })
  }
}
function toggleDetalle(id) { participanteDetalleId.value = participanteDetalleId.value === id ? null : id }
function estadoActual(p) {
  if (!preguntaActualMonitor.value) return 'esperando'
  const idx = (preguntaActualMonitor.value.numero || 1) - 1
  const r = (p.respuestas || [])[idx]
  if (!r) return 'esperando'
  return r.esCorrecta ? 'respondio-correcto' : 'respondio-incorrecto'
}
function nuevaSesion() {
  salaActiva.value = false; quizIniciado.value = false; quizTerminado.value = false
  codigoSalaActiva.value = ''; preguntaActualMonitor.value = null; participanteDetalleId.value = null
  seleccionadas.value = []; stateRaw.participantes = []; stateRaw.resultados = null; stateRaw.salaCreada = null
}
async function exportarExcel() {
  if (!state.resultados) return
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const encabezado = (textos) => textos.map(value => ({
    value, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#202C45'
  }))

  const resultados = [
    encabezado(['Posición', 'Nombre', 'Código estudiante', 'Correctas', 'Total preguntas', 'Bonus rapidez', 'Puntaje']),
    ...state.resultados.map((r, idx) => [
      { value: idx + 1 },
      { value: r.nombre },
      { value: String(r.codigoEstudiante) },
      { value: r.totalCorrectas },
      { value: r.totalPreguntas },
      { value: r.respuestas.reduce((a, x) => a + (x.bonus || 0), 0) },
      { value: r.puntaje, fontWeight: 'bold' }
    ])
  ]

  const detalle = [
    encabezado(['Nombre', 'Código estudiante', 'Pregunta', 'Enunciado', 'Respondió', 'Respuesta correcta', 'Resultado', 'Puntos base', 'Bonus rapidez', 'Puntos']),
    ...state.resultados.flatMap(r => r.respuestas.map((x, idx) => [
      { value: r.nombre },
      { value: String(r.codigoEstudiante) },
      { value: idx + 1 },
      { value: x.enunciado },
      { value: x.opcionDada || 'Sin respuesta' },
      { value: x.opcionCorrecta },
      { value: x.respuesta === null ? 'Sin respuesta' : x.esCorrecta ? 'Correcta' : 'Incorrecta' },
      { value: x.puntosBase || 0 },
      { value: x.bonus || 0 },
      { value: x.puntos || 0 }
    ]))
  ]

  await writeExcelFile([
    { data: resultados, sheet: 'Resultados', columns: [{ width: 10 }, { width: 28 }, { width: 18 }, { width: 11 }, { width: 15 }, { width: 14 }, { width: 10 }] },
    { data: detalle, sheet: 'Detalle', columns: [{ width: 28 }, { width: 18 }, { width: 10 }, { width: 50 }, { width: 28 }, { width: 28 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 8 }] }
  ]).toFile(`quiz-resultados-${codigoSalaActiva.value}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
</script>
<style scoped>
.admin-page { min-height: 100vh; background: var(--color-bg); }
.header-info { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.nombre-chip { background: rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.card-header-aceis { text-align: center; padding-bottom: 8px; }
.card-header-aceis h2 { color: var(--color-primary); font-size: 22px; }
.card-header-aceis p { color: var(--color-text-light); font-size: 14px; }
.seccion-titulo { margin-bottom: 20px; }
.seccion-titulo h2 { color: var(--color-primary); font-size: 22px; }
.seccion-titulo p { color: var(--color-text-light); }
.config-timer { margin-bottom: 16px; }
.timer-toggle { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.switch-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; }
.switch-input { display: none; }
.switch-track { width: 44px; height: 24px; background: var(--color-border); border-radius: 12px; position: relative; transition: background 0.2s; flex-shrink: 0; }
.switch-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: transform 0.2s; }
.switch-input:checked + .switch-track { background: var(--color-primary); }
.switch-input:checked + .switch-track::after { transform: translateX(20px); }
.timer-segundos { display: flex; align-items: center; gap: 8px; }
.filtros-card { margin-bottom: 16px; }
.filtros-row { display: flex; flex-direction: column; gap: 12px; }
.filtro-grupo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filtro-label { font-size: 13px; font-weight: 600; color: var(--color-text-light); min-width: 48px; }
.count-badge { background: var(--color-primary); color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; margin-left: 4px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .config-grid { grid-template-columns: 1fr; } }
.admin-page { min-height: 100vh; background: var(--color-bg); }
.header-info { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.nombre-chip { background: rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.card-header-aceis { text-align: center; padding-bottom: 8px; }
.card-header-aceis h2 { color: var(--color-primary); font-size: 22px; }
.card-header-aceis p { color: var(--color-text-light); font-size: 14px; }
.seccion-titulo { margin-bottom: 20px; }
.seccion-titulo h2 { color: var(--color-primary); font-size: 22px; }
.seccion-titulo p { color: var(--color-text-light); }
.config-timer { margin-bottom: 16px; }
.timer-toggle { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.switch-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; }
.switch-input { display: none; }
.switch-track { width: 44px; height: 24px; background: var(--color-border); border-radius: 12px; position: relative; transition: background 0.2s; flex-shrink: 0; }
.switch-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: transform 0.2s; }
.switch-input:checked + .switch-track { background: var(--color-primary); }
.switch-input:checked + .switch-track::after { transform: translateX(20px); }
.timer-segundos { display: flex; align-items: center; gap: 8px; }.filtros-card { margin-bottom: 16px; }
.filtros-row { display: flex; flex-direction: column; gap: 12px; }
.filtro-grupo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filtro-label { font-size: 13px; font-weight: 600; color: var(--color-text-light); min-width: 48px; }
.count-badge { background: var(--color-primary); color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; margin-left: 4px; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .config-grid { grid-template-columns: 1fr; } }
.preguntas-lista { max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.pregunta-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; }
.pregunta-item:hover { border-color: var(--color-primary); background: rgba(32,44,69,0.03); }
.pregunta-item.seleccionada { border-color: var(--color-primary); background: rgba(32,44,69,0.06); }
.pregunta-check { flex-shrink: 0; accent-color: var(--color-primary); width: 16px; height: 16px; cursor: pointer; }
.pregunta-preview { font-size: 13px; margin-bottom: 6px; }
.pregunta-meta { display: flex; gap: 4px; flex-wrap: wrap; }
.orden-num { width: 24px; height: 24px; border-radius: 50%; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.orden-controls { display: flex; gap: 4px; flex-shrink: 0; }
.btn-orden { width: 28px; height: 28px; border: 1px solid var(--color-border); background: white; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.btn-orden:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn-orden:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-quitar:hover:not(:disabled) { border-color: var(--color-error); color: var(--color-error); }
.seleccionadas-footer { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border); }
.total-puntos { font-size: 14px; color: var(--color-text-light); margin-bottom: 12px; }
.empty-state { text-align: center; padding: 40px; color: var(--color-text-light); }.sala-Código-card { text-align: center; }
.sala-Código-display { margin-bottom: 24px; }
.sala-Código-label { font-size: 13px; color: var(--color-text-light); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.sala-Código-valor { font-size: 56px; font-weight: 800; color: var(--color-primary); letter-spacing: 4px; }
.sala-Código-hint { font-size: 14px; color: var(--color-text-light); }
.sala-info { margin-bottom: 24px; }
.participantes-count { font-size: 16px; color: var(--color-text-light); }
.count-grande { font-size: 48px; font-weight: 800; color: var(--color-primary); display: block; }
.sala-acciones { display: flex; gap: 12px; justify-content: center; margin-bottom: 24px; flex-wrap: wrap; }
.participantes-espera { text-align: left; padding-top: 16px; border-top: 1px solid var(--color-border); }
.participantes-espera h4 { color: var(--color-text-light); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.participantes-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.participante-chip-admin { background: rgba(32,44,69,0.06); border: 1px solid rgba(32,44,69,0.2); padding: 6px 14px; border-radius: 20px; font-size: 14px; }
.participante-chip-admin .Código-est { font-size: 12px; color: var(--color-text-light); margin-left: 4px; }.monitor-control { display: flex; align-items: center; justify-content: space-between; background: var(--color-primary); color: white; padding: 16px 24px; border-radius: var(--radius-md); margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.control-info { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.sala-badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
.pregunta-info-control { font-weight: 600; }
.timer-monitor { display: flex; align-items: center; gap: 8px; min-width: 120px; }
.timer-bar-mini { flex: 1; height: 6px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
.timer-fill-mini { height: 100%; background: white; border-radius: 3px; transition: width 1s linear; }
.timer-fill-mini.urgente { background: #ff6b6b; }
.urgente-text { color: #ff6b6b; font-weight: 700; }
.control-botones { display: flex; gap: 8px; }
.monitor-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
.monitor-tabla th { background: var(--color-bg); padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-light); border-bottom: 2px solid var(--color-border); }
.monitor-tabla td { padding: 12px; border-bottom: 1px solid var(--color-border); }
.participante-row { cursor: pointer; transition: background 0.15s; }
.participante-row:hover { background: rgba(32,44,69,0.04); }
.participante-row.desconectado { opacity: 0.5; }
.desconectado-badge { background: var(--color-error-light); color: var(--color-error); font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
.estado-chip { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.estado-chip.correcto { background: var(--color-success-light); color: #155724; }
.estado-chip.incorrecto { background: var(--color-error-light); color: #721c24; }
.estado-chip.esperando { background: #FFF3CD; color: #856404; }
.td-Código { color: var(--color-text-light); font-size: 13px; }
.detalle-card { margin-bottom: 16px; }
.detalle-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.detalle-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
.detalle-tabla th { padding: 8px; border-bottom: 2px solid var(--color-border); text-align: left; font-size: 11px; text-transform: uppercase; color: var(--color-text-light); }
.detalle-tabla td { padding: 8px; border-bottom: 1px solid var(--color-border); }
.fila-ok { background: rgba(39,174,96,0.05); }
.fila-mal { background: rgba(231,76,60,0.05); }
.td-enunciado-corto { max-width: 200px; font-size: 12px; color: var(--color-text-light); }
.resultados-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.resultados-header h3 { font-size: 18px; color: var(--color-primary); }
.medalla-0 { color: #C99500; }
.medalla-1 { color: #8A94A6; }
.medalla-2 { color: #B8651B; }
.primer-lugar { background: rgba(255,215,0,0.1); font-weight: 700; }
</style>