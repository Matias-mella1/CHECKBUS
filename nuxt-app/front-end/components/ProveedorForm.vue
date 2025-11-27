<script setup lang="ts">
import { reactive } from 'vue'
import { useToast } from 'vue-toastification'

type ProveedorInput = {
  nombre: string
  direccion?: string | undefined
  telefono?: string | undefined
  email?: string | undefined
}

const props = defineProps<{
  initial?: Partial<ProveedorInput> & { id?: number } & {
    direccion?: string | null
    telefono?: string | null
    email?: string | null
  }
}>()

const emit = defineEmits<{
  (e: 'save', value: ProveedorInput & { id?: number }): void
  (e: 'cancel'): void
}>()

const toast = useToast()

const form = reactive<{
  id?: number
  nombre: string
  direccion: string
  telefono: string
  email: string
}>( {
  id: props.initial?.id,
  nombre: props.initial?.nombre ?? '',
  direccion: props.initial?.direccion ?? '',
  telefono: props.initial?.telefono ?? '',
  email: props.initial?.email ?? '',
})

// Toast de validación 
function showValidationToast(errors: string[]) {
  const msg = [
    'Errores de Validación (Revisar campos):',
    ...errors.map(e => `- ${e}`),
  ].join('\n')

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
  if (!nombre) {
    errors.push('Nombre: es obligatorio.')
  } else if (nombre.length > 150) {
    errors.push('Nombre: máx 150 caracteres.')
  }

  //  VALIDACIÓN TELÉFONO SOLO NÚMEROS 
  if (form.telefono.trim()) {

    const tel = form.telefono.trim()

    // Solo números, +, -, espacio
    if (!/^[0-9+\-\s]+$/.test(tel)) {
      errors.push('Teléfono: solo puede contener números, +, - o espacios.')
    }

    // Solo dígitos para contar largo real
    const soloNumeros = tel.replace(/[^\d]/g, '')

    if (soloNumeros.length < 8) {
      errors.push('Teléfono: debe tener al menos 8 dígitos.')
    }

    if (tel.length > 20) {
      errors.push('Teléfono: máx 20 caracteres.')
    }
  }

  // VALIDACIÓN EMAIL 
  if (form.email.trim()) {
    const email = form.email.trim()
    if (email.length > 100) {
      errors.push('Email: máx 100 caracteres.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Email: formato inválido.')
    }
  }

  //  VALIDACIÓN DIRECCIÓN 
  if (form.direccion.trim() && form.direccion.length > 200) {
    errors.push('Dirección: máx 200 caracteres.')
  }

  // Mostrar errores
  if (errors.length) {
    showValidationToast(errors)
    return
  }

  emit('save', {
    id: form.id,
    nombre,
    direccion: form.direccion.trim() || undefined,
    telefono: form.telefono.trim() || undefined,
    email: form.email.trim() || undefined,
  })
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
      
      <div class="span-2">
        <label class="label">Nombre *</label>
        <input class="input" v-model="form.nombre" placeholder="Proveedor S.A." />
      </div>

      <div>
        <label class="label">Teléfono</label>
        <input
          class="input"
          v-model="form.telefono"
          placeholder="+56 9 1234 5678"
          @input="form.telefono = form.telefono.replace(/[^0-9+\-\s]/g, '')"
        />
      </div>

      <div>
        <label class="label">Email</label>
        <input class="input" type="email" v-model="form.email" placeholder="contacto@proveedor.cl" />
      </div>

      <div class="span-2">
        <label class="label">Dirección</label>
        <input class="input" v-model="form.direccion" placeholder="Calle 123, Ciudad" />
      </div>

      <div class="actions span-2">
        <button type="button" class="row-action" @click="$emit('cancel')">✖ Cancelar</button>
        <button type="submit" class="btn">💾 Guardar</button>
      </div>

    </div>
  </form>
</template>

<style scoped>
.label{display:block;font-size:.85rem;color:#4b5563;margin-bottom:.35rem;font-weight:600}
.input{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none}
.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.grid{display:grid}
.span-2{grid-column:span 2 / span 2}
.actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}
.row-action{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:.5rem .9rem;cursor:pointer;font-weight:600}
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.55rem .9rem;font-weight:600;cursor:pointer}
.btn:hover{background:#1d4ed8}
</style>
