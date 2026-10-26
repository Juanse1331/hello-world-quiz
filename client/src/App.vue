<template>
  <router-view />
</template>

<script setup>
import { useSocket } from './composables/useSocket'

const { conectar } = useSocket()
conectar()
</script>