<template>
  <router-view />
</template>

<script setup>
import { useQuiz } from './composables/useQuiz'

const { conectar } = useQuiz()
conectar()
</script>