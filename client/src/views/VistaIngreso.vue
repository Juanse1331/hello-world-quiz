<template>
  <div class="ingreso-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.svg" alt="ACEIS" class="logo" />
      <h1>Hello World Quiz</h1>
    </header>

    <main class="container-sm" style="padding-top: 48px;">
      <div class="card fade-in">
        <div class="card-header-aceis">
          <h2>Unirte al Quiz</h2>
          <p>Ingresa tus datos y el código de la sala</p>
        </div>

        <form @submit.prevent="unirse" style="margin-top: 24px;">
          <div class="form-group">
            <label for="nombre">Nombre completo</label>
            <input
              id="nombre"
              v-model="form.nombre"
              type="text"
              class="form-control"
              placeholder="Ej: Laura García"
              required
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="codigo">Código de estudiante</label>
            <input
              id="codigo"
              v-model="form.codigoEstudiante"
              type="text"
              class="form-control"
              placeholder="Ej: 2210123"
              required
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="sala">Código de sala</label>
            <input
              id="sala"
              v-model="form.codigoSala"
              type="text"
              class="form-control codigo-sala-input"
              placeholder="Ej: ABCD-1234"
              required
              autocomplete="off"
              @input="form.codigoSala = form.codigoSala.toUpperCase()"
            />
          </div>

          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <div v-if="!state.conectado" class="alert alert-info">Conectando al servidor...</div>

          <button
            type="submit"
            class="btn btn-primary btn-lg btn-block"
            :disabled="cargando || !state.conectado"
          >
            <span v-if="cargando">Uniéndome...</span>
            <span v-else>🚀 Unirme al quiz</span>
          </button>
        </form>

        <div class="admin-link">
          <router-link to="/admin">¿Eres el profesor? Accede al panel admin →</router-link>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useQuiz } from '../composables/useQuiz'

const router = useRouter()
const { state, stateRaw, registrarEventosEstudiante } = useQuiz()

const form = reactive({
  nombre: '',
  codigoEstudiante: '',
  codigoSala: ''
})
const error = ref('')
const cargando = ref(false)

registrarEventosEstudiante(router)

function unirse() {
  error.value = ''
  if (!form.nombre.trim() || !form.codigoEstudiante.trim() || !form.codigoSala.trim()) {
    error.value = 'Todos los campos son obligatorios'
    return
  }

  cargando.value = true

  state.socket.emit('estudiante:unirse', {
    nombre: form.nombre.trim(),
    codigoEstudiante: form.codigoEstudiante.trim(),
    codigoSala: form.codigoSala.trim().toUpperCase()
  }, (respuesta) => {
    cargando.value = false
    if (respuesta.ok) {
      stateRaw.nombre = form.nombre.trim()
      stateRaw.codigoEstudiante = form.codigoEstudiante.trim()
      stateRaw.codigoSala = form.codigoSala.trim().toUpperCase()
      stateRaw.rol = 'estudiante'
      router.push('/sala')
    } else {
      error.value = respuesta.mensaje || 'Error al unirse a la sala'
    }
  })
}
</script>

<style scoped>
.ingreso-page {
  min-height: 100vh;
  background: var(--color-bg);
}
.card-header-aceis {
  text-align: center;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-bg);
}
.card-header-aceis h2 {
  color: var(--color-primary);
  font-size: 24px;
  margin-bottom: 4px;
}
.card-header-aceis p {
  color: var(--color-text-light);
  font-size: 14px;
}
.codigo-sala-input {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  text-align: center;
  color: var(--color-primary);
}
.admin-link {
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.admin-link a {
  color: var(--color-text-light);
  font-size: 13px;
  text-decoration: none;
}
.admin-link a:hover {
  color: var(--color-primary);
}
</style>