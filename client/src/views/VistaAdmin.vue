<template>
  <div class="admin-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.png" alt="ACEIS" class="logo" />
      <h1>Hello World · Admin</h1>
      <div class="header-info" v-if="autenticado">
        <button class="btn btn-sm btn-secondary" @click="cerrarSesion()">Cerrar sesión</button>
      </div>
    </header>

    <!-- Login -->
    <div v-if="!autenticado" class="container-sm" style="padding-top: 80px;">
      <div class="card fade-in">
        <div class="card-header-aceis">
          <h2><Icon name="lock" :size="22" /> Acceso Administrador</h2>
          <p>Ingresa la contraseña para gestionar la competencia</p>
        </div>
        <form @submit.prevent="iniciarSesion" style="margin-top: 24px;">
          <div class="form-group">
            <label>Contraseña</label>
            <input v-model="password" type="password" class="form-control" placeholder="Contraseña admin" required autofocus />
          </div>
          <div v-if="errorLogin" class="alert alert-error">{{ errorLogin }}</div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="cargandoLogin">
            {{ cargandoLogin ? 'Verificando...' : 'Entrar' }}
          </button>
        </form>
        <div style="text-align:center; margin-top:16px;">
          <router-link to="/" class="texto-suave" style="font-size:13px;"><Icon name="arrow-left" :size="14" /> Volver al inicio</router-link>
        </div>
      </div>
    </div>

    <!-- Configuración de una nueva competencia -->
    <div v-else-if="!comp" class="container ancho" style="padding-top: 24px;">
      <div class="seccion-titulo">
        <div>
          <h2>Nueva competencia</h2>
          <p>Elige las preguntas y los retos. A cada estudiante le saldrán mezclados en un orden distinto, cada uno con su propio tiempo.</p>
        </div>
        <div class="motor-chip" :class="motor ? (motor.ok ? 'ok' : 'mal') : ''">
          <Icon name="cpu" :size="16" />
          <template v-if="!motor">Revisando motor...</template>
          <template v-else-if="motor.ok">Motor listo · Python {{ motor.lenguajes.python }} · C++ {{ motor.lenguajes.cpp }}</template>
          <template v-else>Motor no disponible</template>
          <button class="btn-link" @click="cargarMotor">Revisar</button>
        </div>
      </div>
      <div v-if="motor && !motor.ok && seleccionProblemas.length" class="alert alert-error">
        <strong>Piston no está listo:</strong> {{ motor.mensaje }}.
        Abre Docker Desktop y ejecuta <code>npm run piston:up</code> en la carpeta del proyecto (ver README).
      </div>

      <!-- Preguntas -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="lista-cabecera">
          <h3>Preguntas <span class="count-badge">{{ seleccionPreguntas.length }} / {{ bancoPreguntas.length }}</span></h3>
          <div class="lista-acciones">
            <button class="btn btn-sm btn-secondary" @click="seleccionarFiltradas">Seleccionar las {{ preguntasFiltradas.length }} visibles</button>
            <button class="btn btn-sm btn-secondary" @click="seleccionPreguntas = []">Limpiar</button>
          </div>
        </div>
        <div class="filtros">
          <select v-model="filtroNivel" class="form-control filtro">
            <option value="todos">Todos los niveles</option>
            <option v-for="n in ['facil', 'medio', 'dificil']" :key="n" :value="n">{{ nivelLabel(n) }}</option>
          </select>
          <select v-model="filtroTipo" class="form-control filtro">
            <option value="todos">Todos los tipos</option>
            <option v-for="t in ['SM', 'VF', 'IMP', 'ERR', 'COMP', 'DF']" :key="t" :value="t">{{ tipoLabel(t) }}</option>
          </select>
          <select v-model="filtroTema" class="form-control filtro filtro-tema">
            <option value="todos">Todos los temas</option>
            <option v-for="t in temas" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="items-lista">
          <label v-for="q in preguntasFiltradas" :key="q.id" class="item" :class="{ seleccionado: seleccionPreguntas.includes(q.id) }">
            <input type="checkbox" :value="q.id" v-model="seleccionPreguntas" />
            <div class="item-info">
              <div class="item-titulo">
                <span class="badge" :class="'badge-' + q.nivel">{{ nivelLabel(q.nivel) }}</span>
                <span class="badge badge-tipo">{{ tipoLabel(q.tipo) }}</span>
                <span class="badge badge-tipo">{{ q.puntos }} pts</span>
                <span class="badge badge-tiempo"><Icon name="clock" :size="11" /> {{ q.tiempoS }} s</span>
              </div>
              <div class="item-enunciado">{{ q.enunciado }}</div>
              <div class="item-tema" v-if="q.tema">{{ q.tema }}</div>
            </div>
          </label>
          <div v-if="preguntasFiltradas.length === 0" class="texto-suave" style="padding: 12px;">Ninguna pregunta coincide con los filtros.</div>
        </div>
      </div>

      <!-- Retos de programación -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="lista-cabecera">
          <h3>Retos de programación <span class="count-badge">{{ seleccionProblemas.length }} / {{ bancoProblemas.length }}</span></h3>
          <div class="lista-acciones">
            <button class="btn btn-sm btn-secondary" @click="seleccionProblemas = bancoProblemas.map(p => p.id)">Seleccionar todos</button>
            <button class="btn btn-sm btn-secondary" @click="seleccionProblemas = []">Limpiar</button>
          </div>
        </div>
        <div class="items-lista">
          <label v-for="p in bancoProblemas" :key="p.id" class="item" :class="{ seleccionado: seleccionProblemas.includes(p.id) }">
            <input type="checkbox" :value="p.id" v-model="seleccionProblemas" />
            <div class="item-info">
              <div class="item-titulo">
                <strong>{{ p.titulo }}</strong>
                <span class="badge" :class="'badge-' + p.nivel">{{ nivelLabel(p.nivel) }}</span>
                <span class="badge badge-tipo">{{ p.puntos }} pts</span>
                <span class="badge badge-tiempo"><Icon name="clock" :size="11" /> {{ p.tiempoMin }} min</span>
                <span class="badge badge-tema">{{ p.ejemplos.length }} ejemplo(s) + {{ p.pruebasOcultas }} ocultas</span>
              </div>
              <div class="item-enunciado">{{ p.enunciado }}</div>
              <div class="item-tema" v-if="p.tema">{{ p.tema }}</div>
            </div>
          </label>
        </div>
        <div v-if="seleccionProblemas.length" class="config-retos">
          <div class="config-campo">
            <label>Intentos fallidos por reto</label>
            <input v-model.number="intentosMax" type="number" min="0" max="20" class="form-control" />
            <small>0 = ilimitados</small>
          </div>
          <div class="config-campo">
            <label>Lenguajes permitidos</label>
            <div class="checks">
              <label><input type="checkbox" value="python" v-model="lenguajesSel" /> Python</label>
              <label><input type="checkbox" value="cpp" v-model="lenguajesSel" /> C++</label>
            </div>
          </div>
        </div>
      </div>

      <div class="card crear-footer">
        <span class="texto-suave">
          <strong>{{ seleccionPreguntas.length }}</strong> preguntas + <strong>{{ seleccionProblemas.length }}</strong> retos ·
          Puntos posibles: <strong>{{ puntosPosibles }}</strong> ·
          Tiempo máximo por estudiante: <strong>{{ formatoReloj(tiempoMaximoMs) }}</strong>
        </span>
        <button class="btn btn-primary btn-lg" :disabled="!puedeCrear || cargandoCrear" @click="crear">
          <Icon name="play" :size="18" /> {{ cargandoCrear ? 'Creando...' : 'Crear competencia' }}
        </button>
      </div>
      <div v-if="errorCrear" class="alert alert-error" style="margin-top: 12px;">{{ errorCrear }}</div>
    </div>

    <!-- Sala de espera -->
    <div v-else-if="comp.estado === 'esperando'" class="container" style="padding-top: 24px;">
      <div class="card texto-centro fade-in">
        <div class="codigo-label">Código para compartir con los estudiantes</div>
        <div class="codigo-valor">{{ comp.codigo }}</div>
        <div class="resumen-config">
          <span><Icon name="book" :size="14" /> {{ comp.preguntas.length }} preguntas</span>
          <span v-if="comp.problemas.length"><Icon name="code" :size="14" /> {{ comp.problemas.length }} retos</span>
          <span v-if="comp.problemas.length"><Icon name="alert-triangle" :size="14" /> {{ comp.intentosMax || '∞' }} intentos fallidos</span>
          <span v-if="comp.problemas.length">{{ comp.lenguajes.map(lenguajeLabel).join(' · ') }}</span>
        </div>
        <div class="count-grande">{{ comp.ranking.length }}</div>
        <div class="texto-suave">estudiantes conectados</div>
        <div class="sala-acciones">
          <button class="btn btn-success btn-lg" :disabled="comp.ranking.length === 0" @click="iniciar">
            <Icon name="play" :size="18" /> Iniciar competencia
          </button>
          <button class="btn btn-secondary" @click="nueva">Cancelar</button>
        </div>
        <div v-if="comp.ranking.length" class="participantes-chips">
          <span v-for="f in comp.ranking" :key="f.codigoEstudiante" class="chip-participante" :class="{ off: !f.conectado }">
            <strong>{{ f.nombre }}</strong> {{ f.codigoEstudiante }}
          </span>
        </div>
      </div>
    </div>

    <!-- Monitor en vivo y resultados -->
    <div v-else class="container ancho" style="padding-top: 24px;">
      <div class="monitor-barra">
        <div class="monitor-info">
          <span class="sala-badge">{{ comp.codigo }}</span>
          <span v-if="comp.estado === 'en-curso'" class="reloj-grande"><Icon name="clock" :size="20" /> {{ formatoReloj(transcurridoMs) }}</span>
          <span v-else class="reloj-grande"><Icon name="trophy" :size="20" /> Competencia terminada</span>
          <span class="dato"><Icon name="users" :size="15" /> {{ conectados }} / {{ comp.ranking.length }} conectados</span>
          <span class="dato"><Icon name="check-circle" :size="15" /> {{ terminaron }} terminaron</span>
          <span v-if="comp.problemas.length" class="dato"><Icon name="send" :size="15" /> {{ comp.totalEnvios }} envíos</span>
          <span v-if="comp.cola.enEspera > 0" class="dato"><Icon name="cpu" :size="15" /> {{ comp.cola.enEspera }} en cola</span>
        </div>
        <div class="monitor-botones">
          <button v-if="comp.estado === 'en-curso'" class="btn btn-sm btn-danger" @click="terminar"><Icon name="square" :size="14" /> Terminar</button>
          <template v-else>
            <button class="btn btn-sm btn-success" @click="exportarExcel"><Icon name="download" :size="14" /> Exportar Excel</button>
            <button class="btn btn-sm btn-secondary" @click="nueva">Nueva competencia</button>
          </template>
        </div>
      </div>

      <div v-if="comp.estado === 'terminado' && comp.ranking.length" class="card fade-in" style="margin-bottom: 16px;">
        <Podio :resultados="resultadosPodio" />
      </div>

      <div class="monitor-grid" :class="{ 'sin-feed': !comp.problemas.length }">
        <div class="card tabla-card">
          <h3 class="tabla-titulo">Ranking en vivo</h3>
          <div class="tabla-scroll">
            <table class="tabla-ranking">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Estudiante</th>
                  <th>Progreso</th>
                  <th v-if="comp.preguntas.length" class="th-centro">Preguntas<small>{{ comp.preguntas.length }}</small></th>
                  <th v-for="(p, i) in comp.problemas" :key="p.id" class="th-centro" :title="p.titulo">R{{ i + 1 }}<small>{{ p.puntos }}</small></th>
                  <th>Puntos</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in comp.ranking" :key="f.codigoEstudiante" :class="{ off: !f.conectado && comp.estado === 'en-curso' }">
                  <td class="td-pos">
                    <Icon v-if="comp.estado === 'terminado' && f.posicion <= 3" name="medal" :size="18" :class="'medalla-' + f.posicion" />
                    <template v-else>{{ f.posicion }}</template>
                  </td>
                  <td class="td-nombre">
                    <div>{{ f.nombre }}</div>
                    <div class="sub">
                      {{ f.codigoEstudiante }}
                      <span v-if="!f.conectado && comp.estado === 'en-curso'" class="tag tag-off">desconectado</span>
                      <span v-if="f.salidasPestana" class="tag tag-aviso" :title="'Salió de la pestaña ' + f.salidasPestana + ' veces'">
                        <Icon name="eye-off" :size="11" /> {{ f.salidasPestana }}
                      </span>
                    </div>
                  </td>
                  <td class="td-progreso">
                    <span v-if="f.progreso.terminado" class="tag tag-ok"><Icon name="check" :size="11" /> terminó</span>
                    <template v-else>{{ f.progreso.actual }} / {{ f.progreso.total }}</template>
                  </td>
                  <td v-if="comp.preguntas.length" class="celda">
                    <div class="celda-puntos">{{ f.preguntas.puntos }}</div>
                    <div class="celda-sub">✓{{ f.preguntas.correctas }} de {{ f.preguntas.total }}</div>
                  </td>
                  <td v-for="p in comp.problemas" :key="p.id" class="celda" :class="claseCelda(f.problemas[p.id])">
                    <template v-if="f.problemas[p.id] && f.problemas[p.id].envios > 0">
                      <div class="celda-puntos">
                        <Icon v-if="f.problemas[p.id].aceptado" name="check" :size="13" />
                        <Icon v-else-if="f.problemas[p.id].bloqueado" name="lock" :size="12" />
                        {{ f.problemas[p.id].puntos }}
                      </div>
                      <div class="celda-sub">
                        <template v-if="f.problemas[p.id].puntos > 0">{{ formatoReloj(f.problemas[p.id].tiempoMs) }}</template>
                        <template v-if="f.problemas[p.id].intentosFallidos"> · ✗{{ f.problemas[p.id].intentosFallidos }}</template>
                      </div>
                    </template>
                    <span v-else class="celda-vacia">—</span>
                  </td>
                  <td class="td-puntos">{{ f.puntos }}</td>
                  <td class="td-tiempo">{{ formatoReloj(f.tiempoTotalMs) }}</td>
                </tr>
                <tr v-if="comp.ranking.length === 0">
                  <td :colspan="comp.problemas.length + 6" class="celda-vacia" style="padding: 24px; text-align: center;">Aún no hay estudiantes</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="leyenda texto-suave">
            Progreso: ítem en el que va cada estudiante (todos tienen un orden distinto).
            <template v-if="comp.problemas.length"> Retos: puntos · minutos que tardó en lograr su mejor puntaje · ✗ intentos fallidos. Pasa el mouse sobre R1, R2… para ver el título.</template>
            <Icon name="eye-off" :size="12" /> = veces que salió de la pestaña. El desempate es por menor tiempo total.
          </p>
        </div>

        <div v-if="comp.problemas.length" class="card feed-card">
          <h3 class="tabla-titulo">Últimos envíos</h3>
          <div v-if="comp.enviosRecientes.length === 0" class="texto-suave" style="padding: 12px 0;">Todavía no hay envíos.</div>
          <div v-for="e in comp.enviosRecientes" :key="e.id" class="feed-item">
            <span class="feed-tiempo">{{ formatoReloj(e.tiempoMs) }}</span>
            <div class="feed-cuerpo">
              <div><strong>{{ e.nombre }}</strong> · {{ tituloProblema(e.problemaId) }} · {{ lenguajeLabel(e.lenguaje) }}</div>
              <span class="chip-veredicto" :class="veredictoInfo(e.veredicto).clase">
                {{ veredictoInfo(e.veredicto).texto }}<template v-if="e.veredicto !== 'COMPILACION'"> {{ e.pasadas }}/{{ e.total }}</template>
              </span>
              <span class="feed-puntos">+{{ e.puntos }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSocket } from '../composables/useSocket'
import Icon from '../components/Icon.vue'
import Podio from '../components/Podio.vue'
import { formatoReloj, nivelLabel, tipoLabel, lenguajeLabel, veredictoInfo } from '../utils/formato'

const { state } = useSocket()
const CLAVE_COMPETENCIA = 'competencia-admin-codigo'

const token = ref(leer(sessionStorage, 'admin-token'))
const autenticado = computed(() => !!token.value)
const password = ref('')
const errorLogin = ref('')
const cargandoLogin = ref(false)

const motor = ref(null)
const bancoPreguntas = ref([])
const bancoProblemas = ref([])
const seleccionPreguntas = ref([])
const seleccionProblemas = ref([])
const filtroNivel = ref('todos')
const filtroTipo = ref('todos')
const filtroTema = ref('todos')
const intentosMax = ref(3)
const lenguajesSel = ref(['python', 'cpp'])
const cargandoCrear = ref(false)
const errorCrear = ref('')

const comp = ref(null)
const offsetReloj = ref(0)
const ahora = ref(Date.now())
let reloj = null

function leer(storage, clave) {
  try { return storage.getItem(clave) } catch { return null }
}
function escribir(storage, clave, valor) {
  try { valor === null ? storage.removeItem(clave) : storage.setItem(clave, valor) } catch { /* ignorar */ }
}

const socket = () => state.socket
const tituloProblema = (id) => comp.value.problemas.find(p => p.id === id)?.titulo || id

// ---------- Selección ----------
const temas = computed(() => [...new Set(bancoPreguntas.value.map(q => q.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })))
const preguntasFiltradas = computed(() => bancoPreguntas.value.filter(q =>
  (filtroNivel.value === 'todos' || q.nivel === filtroNivel.value) &&
  (filtroTipo.value === 'todos' || q.tipo === filtroTipo.value) &&
  (filtroTema.value === 'todos' || q.tema === filtroTema.value)
))
function seleccionarFiltradas() {
  seleccionPreguntas.value = [...new Set([...seleccionPreguntas.value, ...preguntasFiltradas.value.map(q => q.id)])]
}
const preguntasElegidas = computed(() => bancoPreguntas.value.filter(q => seleccionPreguntas.value.includes(q.id)))
const problemasElegidos = computed(() => bancoProblemas.value.filter(p => seleccionProblemas.value.includes(p.id)))
// Máximo posible: puntos base + bonus si respondiera/resolviera al instante (0,1 pts por segundo del tiempo del ítem)
const BONUS_POR_SEGUNDO = 0.1
const puntosPosibles = computed(() =>
  preguntasElegidas.value.reduce((a, q) => a + q.puntos + Math.round(q.tiempoS * BONUS_POR_SEGUNDO), 0) +
  problemasElegidos.value.reduce((a, p) => a + p.puntos + Math.round(p.tiempoMin * 60 * BONUS_POR_SEGUNDO), 0)
)
const tiempoMaximoMs = computed(() =>
  preguntasElegidas.value.reduce((a, q) => a + q.tiempoS * 1000, 0) + problemasElegidos.value.reduce((a, p) => a + p.tiempoMin * 60000, 0)
)
const puedeCrear = computed(() =>
  preguntasElegidas.value.length + problemasElegidos.value.length > 0 && (problemasElegidos.value.length === 0 || lenguajesSel.value.length > 0)
)

// ---------- Monitor ----------
const transcurridoMs = computed(() => (comp.value?.inicio ? ahora.value + offsetReloj.value - comp.value.inicio : 0))
const conectados = computed(() => comp.value.ranking.filter(f => f.conectado).length)
const terminaron = computed(() => comp.value.ranking.filter(f => f.progreso.terminado).length)
const resultadosPodio = computed(() =>
  comp.value.ranking.map(f => ({ id: f.codigoEstudiante, nombre: f.nombre, codigoEstudiante: f.codigoEstudiante, puntaje: f.puntos }))
)

function claseCelda(e) {
  if (!e || e.envios === 0) return ''
  if (e.aceptado) return 'c-ok'
  if (e.bloqueado) return 'c-bloqueado'
  if (e.puntos > 0) return 'c-parcial'
  return 'c-fallo'
}

// ---------- Sesión ----------
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
      escribir(sessionStorage, 'admin-token', data.token)
      token.value = data.token
      password.value = ''
      await cargarDatos()
      reconectar()
    } else {
      errorLogin.value = data.mensaje || 'Contraseña incorrecta'
    }
  } catch {
    errorLogin.value = 'Error de conexión con el servidor'
  } finally {
    cargandoLogin.value = false
  }
}

function cerrarSesion(mensaje = '') {
  escribir(sessionStorage, 'admin-token', null)
  token.value = null
  errorLogin.value = mensaje
}

async function pedirApi(ruta) {
  const res = await fetch(ruta, { headers: { 'x-admin-token': token.value } })
  if (res.status === 401) {
    cerrarSesion('La sesión expiró (el servidor se reinició). Ingresa la contraseña de nuevo.')
    throw new Error('No autorizado')
  }
  return res.json()
}

async function cargarMotor() {
  motor.value = null
  try { motor.value = await pedirApi('/api/admin/motor') } catch (e) { motor.value = { ok: false, mensaje: e.message, lenguajes: {} } }
}

async function cargarDatos() {
  try {
    const banco = await pedirApi('/api/admin/banco')
    bancoPreguntas.value = banco.preguntas
    bancoProblemas.value = banco.problemas
    cargarMotor()
  } catch { /* cerrarSesion ya mostró el mensaje */ }
}

// ---------- Socket ----------
function aplicar(vista) {
  comp.value = vista
  offsetReloj.value = vista.ahora - Date.now()
}

function emitir(evento, datos = {}) {
  return new Promise((resolve) => {
    if (!socket()?.connected) return resolve({ ok: false, mensaje: 'Sin conexión con el servidor.' })
    socket().timeout(10000).emit(evento, datos, (err, res) => resolve(err ? { ok: false, mensaje: 'El servidor no respondió.' } : res))
  })
}

// Vuelve a tomar el control de la competencia activa (si recargó la página o se cayó la conexión)
async function reconectar() {
  const codigo = leer(sessionStorage, CLAVE_COMPETENCIA)
  if (!codigo || !token.value) return
  const res = await emitir('admin:competencia:reconectar', { token: token.value, codigo })
  if (res.ok) aplicar(res.competencia)
  else if (res.mensaje === 'No autorizado') cerrarSesion('La sesión expiró (el servidor se reinició). Ingresa la contraseña de nuevo.')
  else if (res.mensaje === 'La competencia ya no existe.') { escribir(sessionStorage, CLAVE_COMPETENCIA, null); comp.value = null }
}

async function crear() {
  errorCrear.value = ''
  cargandoCrear.value = true
  const res = await emitir('admin:competencia:crear', {
    token: token.value,
    preguntaIds: preguntasElegidas.value.map(q => q.id),
    problemaIds: problemasElegidos.value.map(p => p.id),
    intentosMax: intentosMax.value,
    lenguajes: lenguajesSel.value
  })
  cargandoCrear.value = false
  if (res.ok) {
    escribir(sessionStorage, CLAVE_COMPETENCIA, res.codigo)
    aplicar(res.competencia)
  } else if (res.mensaje === 'No autorizado') {
    cerrarSesion('La sesión expiró. Ingresa la contraseña de nuevo.')
  } else {
    errorCrear.value = res.mensaje || 'No se pudo crear la competencia.'
  }
}

async function iniciar() {
  if (comp.value.problemas.length && motor.value && !motor.value.ok &&
      !confirm('El motor de ejecución no está listo. Los estudiantes no podrán probar ni enviar código en los retos. ¿Iniciar de todas formas?')) return
  const res = await emitir('admin:competencia:iniciar')
  if (!res.ok) alert(res.mensaje || 'No se pudo iniciar la competencia.')
}

async function terminar() {
  if (!confirm('¿Terminar la competencia ahora para todos? Los estudiantes ya no podrán responder ni enviar.')) return
  await emitir('admin:competencia:terminar')
}

function nueva() {
  escribir(sessionStorage, CLAVE_COMPETENCIA, null)
  comp.value = null
  cargarMotor()
}

// ---------- Exportar a Excel ----------
async function exportarExcel() {
  const res = await emitir('admin:competencia:exportar')
  if (!res.ok) return alert('No se pudo obtener la información de la competencia.')
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const encabezado = (textos) => textos.map(value => ({ value, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#202C45' }))
  const retos = res.problemas.map((p, i) => `R${i + 1}. ${p.titulo}`)

  const ranking = [
    encabezado(['Posición', 'Nombre', 'Código estudiante', 'Puntos', 'Preguntas correctas', 'Puntos preguntas', 'Retos resueltos', 'Tiempo total (min:seg)', 'Intentos fallidos', 'Salidas de pestaña', ...retos]),
    ...res.ranking.map(f => [
      { value: f.posicion },
      { value: f.nombre },
      { value: String(f.codigoEstudiante) },
      { value: f.puntos, fontWeight: 'bold' },
      { value: `${f.preguntas.correctas}/${f.preguntas.total}` },
      { value: f.preguntas.puntos },
      { value: f.resueltos },
      { value: formatoReloj(f.tiempoTotalMs) },
      { value: f.intentosFallidos },
      { value: f.salidasPestana },
      ...res.problemas.map(p => ({ value: f.problemas[p.id]?.puntos || 0 }))
    ])
  ]

  const preguntas = [
    encabezado(['Nombre', 'Código estudiante', 'Pregunta', 'Nivel', 'Respondió', 'Respuesta correcta', 'Resultado', 'Segundos', 'Puntos base', 'Bonus tiempo', 'Puntos']),
    ...res.respuestas.flatMap(est => res.preguntas.map(q => {
      const r = est.respuestas[q.id]
      return [
        { value: est.nombre },
        { value: String(est.codigoEstudiante) },
        { value: q.enunciado.slice(0, 200) },
        { value: nivelLabel(q.nivel) },
        { value: r && r.respuesta !== null ? q.opciones[r.respuesta] : 'Sin respuesta' },
        { value: q.opciones[q.respuesta_correcta] },
        { value: !r || r.respuesta === null ? 'Sin respuesta' : r.esCorrecta ? 'Correcta' : 'Incorrecta' },
        { value: r && r.respuesta !== null ? Math.round(r.ms / 1000) : '' },
        { value: r?.puntosBase || 0 },
        { value: r?.bonus || 0 },
        { value: r?.puntos || 0 }
      ]
    }))
  ]

  const envios = [
    encabezado(['Minuto en el reto', 'Nombre', 'Código estudiante', 'Reto', 'Lenguaje', 'Veredicto', 'Pruebas ocultas', 'Puntos base', 'Bonus tiempo', 'Puntos', 'Mensaje', 'Código enviado']),
    ...res.envios.map(e => [
      { value: formatoReloj(e.tiempoMs) },
      { value: e.nombre },
      { value: String(e.codigoEstudiante) },
      { value: res.problemas.find(p => p.id === e.problemaId)?.titulo || e.problemaId },
      { value: lenguajeLabel(e.lenguaje) },
      { value: veredictoInfo(e.veredicto).texto },
      { value: `${e.pasadas}/${e.total}` },
      { value: e.puntosBase ?? e.puntos },
      { value: e.bonus || 0 },
      { value: e.puntos },
      { value: (e.mensaje || '').slice(0, 1000) },
      { value: (e.codigo || '').slice(0, 30000), wrap: true }
    ])
  ]

  const hojas = [
    { data: ranking, sheet: 'Ranking', columns: [{ width: 10 }, { width: 28 }, { width: 18 }, { width: 10 }, { width: 18 }, { width: 15 }, { width: 14 }, { width: 20 }, { width: 16 }, { width: 18 }, ...retos.map(() => ({ width: 22 }))] }
  ]
  if (res.preguntas.length) hojas.push({ data: preguntas, sheet: 'Preguntas', columns: [{ width: 26 }, { width: 18 }, { width: 50 }, { width: 10 }, { width: 28 }, { width: 28 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 8 }] })
  if (res.problemas.length) hojas.push({ data: envios, sheet: 'Envíos', columns: [{ width: 16 }, { width: 26 }, { width: 18 }, { width: 28 }, { width: 10 }, { width: 22 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 8 }, { width: 40 }, { width: 70 }] })

  await writeExcelFile(hojas).toFile(`competencia-${comp.value.codigo}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ---------- Ciclo de vida ----------
function alEstado(vista) {
  if (comp.value && vista.codigo === comp.value.codigo) aplicar(vista)
}
function alReconectar() {
  if (comp.value) reconectar()
}

onMounted(() => {
  reloj = setInterval(() => { ahora.value = Date.now() }, 1000)
  socket()?.on('competencia:admin-estado', alEstado)
  socket()?.on('connect', alReconectar)
  if (token.value) {
    cargarDatos()
    reconectar()
  }
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  socket()?.off('competencia:admin-estado', alEstado)
  socket()?.off('connect', alReconectar)
})
</script>

<style scoped>
.admin-page { min-height: 100vh; background: var(--color-bg); }
.ancho { max-width: 1280px; }
.header-info { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.card-header-aceis { text-align: center; padding-bottom: 8px; }
.card-header-aceis h2 { color: var(--color-primary); font-size: 22px; }
.card-header-aceis p { color: var(--color-text-light); font-size: 14px; }
.texto-suave { color: var(--color-text-light); }
.texto-centro { text-align: center; }

.seccion-titulo { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.seccion-titulo h2 { color: var(--color-primary); font-size: 22px; }
.seccion-titulo p { color: var(--color-text-light); max-width: 680px; }
.motor-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #E9EDF5; color: var(--color-primary); }
.motor-chip.ok { background: var(--color-success-light); color: var(--color-success); }
.motor-chip.mal { background: var(--color-error-light); color: var(--color-error); }
.btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; font-family: inherit; font-size: 12px; }
code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px; font-size: 13px; }

.lista-cabecera { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.lista-cabecera h3 { color: var(--color-primary); }
.lista-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
.count-badge { background: var(--color-primary); color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; margin-left: 4px; }
.filtros { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.filtro { width: auto; padding: 6px 10px; font-size: 13px; }
.filtro-tema { min-width: 240px; max-width: 100%; }
.items-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 10px; max-height: 460px; overflow-y: auto; padding: 2px; }
@media (max-width: 480px) { .items-lista { grid-template-columns: 1fr; } }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.item:hover { border-color: var(--color-primary-light); }
.item.seleccionado { border-color: var(--color-primary); background: rgba(32,44,69,0.04); }
.item input { margin-top: 4px; accent-color: var(--color-primary); width: 16px; height: 16px; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-titulo { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
/* Vista previa en 2 líneas; al pasar el mouse se ve completa */
.item-enunciado { font-size: 13px; color: var(--color-text-light); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
.item:hover .item-enunciado { display: block; overflow: visible; }
.item-tema { font-size: 12px; color: var(--color-text-light); margin-top: 4px; font-style: italic; }
.badge-tema { background: #F1F3F8; color: var(--color-text-light); font-weight: 500; text-transform: none; letter-spacing: 0; }
.badge-tiempo { background: #E9EDF5; color: var(--color-primary); display: inline-flex; align-items: center; gap: 3px; }

.config-retos { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border); }
.config-campo { display: flex; flex-direction: column; gap: 6px; }
.config-campo label { font-weight: 600; font-size: 14px; }
.config-campo .form-control { width: 140px; }
.config-campo small { color: var(--color-text-light); font-size: 12px; }
.checks { display: flex; gap: 16px; padding-top: 10px; }
.checks label { display: inline-flex; gap: 6px; align-items: center; font-weight: 500; cursor: pointer; }
.checks input { accent-color: var(--color-primary); width: 16px; height: 16px; }
.crear-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; position: sticky; bottom: 12px; box-shadow: var(--shadow-md); }

.codigo-label { font-size: 13px; color: var(--color-text-light); text-transform: uppercase; letter-spacing: 1px; }
.codigo-valor { font-size: 56px; font-weight: 800; color: var(--color-primary); letter-spacing: 4px; }
.resumen-config { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin: 12px 0 20px; font-size: 14px; color: var(--color-text-light); }
.resumen-config span { display: inline-flex; align-items: center; gap: 4px; }
.count-grande { font-size: 48px; font-weight: 800; color: var(--color-primary); line-height: 1.1; }
.sala-acciones { display: flex; gap: 12px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }
.participantes-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding-top: 16px; border-top: 1px solid var(--color-border); }
.chip-participante { background: rgba(32,44,69,0.06); border: 1px solid rgba(32,44,69,0.2); padding: 5px 12px; border-radius: 20px; font-size: 13px; color: var(--color-text-light); }
.chip-participante strong { color: var(--color-text); }
.chip-participante.off { opacity: 0.5; }

.monitor-barra { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--color-primary); color: white; padding: 14px 20px; border-radius: var(--radius-md); margin-bottom: 16px; }
.monitor-info { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.sala-badge { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
.reloj-grande { display: inline-flex; align-items: center; gap: 8px; font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.dato { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; opacity: 0.9; }
.monitor-botones { display: flex; gap: 8px; flex-wrap: wrap; }

.monitor-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.monitor-grid.sin-feed { grid-template-columns: 1fr; }
@media (max-width: 1000px) { .monitor-grid { grid-template-columns: 1fr; } }
.tabla-titulo { font-size: 16px; color: var(--color-primary); margin-bottom: 12px; }
.tabla-scroll { overflow-x: auto; }
.tabla-ranking { width: 100%; border-collapse: collapse; font-size: 14px; }
.tabla-ranking th { background: var(--color-bg); padding: 8px 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-light); border-bottom: 2px solid var(--color-border); white-space: nowrap; }
.th-centro { text-align: center !important; }
.th-centro small { display: block; font-size: 10px; font-weight: 400; }
.tabla-ranking td { padding: 8px 10px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.tabla-ranking tr.off { opacity: 0.55; }
.td-pos { font-weight: 700; width: 36px; }
.td-nombre { min-width: 160px; }
.td-nombre .sub { font-size: 12px; color: var(--color-text-light); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.td-progreso { white-space: nowrap; font-variant-numeric: tabular-nums; }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; }
.tag-off { background: var(--color-error-light); color: var(--color-error); }
.tag-aviso { background: #FFF3CD; color: #856404; }
.tag-ok { background: var(--color-success-light); color: var(--color-success); font-weight: 700; }
.celda { text-align: center; min-width: 72px; border-left: 1px solid var(--color-border); }
.celda-puntos { font-weight: 800; display: inline-flex; align-items: center; gap: 3px; }
.celda-sub { font-size: 11px; opacity: 0.85; white-space: nowrap; }
.celda-vacia { color: #B8C0CE; }
.c-ok { background: var(--color-success-light); color: var(--color-success); }
.c-parcial { background: #FFF8E1; color: #856404; }
.c-fallo { background: #FDF1F0; color: var(--color-error); }
.c-bloqueado { background: var(--color-error-light); color: var(--color-error); }
.td-puntos { font-weight: 800; font-size: 16px; color: var(--color-primary); }
.td-tiempo { font-variant-numeric: tabular-nums; color: var(--color-text-light); }
.medalla-1 { color: #C99500; }
.medalla-2 { color: #8A94A6; }
.medalla-3 { color: #B8651B; }
.leyenda { font-size: 12px; margin-top: 10px; }

.feed-card { max-height: 640px; overflow-y: auto; }
.feed-item { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-border); font-size: 13px; }
.feed-item:last-child { border-bottom: none; }
.feed-tiempo { font-variant-numeric: tabular-nums; color: var(--color-text-light); min-width: 40px; }
.feed-cuerpo { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.feed-cuerpo > div { width: 100%; }
.feed-puntos { margin-left: auto; font-weight: 800; color: var(--color-primary); }
.chip-veredicto { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
.v-aceptado { background: var(--color-success-light); color: var(--color-success); }
.v-parcial { background: #FFF3CD; color: #856404; }
.v-error { background: var(--color-error-light); color: var(--color-error); }
.v-compilacion { background: #E9EDF5; color: var(--color-primary); }
</style>
