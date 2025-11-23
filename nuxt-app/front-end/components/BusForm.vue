<script setup lang="ts">
import { reactive, watch, ref } from 'vue'

type EstadoBus = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'
// Se elimina 'code' porque no es editable ni necesario para la entrada de datos.
interface BusInput { plate:string; model:string; year:number; km:number; estado:EstadoBus }

const props = defineProps<{ initial?: Partial<BusInput> }>()
const emit = defineEmits<{ (e:'save', value:BusInput):void; (e:'cancel'):void }>()

const validationError = ref('')

const form = reactive<BusInput>({
  // Se inicializa sin 'code'
  plate: props.initial?.plate ?? '',
  model: props.initial?.model ?? '',
  year: props.initial?.year ?? new Date().getFullYear(),
  km: props.initial?.km ?? 0,
  estado: (props.initial?.estado as EstadoBus) ?? 'OPERATIVO'
})

// Lógica para cargar nuevos valores iniciales si la prop 'initial' cambia (ej. al abrir otro bus para editar)
watch(() => props.initial, (v) => {
  if (v) Object.assign(form, { ...v }) // Usa spread para aplicar solo las propiedades de 'v'
  validationError.value = '' // Limpia el error al cargar nuevos datos
}, { deep: false })

function onSubmit() {
  validationError.value = '' // Limpia errores anteriores

  // Reemplazo de alert() con manejo de errores interno
  if (!form.plate || !form.model) {
    validationError.value = 'Debes completar la Patente y el Modelo.'
    return
  }
  if (form.year < 1990 || form.year > new Date().getFullYear() + 1) {
    validationError.value = 'El Año ingresado no es válido (mínimo 1990).'
    return
  }
  
  emit('save', { ...form })
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
      <div><label class="label">Patente</label><input class="input" v-model="form.plate" required /></div>
      <div><label class="label">Modelo</label><input class="input" v-model="form.model" required /></div>
      
      <div><label class="label">Año</label><input class="input" type="number" v-model.number="form.year" min="1990" :max="new Date().getFullYear() + 1" /></div>
      <div><label class="label">Kilómetros</label><input class="input" type="number" v-model.number="form.km" min="0" /></div>
      
      <!-- 2. Opciones de estado actualizadas para reflejar 'ALERTA' -->
      <div>
        <label class="label">Estado</label>
        <select class="select" v-model="form.estado">
          <option value="OPERATIVO">OPERATIVO</option>
          <option value="MANTENIMIENTO">MANTENIMIENTO</option>
          <option value="FUERA DE SERVICIO">FUERA DE</option>
        </select>
      </div>
    </div>
    
    <!-- Muestra el error de validación -->
    <p v-if="validationError" class="error-msg">{{ validationError }}</p>

    <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:1.5rem">
      <button type="button" class="row-action" @click="emit('cancel')">✖ Cancelar</button>
      <button type="submit" class="btn">Guardar</button>
    </div>
  </form>
</template>

<style scoped>
.label{display:block;font-size:.85rem;color:#4b5563;margin-bottom:.35rem;font-weight:600}
.input,.select{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none}
.input:focus,.select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.row-action{background:transparent;border:1px solid #e5e7eb;border-radius:8px;padding:.5rem .9rem;cursor:pointer; font-weight: 600; }
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.55rem .9rem;font-weight:600;cursor:pointer}
.btn:hover{background:#1d4ed8}
.error-msg { color: #dc2626; margin-top: 1rem; font-size: 0.9rem; text-align: right; }
</style>