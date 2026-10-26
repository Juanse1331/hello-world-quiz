<template>
  <div class="no-autorizado-page">
    <header class="app-header">
      <img src="../assets/logo-aceis.png" alt="ACEIS" class="logo" />
      <h1>Hello World · ACEIS</h1>
    </header>

    <main class="container-sm" style="padding-top: 40px;">
      <div class="card fade-in texto-centro">
        <sammy-mascota estado="401"></sammy-mascota>
        <h2>Esta parte es solo para el profesor</h2>
        <p class="texto-suave">Las preguntas y sus respuestas no se pueden ver desde aquí. ¡Buen intento!</p>
        <router-link to="/" class="btn btn-primary" style="margin-top: 16px;"><Icon name="arrow-left" :size="16" /> Volver al inicio</router-link>
      </div>
    </main>
  </div>
</template>

<script setup>
import Icon from '../components/Icon.vue'
</script>

<style scoped>
.no-autorizado-page { min-height: 100vh; background: var(--color-bg); }
.texto-centro { text-align: center; }
.texto-suave { color: var(--color-text-light); }
h2 { color: var(--color-primary); margin-top: 8px; }
sammy-mascota { --sammy-tam: 220px; }
</style>
