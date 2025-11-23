<script setup lang="ts">
import { reactive } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const props = defineProps<{
  initial?: {
    id_taller?: number
    nombre?: string
    id_tipo_taller?: number
    contacto?: string
    direccion?: string
    email?: string
  }
  tipos: { id_tipo_taller:number; nombre_tipo:string }[]
}>()

const emit = defineEmits<{
  (e:'cancel'): void
  (e:'save', v:{
    id_taller?:number
    nombre:string
    id_tipo_taller:number
    contacto?:string
    direccion?:string
    email?:string
  }): void
}>()

const form = reactive({
  id_taller: props.initial?.id_taller,
  nombre: props.initial?.nombre ?? '',
  id_tipo_taller: props.initial?.id_tipo_taller ?? ('' as any),
  contacto: props.initial?.contacto ?? '',
  direccion: props.initial?.direccion ?? '',
  email: props.initial?.email ?? '',
})

/* ============== TOAST VALIDACIÓN ============== */
function showValidationToast(errors: string[]) {
  const msg =
    'Errores de Validación:\n' +
    errors.map(e => `- ${e}`).join('\n')

  toast.error(msg, {
    timeout: 8000,
    closeOnClick: true,
    pauseOnHover: true,
  })
}

/* ============== VALIDACIONES ============== */
function onSubmit() {
  const errors: string[] = []
  const nombre = form.nombre.trim()

  // Nombre
  if (!nombre) {
    errors.push('Nombre: es obligatorio.')
  } else {
    if (nombre.length < 3) {
      errors.push('Nombre: debe tener al menos 3 caracteres.')
    }
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(nombre)) {
      errors.push('Nombre: solo puede contener letras y espacios.')
    }
  }

  // Tipo de taller
  if (!form.id_tipo_taller) {
    errors.push('Tipo de Taller: es obligatorio.')
  }

  // Contacto — solo números, +, -, espacios
  if (form.contacto) {
    const contacto = form.contacto.trim()

    if (!/^[0-9+\-\s]+$/.test(contacto)) {
      errors.push('Contacto: solo puede contener números, +, - o espacios.')
    }

    const soloNumeros = contacto.replace(/[^\d]/g, '')

    if (soloNumeros.length < 8) {
      errors.push('Contacto: debe tener al menos 8 dígitos.')
    }
  }

  // Email
  if (form.email) {
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Correo electrónico: formato inválido.')
    }
  }

  if (errors.length) {
    showValidationToast(errors)
    return
  }

  emit('save', {
    ...(form.id_taller ? { id_taller: form.id_taller } : {}),
    nombre,
    id_tipo_taller: Number(form.id_tipo_taller),
    contacto: form.contacto || undefined,
    direccion: form.direccion || undefined,
    email: form.email || undefined,
  })
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="grid gap-3">
    <div class="grid sm:grid-cols-2 gap-3">
      
      <label class="field">
        <span>Nombre *</span>
        <input v-model="form.nombre" />
      </label>

      <label class="field">
        <span>Tipo de Taller *</span>
        <select v-model="form.id_tipo_taller">
          <option disabled value="">Seleccione tipo</option>
          <option
            v-for="t in tipos"
            :key="t.id_tipo_taller"
            :value="t.id_tipo_taller"
          >
            {{ t.nombre_tipo }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Contacto</span>
        <input
          v-model="form.contacto"
          @input="form.contacto = form.contacto.replace(/[^0-9+\-\s]/g, '')"
          placeholder="Ej: +56912345678"
        />
      </label>

      <label class="field">
        <span>Email</span>
        <input v-model="form.email" type="email" />
      </label>

      <label class="field" style="grid-column: 1 / -1">
        <span>Dirección</span>
        <input v-model="form.direccion" />
      </label>
    </div>

    <div style="display:flex;gap:.5rem;justify-content:flex-end">
      <button type="button" class="btn ghost" @click="$emit('cancel')">Cancelar</button>
      <button type="submit" class="btn">Guardar</button>
    </div>
  </form>
</template>

<style scoped>
.field{display:grid;gap:.35rem}
.field>span{font-size:.85rem;color:#4b5563;font-weight:600}
.field>input,.field>select{
  border:1px solid #e5e7eb;
  border-radius:10px;
  padding:.5rem .75rem;
}
.btn{
  background:#2563eb;
  color:#fff;
  border:none;
  border-radius:10px;
  padding:.55rem .9rem;
  font-weight:600;
  cursor:pointer;
}
.btn.ghost{background:#f3f4f6;color:#111827}
</style>
