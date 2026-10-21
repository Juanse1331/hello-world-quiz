// Estado del modo reto para el estudiante.
// Usa el mismo socket del quiz (lo abre useQuiz al arrancar la app).
import { reactive } from 'vue'
import { useQuiz } from './useQuiz'

const CLAVE_SESION = 'reto-sesion'

const estado = reactive({
  reto: null,          // vista que envía el servidor (problemas, mi estado, mis envíos, ranking al final)
  offsetReloj: 0,      // diferencia entre el reloj del servidor y el del navegador
  cola: null,          // { tipo: 'envio' | 'prueba', posicion }
  reemplazada: false,  // el estudiante abrió el reto en otra pestaña
  reconectando: false
})

let eventosRegistrados = false

function socket() {
  return useQuiz().state.socket
}

function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null') } catch { return null }
}
function guardarSesion(datos) {
  try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(datos)) } catch { /* sin almacenamiento */ }
}

function aplicarVista(vista) {
  estado.reto = vista
  estado.offsetReloj = vista.ahora - Date.now()
}

function ahoraServidor() {
  return Date.now() + estado.offsetReloj
}

function registrarEventos() {
  const s = socket()
  if (!s || eventosRegistrados) return
  eventosRegistrados = true

  s.on('reto:mi-estado', (vista) => {
    if (estado.reto && vista.codigo !== estado.reto.codigo) return
    aplicarVista(vista)
  })
  s.on('reto:estado', ({ estado: est, inicio, fin, ahora }) => {
    if (!estado.reto) return
    estado.reto.estado = est
    estado.reto.inicio = inicio
    estado.reto.fin = fin
    estado.offsetReloj = ahora - Date.now()
  })
  s.on('reto:cola', (info) => { estado.cola = info })
  s.on('reto:sesion-reemplazada', () => { estado.reemplazada = true })
  // Si se cae el WiFi y el socket se reconecta, volver a entrar automáticamente al reto
  s.on('connect', () => {
    if (estado.reto && !estado.reemplazada) reingresar()
  })
}

// Se llama desde la pantalla de ingreso cuando el servidor responde que la sala es un reto
function aplicarIngreso(respuesta, datos) {
  registrarEventos()
  guardarSesion({ nombre: datos.nombre, codigoEstudiante: datos.codigoEstudiante, codigoSala: respuesta.codigoSala })
  estado.reemplazada = false
  aplicarVista(respuesta.reto)
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
      if (res?.ok && res.modo === 'reto') {
        estado.reemplazada = false
        aplicarVista(res.reto)
      }
      resolve(res || { ok: false })
    })
    if (s.connected) enviar()
    else s.once('connect', enviar)
  })
}

function salir() {
  try { sessionStorage.removeItem(CLAVE_SESION) } catch { /* ignorar */ }
  estado.reto = null
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
  socket()?.emit('estudiante:reto:foco', { visible })
}

export function useReto() {
  return { estado, leerSesion, aplicarIngreso, reingresar, salir, pedir, avisarFoco, ahoraServidor }
}
