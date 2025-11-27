<script setup lang="ts">
import { reactive, watch, computed } from 'vue'

type EditMode = 'FULL' | 'PARTIAL' | 'DESC_ONLY'

const props = defineProps<{
  initial?: {
    usuarioId: number
    busId: number
    inicio: string
    fin: string
    titulo?: string
    descripcion?: string
    ruta_origen?: string
    ruta_fin?: string
  }
  allConductores: { id:number; label:string }[]
  allBuses: { id:number; label:string }[]
  mode?: EditMode
}>()

const emit = defineEmits<{
  (e:'save', payload:{
    usuarioId: number
    busId: number
    inicio: string
    fin: string
    titulo?: string
    descripcion?: string
    ruta_origen?: string
    ruta_fin?: string
  }): void
  (e:'cancel'): void
  (e:'validationError', msg:string): void
}>()

const form = reactive({
  usuarioId: 0,
  busId: 0,
  inicio: '',
  fin: '',
  titulo: '',
  descripcion: '',
  ruta_origen: '',
  ruta_fin: '',
})
function toInputDateTime(value: string | undefined | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm   = pad(d.getMonth() + 1)
  const dd   = pad(d.getDate())
  const hh   = pad(d.getHours())
  const mi   = pad(d.getMinutes())

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

watch(
  () => props.initial,
  (val) => {
    if (!val) {
      form.usuarioId   = 0
      form.busId       = 0
      form.inicio      = ''
      form.fin         = ''
      form.titulo      = ''
      form.descripcion = ''
      form.ruta_origen = ''
      form.ruta_fin    = ''
      return
    }

    form.usuarioId   = val.usuarioId
    form.busId       = val.busId
    form.inicio      = toInputDateTime(val.inicio)
    form.fin         = toInputDateTime(val.fin)
    form.titulo      = val.titulo || ''
    form.descripcion = val.descripcion || ''
    form.ruta_origen = val.ruta_origen || ''
    form.ruta_fin    = val.ruta_fin || ''
  },
  { immediate: true }
)

//Modo de edición 
const currentMode = computed<EditMode>(() => props.mode ?? 'FULL')

// FULL → todo editable
const canEditFull = computed(() => currentMode.value === 'FULL')
// PARTIAL → título, rutas, descripción
const isPartial = computed(() => currentMode.value === 'PARTIAL')
// DESC_ONLY → solo descripción
const isDescOnly = computed(() => currentMode.value === 'DESC_ONLY')

const disableStructure = computed(() => !canEditFull.value)   // usuario, bus, fechas
const disableTitleAndRoutes = computed(() => isDescOnly.value)

// Enviar
function onSubmit() {
  const errors: string[] = []

  if (!form.usuarioId) {
    errors.push('Conductor: es obligatorio.')
  }
  if (!form.busId) {
    errors.push('Bus: es obligatorio.')
  }
  if (!form.inicio) {
    errors.push('Fecha/hora de inicio: es obligatoria.')
  }
  if (!form.fin) {
    errors.push('Fecha/hora de fin: es obligatoria.')
  }
  if (!form.ruta_origen) {
    errors.push('Ruta de origen: es obligatoria.')
  }
  if (!form.ruta_fin) {
    errors.push('Ruta de destino: es obligatoria.')
  }

  if (errors.length) {
    const message = [
      ' Errores de Validación (Revisar campos):',
      ...errors.map(e => `- ${e}`),
    ].join('\n')
    emit('validationError', message)
    return
  }

  // Para guardar usamos directamente el valor del input (YYYY-MM-DDTHH:MM)
  emit('save', {
    usuarioId: form.usuarioId,
    busId: form.busId,
    inicio: form.inicio,
    fin: form.fin,
    titulo: form.titulo || undefined,
    descripcion: form.descripcion || undefined,
    ruta_origen: form.ruta_origen || undefined,
    ruta_fin: form.ruta_fin || undefined,
  })
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <form class="form" @submit.prevent="onSubmit">
    <div class="grid">
      <!-- Conductor -->
      <div class="field">
        <label class="label">Conductor</label>
        <select
          v-model.number="form.usuarioId"
          class="input"
          :disabled="disableStructure"
        >
          <option :value="0" disabled>Selecciona un conductor</option>
          <option v-for="c in allConductores" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>
      </div>

      <!-- Bus -->
      <div class="field">
        <label class="label">Bus</label>
        <select
          v-model.number="form.busId"
          class="input"
          :disabled="disableStructure"
        >
          <option :value="0" disabled>Selecciona un bus</option>
          <option v-for="b in allBuses" :key="b.id" :value="b.id">
            {{ b.label }}
          </option>
        </select>
      </div>

      <!-- Inicio -->
      <div class="field">
        <label class="label">Inicio</label>
        <input
          type="datetime-local"
          class="input"
          v-model="form.inicio"
          :disabled="disableStructure"
        />
      </div>

      <!-- Fin -->
      <div class="field">
        <label class="label">Fin</label>
        <input
          type="datetime-local"
          class="input"
          v-model="form.fin"
          :disabled="disableStructure"
        />
      </div>

      <!-- Título -->
      <div class="field">
        <label class="label">Título</label>
        <input
          class="input"
          v-model="form.titulo"
          :disabled="disableTitleAndRoutes"
          placeholder="Ej: Turno mañana, Ruta colegio..."
        />
      </div>

      <!-- Ruta origen -->
      <div class="field">
        <label class="label">Ruta - Origen</label>
        <input
          class="input"
          v-model="form.ruta_origen"
          :disabled="disableTitleAndRoutes"
          placeholder="Ej: Terminal, Colegio, etc."
        />
      </div>

      <!-- Ruta destino -->
      <div class="field">
        <label class="label">Ruta - Destino</label>
        <input
          class="input"
          v-model="form.ruta_fin"
          :disabled="disableTitleAndRoutes"
          placeholder="Ej: Centro, Bodega, etc."
        />
      </div>

      <!-- Descripción -->
      <div class="field field-full">
        <label class="label">Descripción / Notas</label>
        <textarea
          class="input textarea"
          v-model="form.descripcion"
          rows="3"
          placeholder="Detalle adicional del turno, incidentes, observaciones..."
        ></textarea>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn secondary" @click="onCancel">
        Cancelar
      </button>
      <button type="submit" class="btn primary">
        Guardar
      </button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: .75rem;
}

.field-full {
  grid-column: 1 / -1;
}

.label {
  font-size: .8rem;
  font-weight: 600;
  margin-bottom: .25rem;
  color: #4b5563;
}

.input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: .45rem .7rem;
  font-size: .85rem;
}

.input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
}

.textarea {
  min-height: 80px;
  resize: vertical;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
  margin-top: .5rem;
}

.btn {
  border-radius: 10px;
  padding: .45rem .9rem;
  font-size: .85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn.primary {
  background:#2563eb;
  color:#fff;
}
.btn.primary:hover {
  background:#1d4ed8;
}

.btn.secondary {
  background:#f3f4f6;
  color:#111827;
}
.btn.secondary:hover {
  background:#e5e7eb;
}
</style>
