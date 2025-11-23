<template>
  <div
    v-if="modelValue"
    class="overlay"
    @click="closeModal"
  >
    <div class="modal" @click.stop>
      <!-- Pasamos la función close al slot -->
      <slot :close="closeModal"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function closeModal() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.modal {
  position: relative;
  background: #ffffff;
  border-radius: 18px;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(15,23,42,.45);
  max-width: 680px;
  width: min(100% - 2rem, 680px);
  animation: zoomIn .2s ease;
}

@keyframes zoomIn {
  from { opacity: 0; transform: scale(.94); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
