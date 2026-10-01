<template>
  <div class="podio" v-if="lugares.length">
    <div
      v-for="l in lugares"
      :key="l.r.id"
      class="podio-lugar"
      :class="['lugar-' + l.pos, { yo: l.r.codigoEstudiante === miCodigo }]"
    >
      <div class="podio-nombre">
        {{ l.r.nombre }}
        <span v-if="l.r.codigoEstudiante === miCodigo" class="podio-yo">(tú)</span>
      </div>
      <div class="podio-puntos">{{ l.r.puntaje }} pts</div>
      <div class="podio-bloque">
        <Icon name="medal" :size="l.pos === 1 ? 34 : 28" />
        <span class="podio-pos">{{ l.pos }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  resultados: { type: Array, required: true }, // ya ordenados por puntaje
  miCodigo: { type: String, default: '' }
})

// Orden visual del podio: 2.º, 1.º, 3.º
const lugares = computed(() => {
  const top = props.resultados.slice(0, 3).map((r, i) => ({ r, pos: i + 1 }))
  return [top[1], top[0], top[2]].filter(Boolean)
})
</script>

<style scoped>
.podio {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 12px;
  padding: 8px 0 0;
}
.podio-lugar {
  flex: 1;
  max-width: 190px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
}
.podio-nombre {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.podio-yo { color: var(--color-accent); font-size: 12px; font-weight: 600; }
.podio-puntos { font-size: 13px; color: var(--color-text-light); font-weight: 600; margin-bottom: 8px; }
.podio-bloque {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  padding-top: 12px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  color: white;
  background: var(--color-primary-light);
  transform-origin: bottom;
  animation: podio-sube 0.7s ease-out both;
}
.podio-pos { font-size: 28px; font-weight: 800; line-height: 1; }
.lugar-1 .podio-bloque { height: 150px; background: var(--color-primary); animation-delay: 0.5s; }
.lugar-2 .podio-bloque { height: 110px; animation-delay: 0.25s; }
.lugar-3 .podio-bloque { height: 80px; background: #4B5A7E; animation-delay: 0s; }
.lugar-1 .podio-bloque :deep(.icon) { color: #F2C230; }
.lugar-2 .podio-bloque :deep(.icon) { color: #C9D5F0; }
.lugar-3 .podio-bloque :deep(.icon) { color: #E0955A; }
.yo .podio-bloque { box-shadow: inset 0 -4px 0 var(--color-accent); }

@keyframes podio-sube {
  from { transform: scaleY(0); opacity: 0; }
  to { transform: scaleY(1); opacity: 1; }
}
</style>
