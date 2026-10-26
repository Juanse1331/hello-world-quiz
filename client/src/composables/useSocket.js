// Conexión única con el servidor (Socket.io), compartida por todas las pantallas
import { reactive, readonly, markRaw } from 'vue'
import { io } from 'socket.io-client'

const state = reactive({
  socket: null,
  conectado: false,
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

export function useSocket() {
  return { state: readonly(state), conectar }
}
