<template>
  <span :class="['badge', cls]">{{ status }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'
}>()

const cls = computed(() => {
  switch (props.status) {
    case 'OPERATIVO': return 'ok'
    case 'MANTENIMIENTO': return 'warn'
    case 'FUERA DE SERVICIO': return 'alert'
  }
})
</script>

<style scoped>
.badge{padding:.25rem .55rem;border-radius:10px;font-size:.8rem;font-weight:700;color:#fff;white-space:nowrap}
.ok{background:#16a34a}
.warn{background:#f59e0b}
.alert{background:#dc2626}
</style>
