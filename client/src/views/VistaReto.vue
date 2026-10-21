<template>
  <div class="reto-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.png" alt="ACEIS" class="logo" />
      <h1>Reto de programación</h1>
      <div v-if="reto" class="header-derecha">
        <div v-if="reto.estado === 'en-curso'" class="chip-header reloj" :class="{ urgente: restanteMs < 5 * 60000 }">
          <Icon name="clock" :size="16" /> {{ formatoReloj(restanteMs) }}
        </div>
        <div class="chip-header"><Icon name="trophy" :size="16" /> {{ reto.misPuntos }} pts</div>
        <span class="chip-header nombre">{{ reto.nombre }}</span>
      </div>
    </header>

    <!-- Cargando o error al reconectar -->
    <div v-if="!reto" class="container-sm centrado">
      <div v-if="errorInicio" class="card fade-in">
        <div class="alert alert-error">{{ errorInicio }}</div>
        <button class="btn btn-primary btn-block" @click="volverInicio"><Icon name="arrow-left" :size="16" /> Volver al inicio</button>
      </div>
      <div v-else class="cargando">
        <div class="spinner"></div>
        <p>Conectando con el reto...</p>
      </div>
    </div>

    <!-- Abierto en otra pestaña -->
    <div v-else-if="estado.reemplazada" class="container-sm centrado">
      <div class="card fade-in texto-centro">
        <Icon name="alert-triangle" :size="36" class="icono-aviso" />
        <h2>Abriste el reto en otra pestaña</h2>
        <p class="texto-suave">Solo una pestaña puede estar activa a la vez.</p>
        <button class="btn btn-primary btn-block" style="margin-top: 16px;" @click="reingresar">Continuar en esta pestaña</button>
      </div>
    </div>

    <!-- Sala de espera -->
    <div v-else-if="reto.estado === 'esperando'" class="container-sm" style="padding-top: 40px;">
      <div class="card fade-in">
        <div class="texto-centro">
          <div class="icono-grande"><Icon name="code" :size="34" /></div>
          <h2>¡Ya estás dentro, {{ reto.nombre }}!</h2>
          <p class="texto-suave">Espera a que el profesor inicie el reto. Los problemas aparecerán aquí automáticamente.</p>
          <div class="espera-puntos"><span></span><span></span><span></span></div>
        </div>
        <ul class="reglas">
          <li><Icon name="clock" :size="16" /> Duración: <strong>{{ Math.round(reto.duracionMs / 60000) }} minutos</strong>.</li>
          <li><Icon name="code" :size="16" /> Lenguajes: <strong>{{ reto.lenguajes.map(lenguajeLabel).join(' o ') }}</strong>.</li>
          <li><Icon name="play" :size="16" /> <strong>Probar</strong> ejecuta tu código con los ejemplos. Úsalo cuantas veces quieras.</li>
          <li><Icon name="send" :size="16" /> <strong>Enviar</strong> califica tu código con pruebas ocultas. Ganas puntos según las pruebas que pases.</li>
          <li v-if="reto.intentosMax > 0"><Icon name="alert-triangle" :size="16" /> Tienes <strong>{{ reto.intentosMax }} intentos fallidos</strong> por problema. Los errores de compilación no cuentan.</li>
          <li><Icon name="trophy" :size="16" /> Si hay empate en puntos, gana quien lo logró en <strong>menos tiempo</strong>.</li>
        </ul>
      </div>
    </div>

    <!-- Reto en curso -->
    <div v-else-if="reto.estado === 'en-curso'" class="reto-layout">
      <nav class="problemas-tabs">
        <button
          v-for="(p, idx) in problemas"
          :key="p.id"
          class="tab-problema"
          :class="['estado-' + estadoProblema(p.id), { activo: problemaActivo && p.id === problemaActivo.id }]"
          @click="problemaActivoId = p.id"
        >
          <span class="tab-letra">{{ letra(idx) }}</span>
          <span class="tab-texto">
            <span class="tab-titulo">{{ p.titulo }}</span>
            <span class="tab-meta">{{ reto.miEstado[p.id]?.puntos || 0 }} / {{ p.puntos }} pts</span>
          </span>
          <Icon v-if="estadoProblema(p.id) === 'aceptado'" name="check-circle" :size="16" />
          <Icon v-else-if="estadoProblema(p.id) === 'bloqueado'" name="lock" :size="16" />
        </button>
      </nav>

      <div v-if="problemaActivo" class="reto-grid">
        <!-- Enunciado -->
        <section class="card panel-enunciado">
          <div class="enunciado-cabecera">
            <h2>{{ letra(indiceActivo) }}. {{ problemaActivo.titulo }}</h2>
            <div class="badges">
              <span class="badge" :class="'badge-' + problemaActivo.nivel">{{ nivelLabel(problemaActivo.nivel) }}</span>
              <span class="badge badge-tipo">{{ problemaActivo.puntos }} pts</span>
              <span class="badge badge-tipo">{{ problemaActivo.totalPruebas }} pruebas</span>
            </div>
            <p v-if="problemaActivo.tema" class="tema">{{ problemaActivo.tema }}</p>
          </div>

          <p class="enunciado">{{ problemaActivo.enunciado }}</p>

          <h4>Entrada</h4>
          <p class="enunciado">{{ problemaActivo.formato_entrada }}</p>
          <h4>Salida</h4>
          <p class="enunciado">{{ problemaActivo.formato_salida }}</p>

          <h4>Ejemplos</h4>
          <div v-for="(ej, i) in problemaActivo.ejemplos" :key="i" class="ejemplo">
            <div>
              <div class="ejemplo-label">Entrada</div>
              <pre>{{ ej.entrada }}</pre>
            </div>
            <div>
              <div class="ejemplo-label">Salida esperada</div>
              <pre>{{ ej.salida }}</pre>
            </div>
          </div>

          <div class="nota-pruebas">
            <Icon name="eye-off" :size="16" />
            <span>Al <strong>Enviar</strong>, tu código se califica con {{ problemaActivo.totalPruebas }} pruebas (incluye pruebas ocultas). Un programa que solo imprime el resultado del ejemplo no pasará las demás.</span>
          </div>
        </section>

        <!-- Editor y consola -->
        <section class="panel-trabajo">
          <div class="card editor-card">
            <div class="editor-toolbar">
              <select v-if="reto.lenguajes.length > 1" v-model="lenguaje" class="form-control select-lenguaje">
                <option v-for="l in reto.lenguajes" :key="l" :value="l">{{ lenguajeLabel(l) }}</option>
              </select>
              <span v-else class="badge badge-tipo">{{ lenguajeLabel(lenguaje) }}</span>

              <span class="estado-problema" :class="'estado-' + estadoProblema(problemaActivo.id)">
                <template v-if="miEstadoActivo?.aceptado"><Icon name="check-circle" :size="14" /> Resuelto</template>
                <template v-else-if="miEstadoActivo?.bloqueado"><Icon name="lock" :size="14" /> Sin intentos</template>
                <template v-else-if="reto.intentosMax > 0">Intentos fallidos: {{ miEstadoActivo?.intentosFallidos || 0 }} / {{ reto.intentosMax }}</template>
              </span>

              <button class="btn btn-sm btn-secondary btn-plantilla" @click="restaurarPlantilla" title="Volver al código inicial">
                <Icon name="rotate-ccw" :size="14" /> Plantilla
              </button>
            </div>

            <div class="editor-wrap">
              <EditorCodigo v-model="codigoActual" :lenguaje="lenguaje" />
            </div>

            <div class="editor-acciones">
              <span class="texto-suave ayuda-acciones">Probar no gasta intentos. Enviar sí califica.</span>
              <button class="btn btn-secondary" :disabled="!!ocupado || restanteMs <= 0" @click="probar(false)">
                <Icon name="play" :size="16" /> Probar
              </button>
              <button class="btn btn-primary" :disabled="!puedeEnviar" @click="enviar">
                <Icon name="send" :size="16" /> Enviar
              </button>
            </div>
          </div>

          <div class="card consola">
            <div class="consola-tabs">
              <button :class="{ activo: pestanaConsola === 'resultado' }" @click="pestanaConsola = 'resultado'"><Icon name="terminal" :size="14" /> Resultado</button>
              <button :class="{ activo: pestanaConsola === 'personalizada' }" @click="pestanaConsola = 'personalizada'"><Icon name="code" :size="14" /> Mi propia entrada</button>
              <button :class="{ activo: pestanaConsola === 'envios' }" @click="pestanaConsola = 'envios'">
                <Icon name="send" :size="14" /> Mis envíos <span v-if="enviosActivo.length" class="contador">{{ enviosActivo.length }}</span>
              </button>
            </div>

            <div class="consola-cuerpo">
              <!-- Ejecutando -->
              <div v-if="ocupado && pestanaConsola !== 'envios'" class="ejecutando">
                <div class="spinner spinner-sm"></div>
                <span v-if="estado.cola && estado.cola.posicion > 0">En cola: hay {{ estado.cola.posicion }} {{ estado.cola.posicion === 1 ? 'envío' : 'envíos' }} antes que el tuyo...</span>
                <span v-else>{{ ocupado === 'enviar' ? 'Calificando con todas las pruebas...' : 'Ejecutando tu código...' }}</span>
              </div>

              <template v-else-if="pestanaConsola === 'resultado'">
                <div v-if="mensajeError" class="alert alert-error">{{ mensajeError }}</div>
                <div v-if="!accionActiva" class="vacio texto-suave">Pulsa <strong>Probar</strong> para ver qué imprime tu código con los ejemplos.</div>

                <!-- Resultado de un envío -->
                <div v-else-if="accionActiva.tipo === 'envio'" class="resultado-envio fade-in">
                  <div class="veredicto" :class="veredictoInfo(accionActiva.datos.veredicto).clase">
                    <Icon :name="veredictoInfo(accionActiva.datos.veredicto).icono" :size="22" />
                    <div>
                      <strong>{{ veredictoInfo(accionActiva.datos.veredicto).texto }}</strong>
                      <span v-if="accionActiva.datos.veredicto !== 'COMPILACION'"> · {{ accionActiva.datos.pasadas }} de {{ accionActiva.datos.total }} pruebas correctas</span>
                    </div>
                    <span class="veredicto-puntos">+{{ accionActiva.datos.puntos }} pts</span>
                  </div>
                  <div class="barra-pruebas">
                    <span v-for="i in accionActiva.datos.total" :key="i" :class="{ ok: i <= accionActiva.datos.pasadas }"></span>
                  </div>
                  <p v-if="accionActiva.datos.veredicto === 'PARCIAL'" class="texto-suave">Tu programa falla en algunos casos. Revisa los casos límite: negativos, cero, números grandes...</p>
                  <pre v-if="accionActiva.datos.mensaje" class="salida-error">{{ accionActiva.datos.mensaje }}</pre>
                  <p v-if="miEstadoActivo?.bloqueado" class="alert alert-error" style="margin-top: 10px;">Agotaste tus intentos en este problema. Se conserva tu mejor puntaje: {{ miEstadoActivo.puntos }} pts.</p>
                </div>

                <!-- Resultado de probar con ejemplos -->
                <div v-else class="fade-in">
                  <pre v-if="accionActiva.datos.compilacion" class="salida-error"><strong>Error de compilación</strong>
{{ accionActiva.datos.compilacion }}</pre>
                  <div v-for="(c, i) in accionActiva.datos.casos" :key="i" class="caso" :class="c.ok ? 'caso-ok' : 'caso-mal'">
                    <div class="caso-titulo">
                      <Icon :name="c.ok ? 'check-circle' : 'x-circle'" :size="16" />
                      Ejemplo {{ i + 1 }}: {{ c.ok ? 'correcto' : (c.estado === 'OK' ? 'salida diferente' : estadoTexto(c.estado)) }}
                      <span class="caso-ms">{{ c.ms }} ms</span>
                    </div>
                    <div class="caso-columnas">
                      <div><div class="ejemplo-label">Entrada</div><pre>{{ c.entrada }}</pre></div>
                      <div><div class="ejemplo-label">Esperada</div><pre>{{ c.esperada }}</pre></div>
                      <div><div class="ejemplo-label">Tu salida</div><pre>{{ c.obtenida || '(nada)' }}</pre></div>
                    </div>
                    <pre v-if="c.error" class="salida-error">{{ c.error }}</pre>
                  </div>
                </div>
              </template>

              <template v-else-if="pestanaConsola === 'personalizada'">
                <label class="ejemplo-label">Escribe una entrada para probar tu programa</label>
                <textarea v-model="entradaPersonalizada" class="form-control entrada-personalizada" rows="3" placeholder="Ej: 5 8" spellcheck="false"></textarea>
                <button class="btn btn-sm btn-secondary" :disabled="!!ocupado || restanteMs <= 0" @click="probar(true)" style="margin-top: 8px;">
                  <Icon name="play" :size="14" /> Ejecutar con esta entrada
                </button>
                <div v-if="mensajeError" class="alert alert-error" style="margin-top: 10px;">{{ mensajeError }}</div>
                <div v-if="resultadoPersonalizado" class="fade-in" style="margin-top: 12px;">
                  <pre v-if="resultadoPersonalizado.compilacion" class="salida-error"><strong>Error de compilación</strong>
{{ resultadoPersonalizado.compilacion }}</pre>
                  <template v-else-if="resultadoPersonalizado.casos[0]">
                    <div class="ejemplo-label">Tu salida ({{ resultadoPersonalizado.casos[0].ms }} ms)</div>
                    <pre>{{ resultadoPersonalizado.casos[0].obtenida || '(nada)' }}</pre>
                    <pre v-if="resultadoPersonalizado.casos[0].error" class="salida-error">{{ resultadoPersonalizado.casos[0].error }}</pre>
                  </template>
                </div>
              </template>

              <template v-else>
                <div v-if="enviosActivo.length === 0" class="vacio texto-suave">Aún no has enviado este problema.</div>
                <table v-else class="tabla-envios">
                  <thead><tr><th>Minuto</th><th>Lenguaje</th><th>Veredicto</th><th>Pruebas</th><th>Puntos</th></tr></thead>
                  <tbody>
                    <tr v-for="e in enviosActivo" :key="e.id">
                      <td>{{ formatoReloj(e.tiempoMs) }}</td>
                      <td>{{ lenguajeLabel(e.lenguaje) }}</td>
                      <td><span class="chip-veredicto" :class="veredictoInfo(e.veredicto).clase">{{ veredictoInfo(e.veredicto).texto }}</span></td>
                      <td>{{ e.veredicto === 'COMPILACION' ? '—' : e.pasadas + '/' + e.total }}</td>
                      <td><strong>{{ e.puntos }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Resultados finales -->
    <div v-else class="container resultados" style="padding-top: 32px;">
      <div class="card fade-in texto-centro hero-final">
        <Icon name="trophy" :size="40" class="icono-trofeo" />
        <h2>¡Reto terminado!</h2>
        <p v-if="reto.miPosicion" class="posicion-final">Quedaste en el puesto <strong>{{ reto.miPosicion }}</strong> de {{ reto.ranking.length }}</p>
        <div class="resumen-final">
          <div><span class="numero">{{ reto.misPuntos }}</span><span>puntos</span></div>
          <div><span class="numero">{{ resueltos }}/{{ problemas.length }}</span><span>problemas resueltos</span></div>
          <div><span class="numero">{{ formatoReloj(reto.miTiempoTotalMs) }}</span><span>tiempo (desempate)</span></div>
        </div>
      </div>

      <div v-if="reto.ranking && reto.ranking.length" class="card fade-in" style="margin-top: 16px;">
        <Podio :resultados="resultadosPodio" :mi-codigo="reto.codigoEstudiante" />
        <table class="tabla-ranking">
          <thead><tr><th>#</th><th>Nombre</th><th>Puntos</th><th>Resueltos</th><th>Tiempo</th></tr></thead>
          <tbody>
            <tr v-for="f in reto.ranking" :key="f.codigoEstudiante" :class="{ yo: f.codigoEstudiante === reto.codigoEstudiante }">
              <td>{{ f.posicion }}</td>
              <td>{{ f.nombre }}<span v-if="f.codigoEstudiante === reto.codigoEstudiante" class="texto-suave"> (tú)</span></td>
              <td><strong>{{ f.puntos }}</strong></td>
              <td>{{ f.resueltos }}</td>
              <td>{{ formatoReloj(f.tiempoTotalMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card fade-in" style="margin-top: 16px;">
        <h3 style="margin-bottom: 12px;">Tus problemas</h3>
        <div v-for="(p, idx) in problemas" :key="p.id" class="fila-mis-problemas">
          <span class="tab-letra" :class="'estado-' + estadoProblema(p.id)">{{ letra(idx) }}</span>
          <span class="flex-1">{{ p.titulo }}</span>
          <span class="texto-suave">{{ reto.miEstado[p.id]?.envios || 0 }} envíos</span>
          <strong>{{ reto.miEstado[p.id]?.puntos || 0 }} / {{ p.puntos }} pts</strong>
        </div>
      </div>

      <div class="texto-centro" style="margin: 24px 0;">
        <button class="btn btn-primary" @click="volverInicio"><Icon name="arrow-left" :size="16" /> Salir</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useReto } from '../composables/useReto'
import Icon from '../components/Icon.vue'
import Podio from '../components/Podio.vue'
import EditorCodigo from '../components/EditorCodigo.vue'
import { formatoReloj, nivelLabel, lenguajeLabel, veredictoInfo } from '../utils/formato'

const router = useRouter()
const { estado, leerSesion, reingresar, salir, pedir, avisarFoco } = useReto()

const reto = computed(() => estado.reto)
const problemas = computed(() => reto.value?.problemas || [])
const problemaActivoId = ref(null)
const codigos = ref({})              // "P01:python" -> código
const lenguajes = ref({})            // "P01" -> 'python' | 'cpp'
const acciones = ref({})             // "P01" -> { tipo: 'prueba' | 'envio', datos }
const resultadoPersonalizado = ref(null)
const entradaPersonalizada = ref('')
const pestanaConsola = ref('resultado')
const ocupado = ref(null)            // null | 'probar' | 'personalizada' | 'enviar'
const mensajeError = ref('')
const errorInicio = ref('')
const ahora = ref(Date.now())
let reloj = null

// ---------- Problema activo ----------
watch(problemas, (lista) => {
  if (lista.length && !lista.some(p => p.id === problemaActivoId.value)) problemaActivoId.value = lista[0].id
}, { immediate: true })

const problemaActivo = computed(() => problemas.value.find(p => p.id === problemaActivoId.value) || null)
const indiceActivo = computed(() => problemas.value.findIndex(p => p.id === problemaActivoId.value))
const miEstadoActivo = computed(() => (problemaActivo.value ? reto.value.miEstado[problemaActivo.value.id] : null))
const letra = (i) => String.fromCharCode(65 + i)

function estadoProblema(id) {
  const e = reto.value?.miEstado?.[id]
  if (!e) return 'nuevo'
  if (e.aceptado) return 'aceptado'
  if (e.bloqueado) return 'bloqueado'
  if (e.puntos > 0) return 'parcial'
  if (e.envios > 0) return 'intentado'
  return 'nuevo'
}
const resueltos = computed(() => problemas.value.filter(p => reto.value.miEstado[p.id]?.aceptado).length)

// ---------- Borradores guardados en el navegador ----------
function claveLocal(sufijo) {
  return `reto:${reto.value.codigo}:${reto.value.codigoEstudiante}:${sufijo}`
}
function leerLocal(sufijo) {
  try { return localStorage.getItem(claveLocal(sufijo)) } catch { return null }
}
function guardarLocal(sufijo, valor) {
  try { localStorage.setItem(claveLocal(sufijo), valor) } catch { /* sin almacenamiento */ }
}

const lenguaje = computed({
  get() {
    const id = problemaActivo.value?.id
    return lenguajes.value[id] || reto.value?.lenguajes?.[0] || 'python'
  },
  set(l) {
    const id = problemaActivo.value.id
    lenguajes.value[id] = l
    guardarLocal(`lenguaje:${id}`, l)
  }
})

// Carga el borrador (o la plantilla) del problema y lenguaje activos
watch([problemaActivo, () => lenguajes.value[problemaActivoId.value]], () => {
  const p = problemaActivo.value
  if (!p) return
  if (!lenguajes.value[p.id]) {
    const guardado = leerLocal(`lenguaje:${p.id}`)
    lenguajes.value[p.id] = reto.value.lenguajes.includes(guardado) ? guardado : reto.value.lenguajes[0]
  }
  const clave = `${p.id}:${lenguajes.value[p.id]}`
  if (codigos.value[clave] === undefined) {
    codigos.value[clave] = leerLocal(`codigo:${clave}`) ?? (p.plantilla?.[lenguajes.value[p.id]] || '')
  }
}, { immediate: true })

const codigoActual = computed({
  get() {
    const p = problemaActivo.value
    return p ? codigos.value[`${p.id}:${lenguaje.value}`] ?? '' : ''
  },
  set(valor) {
    const clave = `${problemaActivo.value.id}:${lenguaje.value}`
    codigos.value[clave] = valor
    guardarLocal(`codigo:${clave}`, valor)
  }
})

function restaurarPlantilla() {
  if (!confirm('¿Reemplazar tu código por la plantilla inicial? Perderás lo que escribiste en este problema.')) return
  codigoActual.value = problemaActivo.value.plantilla?.[lenguaje.value] || ''
}

// ---------- Tiempo ----------
const restanteMs = computed(() => (reto.value?.fin ? reto.value.fin - (ahora.value + estado.offsetReloj) : 0))

// ---------- Resultados ----------
const enviosActivo = computed(() =>
  (reto.value?.misEnvios || []).filter(e => e.problemaId === problemaActivo.value?.id).slice().reverse()
)
// Lo último que hizo el estudiante en este problema (probar o enviar). Si recargó la página, su último envío.
const accionActiva = computed(() => {
  const id = problemaActivo.value?.id
  if (!id) return null
  if (acciones.value[id]) return acciones.value[id]
  return enviosActivo.value[0] ? { tipo: 'envio', datos: enviosActivo.value[0] } : null
})

const puedeEnviar = computed(() =>
  !ocupado.value && restanteMs.value > 0 && miEstadoActivo.value && !miEstadoActivo.value.aceptado && !miEstadoActivo.value.bloqueado
)

watch(problemaActivoId, () => {
  mensajeError.value = ''
  resultadoPersonalizado.value = null
  if (pestanaConsola.value === 'personalizada') pestanaConsola.value = 'resultado'
})

function estadoTexto(e) {
  return { TIEMPO: 'tiempo excedido', EJECUCION: 'error en ejecución', COMPILACION: 'error de compilación' }[e] || e
}

async function probar(personalizada) {
  if (ocupado.value) return
  const id = problemaActivo.value.id
  mensajeError.value = ''
  estado.cola = null
  ocupado.value = personalizada ? 'personalizada' : 'probar'
  pestanaConsola.value = personalizada ? 'personalizada' : 'resultado'
  const datos = { problemaId: id, lenguaje: lenguaje.value, codigo: codigoActual.value }
  if (personalizada) datos.entradaPersonalizada = entradaPersonalizada.value
  const res = await pedir('estudiante:reto:probar', datos)
  ocupado.value = null
  if (!res.ok) { mensajeError.value = res.mensaje; return }
  if (personalizada) resultadoPersonalizado.value = res
  else acciones.value[id] = { tipo: 'prueba', datos: res }
}

async function enviar() {
  if (!puedeEnviar.value) return
  const e = miEstadoActivo.value
  if (reto.value.intentosMax > 0) {
    const quedan = reto.value.intentosMax - e.intentosFallidos
    const aviso = `¿Enviar tu solución en ${lenguajeLabel(lenguaje.value)}?\n\nSi no pasa todas las pruebas gastarás 1 de tus ${quedan} intento(s) restantes en este problema.`
    if (!confirm(aviso)) return
  }
  const id = problemaActivo.value.id
  mensajeError.value = ''
  estado.cola = null
  ocupado.value = 'enviar'
  pestanaConsola.value = 'resultado'
  const res = await pedir('estudiante:reto:enviar', { problemaId: id, lenguaje: lenguaje.value, codigo: codigoActual.value })
  ocupado.value = null
  if (!res.ok) { mensajeError.value = res.mensaje; return }
  acciones.value[id] = { tipo: 'envio', datos: res.envio }
}

// ---------- Resultados finales ----------
const resultadosPodio = computed(() =>
  (reto.value?.ranking || []).map(f => ({ id: f.codigoEstudiante, nombre: f.nombre, codigoEstudiante: f.codigoEstudiante, puntaje: f.puntos }))
)

function volverInicio() {
  salir()
  router.push('/')
}

// ---------- Ciclo de vida ----------
function alCambiarVisibilidad() {
  if (reto.value?.estado === 'en-curso') avisarFoco(!document.hidden)
}

onMounted(async () => {
  reloj = setInterval(() => { ahora.value = Date.now() }, 500)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  if (!estado.reto) {
    if (!leerSesion()) return router.replace('/')
    const r = await reingresar()
    if (!r.ok) errorInicio.value = r.mensaje || 'No se pudo volver a entrar al reto.'
  }
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
})
</script>

<style scoped>
.reto-page { min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; }
.header-derecha { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.chip-header { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 20px; font-weight: 700; font-size: 14px; }
.chip-header.reloj { font-variant-numeric: tabular-nums; font-size: 16px; background: rgba(255,255,255,0.22); }
.chip-header.reloj.urgente { background: var(--color-accent); animation: latido 1s ease-in-out infinite; }
.chip-header.nombre { font-weight: 600; }
@keyframes latido { 50% { opacity: 0.75; } }

.centrado { padding-top: 80px; }
.cargando { display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--color-text-light); }
.texto-centro { text-align: center; }
.texto-suave { color: var(--color-text-light); }
.icono-aviso { color: var(--color-warning); margin-bottom: 8px; }
.icono-grande { width: 64px; height: 64px; border-radius: 50%; background: rgba(32,44,69,0.08); color: var(--color-primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
h2 { color: var(--color-primary); }
.espera-puntos { display: flex; justify-content: center; gap: 6px; margin: 16px 0 8px; }
.espera-puntos span { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); animation: rebote 1.2s infinite ease-in-out; }
.espera-puntos span:nth-child(2) { animation-delay: 0.15s; }
.espera-puntos span:nth-child(3) { animation-delay: 0.3s; }
@keyframes rebote { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
.reglas { list-style: none; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 10px; font-size: 14px; }
.reglas li { display: flex; gap: 10px; align-items: flex-start; }
.reglas li .icon { margin-top: 3px; color: var(--color-primary); }

/* --- Reto en curso --- */
.reto-layout { width: 100%; max-width: 1440px; margin: 0 auto; padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
.problemas-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.tab-problema { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border: 2px solid var(--color-border); background: white; border-radius: var(--radius-sm); cursor: pointer; font-family: inherit; text-align: left; flex-shrink: 0; transition: border-color 0.15s, box-shadow 0.15s; color: var(--color-text); }
.tab-problema:hover { border-color: var(--color-primary-light); }
.tab-problema.activo { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
.tab-letra { width: 30px; height: 30px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; background: var(--color-bg); color: var(--color-primary); flex-shrink: 0; }
.tab-texto { display: flex; flex-direction: column; line-height: 1.25; }
.tab-titulo { font-weight: 700; font-size: 13px; }
.tab-meta { font-size: 12px; color: var(--color-text-light); }
.estado-aceptado .tab-letra, .tab-letra.estado-aceptado { background: var(--color-success); color: white; }
.estado-parcial .tab-letra, .tab-letra.estado-parcial { background: #FFF3CD; color: #856404; }
.estado-bloqueado .tab-letra, .tab-letra.estado-bloqueado { background: var(--color-error-light); color: var(--color-error); }
.estado-intentado .tab-letra, .tab-letra.estado-intentado { background: #E9EDF5; color: var(--color-primary); }
.tab-problema.estado-aceptado > .icon { color: var(--color-success); }
.tab-problema.estado-bloqueado > .icon { color: var(--color-error); }

.reto-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 12px; align-items: start; }
@media (max-width: 1100px) { .reto-grid { grid-template-columns: 1fr; } }

.panel-enunciado { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; }
@media (max-width: 1100px) { .panel-enunciado { position: static; max-height: none; } }
.enunciado-cabecera { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
.enunciado-cabecera h2 { font-size: 20px; margin-bottom: 8px; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.tema { font-size: 13px; color: var(--color-text-light); margin-top: 6px; }
.enunciado { white-space: pre-wrap; font-size: 15px; line-height: 1.65; margin-bottom: 8px; }
.panel-enunciado h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--color-text-light); margin: 16px 0 6px; }
.ejemplo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.ejemplo-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-light); margin-bottom: 4px; display: block; }
pre { background: #F3F5F9; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; font-family: Consolas, 'Cascadia Code', monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; margin: 0; }
.nota-pruebas { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; padding: 12px; background: rgba(32,44,69,0.05); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-light); }
.nota-pruebas .icon { margin-top: 2px; color: var(--color-primary); }

.panel-trabajo { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.editor-card { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.editor-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.select-lenguaje { width: auto; padding: 6px 10px; font-size: 14px; font-weight: 600; }
.estado-problema { font-size: 13px; color: var(--color-text-light); display: inline-flex; align-items: center; gap: 4px; }
.estado-problema.estado-aceptado { color: var(--color-success); font-weight: 700; }
.estado-problema.estado-bloqueado { color: var(--color-error); font-weight: 700; }
.btn-plantilla { margin-left: auto; padding: 6px 12px; }
.editor-wrap { height: 420px; }
.editor-acciones { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.ayuda-acciones { font-size: 12px; margin-right: auto; }

.consola { padding: 0; overflow: hidden; }
.consola-tabs { display: flex; border-bottom: 1px solid var(--color-border); background: #FAFBFC; overflow-x: auto; }
.consola-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-light); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.consola-tabs button.activo { color: var(--color-primary); border-bottom-color: var(--color-accent); }
.contador { background: var(--color-primary); color: white; border-radius: 10px; padding: 0 7px; font-size: 11px; }
.consola-cuerpo { padding: 14px; min-height: 140px; }
.vacio { text-align: center; padding: 24px 0; font-size: 14px; }
.ejecutando { display: flex; align-items: center; gap: 12px; padding: 20px 0; color: var(--color-text-light); }
.spinner-sm { width: 24px; height: 24px; border-width: 3px; }

.veredicto { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 15px; }
.veredicto-puntos { margin-left: auto; font-weight: 800; font-size: 18px; }
.v-aceptado { background: var(--color-success-light); color: var(--color-success); }
.v-parcial { background: #FFF3CD; color: #856404; }
.v-error { background: var(--color-error-light); color: var(--color-error); }
.v-compilacion { background: #E9EDF5; color: var(--color-primary); }
.barra-pruebas { display: flex; gap: 4px; margin: 10px 0; }
.barra-pruebas span { flex: 1; height: 8px; border-radius: 4px; background: var(--color-error-light); }
.barra-pruebas span.ok { background: var(--color-success); }
.salida-error { background: #FFF5F5; border-color: #F3C7C4; color: #8A1F17; margin-top: 8px; }

.caso { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 8px; }
.caso-ok { border-left: 4px solid var(--color-success); }
.caso-mal { border-left: 4px solid var(--color-error); }
.caso-titulo { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
.caso-ok .caso-titulo { color: var(--color-success); }
.caso-mal .caso-titulo { color: var(--color-error); }
.caso-ms { margin-left: auto; font-weight: 400; font-size: 12px; color: var(--color-text-light); }
.caso-columnas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 640px) { .caso-columnas, .ejemplo { grid-template-columns: 1fr; } }
.entrada-personalizada { font-family: Consolas, monospace; font-size: 14px; resize: vertical; }

.tabla-envios, .tabla-ranking { width: 100%; border-collapse: collapse; font-size: 14px; }
.tabla-envios th, .tabla-ranking th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-light); padding: 8px; border-bottom: 2px solid var(--color-border); }
.tabla-envios td, .tabla-ranking td { padding: 8px; border-bottom: 1px solid var(--color-border); }
.chip-veredicto { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }

/* --- Resultados --- */
.hero-final { padding: 32px 24px; }
.icono-trofeo { color: var(--color-warning); }
.posicion-final { font-size: 18px; margin-top: 4px; }
.posicion-final strong { color: var(--color-accent); font-size: 26px; }
.resumen-final { display: flex; justify-content: center; gap: 32px; margin-top: 20px; flex-wrap: wrap; }
.resumen-final div { display: flex; flex-direction: column; align-items: center; }
.resumen-final .numero { font-size: 30px; font-weight: 800; color: var(--color-primary); font-variant-numeric: tabular-nums; }
.resumen-final span:not(.numero) { font-size: 13px; color: var(--color-text-light); }
.tabla-ranking { margin-top: 16px; }
.tabla-ranking tr.yo { background: rgba(242,24,79,0.07); font-weight: 700; }
.fila-mis-problemas { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.fila-mis-problemas:last-child { border-bottom: none; }
.flex-1 { flex: 1; }
</style>
