<script setup lang="ts">
import { reactive, watchEffect } from 'vue'
import { useToast } from 'vue-toastification'

type Opt = { id:number; nombre:string }

const props = defineProps<{
  initial?: {
    id?: number
    nombre?: string
    descripcion?: string
    costo?: number | string
    id_estado_repuesto?: number | null
    id_tipo_repuesto?: number | null
    id_proveedor?: number | null
  }
  estados: Opt[]
  tipos: Opt[]
  proveedores: Opt[]
}>()

const emit = defineEmits<{
  (e:'save', payload:{
    id?: number
    nombre: string
    descripcion?: string
    costo: number
    id_estado_repuesto: number
    id_tipo_repuesto: number
    id_proveedor: number
  }): void
  (e:'cancel'): void
}>()

const toast = useToast()

const form = reactive({
  id: props.initial?.id ?? undefined as number | undefined,
  nombre: props.initial?.nombre ?? '',
  descripcion: props.initial?.descripcion ?? '',
  costo: (props.initial?.costo ?? '') as number | string,
  id_estado_repuesto: props.initial?.id_estado_repuesto ?? null as number | null,
  id_tipo_repuesto: props.initial?.id_tipo_repuesto ?? null as number | null,
  id_proveedor: props.initial?.id_proveedor ?? null as number | null,
})

watchEffect(() => {
  form.id = props.initial?.id ?? undefined
  form.nombre = props.initial?.nombre ?? ''
  form.descripcion = props.initial?.descripcion ?? ''
  form.costo = props.initial?.costo ?? ''
  form.id_estado_repuesto = props.initial?.id_estado_repuesto ?? null
  form.id_tipo_repuesto = props.initial?.id_tipo_repuesto ?? null
  form.id_proveedor = props.initial?.id_proveedor ?? null
})

function showValidationToast(errors: string[]) {
  const msg = [
    'Errores de Validación (Revisar campos):',
    ...errors.map(e => `- ${e}`),
  ].join('\n')  // saltos de línea

  toast.clear()

  toast.error(msg, {
    timeout: 8000,
    closeOnClick: true,
    pauseOnHover: true,
  })
}

function onSubmit() {
  const errors: string[] = []

  const nombre = form.nombre.trim()
  const descripcion = form.descripcion.trim()

  // ⚠️ Costo como string original (para ver si viene vacío)
  const costoRaw = String(form.costo ?? '').trim()
  const costoNum = Number(costoRaw)

  // Nombre
  if (!nombre) {
    errors.push('Nombre: es obligatorio.')
  } else if (nombre.length > 150) {
    errors.push('Nombre: máx 150 caracteres.')
  }


  // Estado / Tipo / Proveedor
  if (!form.id_estado_repuesto) {
    errors.push('Estado: debes seleccionar uno.')
  }
  if (!form.id_tipo_repuesto) {
    errors.push('Tipo: debes seleccionar uno.')
  }
  if (!form.id_proveedor) {
    errors.push('Proveedor: debes seleccionar uno.')
  }

  // Costo OBLIGATORIO
  if (!costoRaw) {
    errors.push('Costo: es obligatorio.')
  } else if (!Number.isFinite(costoNum)) {
    errors.push('Costo: debe ser un número.')
  } else if (costoNum < 0) {
    errors.push('Costo: debe ser mayor o igual a 0.')
  }

  // Descripción (máx 500 opcional)
  if (descripcion && descripcion.length > 500) {
    errors.push('Descripción: máx 500 caracteres.')
  }

  if (errors.length) {
    showValidationToast(errors)
    return
  }

  emit('save', {
    id: form.id ?? undefined,
    nombre,
    descripcion: descripcion || undefined,
    costo: costoNum,
    id_estado_repuesto: Number(form.id_estado_repuesto),
    id_tipo_repuesto: Number(form.id_tipo_repuesto),
    id_proveedor: Number(form.id_proveedor),
  })
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
      <div class="span-2">
        <label class="label">Nombre *</label>
        <input class="input" v-model="form.nombre" placeholder="Ej: Filtro de aceite" />
      </div>

      <div>
        <label class="label">Estado *</label>
        <select class="input" v-model.number="form.id_estado_repuesto">
          <option :value="null" disabled>Selecciona…</option>
          <option v-for="s in estados" :key="s.id" :value="s.id">
            {{ s.nombre }}
          </option>
        </select>
      </div>

      <div>
        <label class="label">Tipo *</label>
        <select class="input" v-model.number="form.id_tipo_repuesto">
          <option :value="null" disabled>Selecciona…</option>
          <option v-for="t in tipos" :key="t.id" :value="t.id">
            {{ t.nombre }}
          </option>
        </select>
      </div>

      <div>
        <label class="label">Proveedor *</label>
        <select class="input" v-model.number="form.id_proveedor">
          <option :value="null" disabled>Selecciona…</option>
          <option v-for="p in proveedores" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select>
      </div>

      <div>
        <label class="label">Costo *</label>
        <input
          class="input"
          type="number"
          min="0"
          step="1"
          v-model="form.costo"
          placeholder="0"
        />
      </div>

      <div class="span-2">
        <label class="label">Descripción</label>
        <textarea
          class="input"
          rows="4"
          v-model="form.descripcion"
          placeholder="Detalle, compatibilidad, etc."
        ></textarea>
      </div>

      <div class="actions span-2">
        <button type="button" class="row-action" @click="$emit('cancel')">
          ✖ Cancelar
        </button>
        <button type="submit" class="btn">
          💾 Guardar
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.label{display:block;font-size:.85rem;color:#4b5563;margin-bottom:.35rem;font-weight:600}
.input, textarea.input, select.input{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none}
.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.grid{display:grid}
.span-2{grid-column:span 2 / span 2}
.actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}
.row-action{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:.5rem .9rem;cursor:pointer;font-weight:600}
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.55rem .9rem;font-weight:600;cursor:pointer}
.btn:hover{background:#1d4ed8}
</style>
