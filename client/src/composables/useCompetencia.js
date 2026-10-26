// Estado de la competencia para el estudiante.
import { reactive } from 'vue'
import { useSocket } from './useSocket'

const CLAVE_SESION = 'competencia-sesion'

const estado = reactive({
  comp: null,          // vista que envía el servidor (ítem actual, puntos, ranking y resumen al final)
  offsetReloj: 0,      // diferencia entre el reloj del servidor y el del navegador
  cola: null,          // { tipo: 'envio' | 'prueba', posicion }
  reemplazada: false,  // el estudiante abrió la competencia en otra pestaña
  reconectando: false
})

let eventosRegistrados = false

function socket() {
  return useSocket().state.socket
}

function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null') } catch { return null }
}
function guardarSesion(datos) {
  try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(datos)) } catch { /* sin almacenamiento */ }
}

function aplicarVista(vista) {
  estado.comp = vista
  estado.offsetReloj = vista.ahora - Date.now()
}

function ahoraServidor() {
  return Date.now() + estado.offsetReloj
}

function registrarEventos() {
  const s = socket()
  if (!s || eventosRegistrados) return
  eventosRegistrados = true

  s.on('competencia:mi-estado', (vista) => {
    if (estado.comp && vista.codigo !== estado.comp.codigo) return
    aplicarVista(vista)
  })
  s.on('competencia:cola', (info) => { estado.cola = info })
  s.on('competencia:sesion-reemplazada', () => { estado.reemplazada = true })
  // Si se cae el WiFi y el socket se reconecta, volver a entrar automáticamente
  s.on('connect', () => {
    if (estado.comp && !estado.reemplazada) reingresar()
  })
}

// Se llama desde la pantalla de ingreso cuando el servidor acepta al estudiante
function aplicarIngreso(respuesta, datos) {
  registrarEventos()
  guardarSesion({ nombre: datos.nombre, codigoEstudiante: datos.codigoEstudiante, codigoSala: respuesta.codigoSala })
  estado.reemplazada = false
  aplicarVista(respuesta.competencia)
}

// Volver a entrar con la sesión guardada (al recargar la página o tras una reconexión)
function reingresar() {
  const sesion = leerSesion()
  const s = socket()
  if (!sesion || !s) return Promise.resolve({ ok: false, mensaje: 'Sin sesión' })
  registrarEventos()
  estado.reconectando = true
  return new Promise((resolve) => {
    const enviar = () => s.emit('estudiante:unirse', sesion, (res) => {
      estado.reconectando = false
      if (res?.ok) {
        estado.reemplazada = false
        aplicarVista(res.competencia)
      }
      resolve(res || { ok: false })
    })
    if (s.connected) enviar()
    else s.once('connect', enviar)
  })
}

function salir() {
  try { sessionStorage.removeItem(CLAVE_SESION) } catch { /* ignorar */ }
  estado.comp = null
  estado.cola = null
  estado.reemplazada = false
}

// Envía un evento al servidor y espera su respuesta como promesa
function pedir(evento, datos) {
  return new Promise((resolve) => {
    const s = socket()
    if (!s?.connected) return resolve({ ok: false, mensaje: 'Sin conexión con el servidor.' })
    s.timeout(120000).emit(evento, datos, (err, res) => {
      resolve(err ? { ok: false, mensaje: 'El servidor tardó demasiado en responder.' } : res)
    })
  })
}

function avisarFoco(visible) {
  socket()?.emit('estudiante:foco', { visible })
}

export function useCompetencia() {
  return { estado, leerSesion, aplicarIngreso, reingresar, salir, pedir, avisarFoco, ahoraServidor }
}
