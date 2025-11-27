<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

type Props = {
  initial?: {
    id?: number
    rut?: string
    nombre?: string
    apellido?: string
    email?: string
    username?: string
    telefono?: string
    licencia?: string
    roles?: string[]
  }
  allRoles: string[]
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', payload: {
    rut: string
    nombre: string
    apellido: string
    email: string
    username: string
    telefono?: string
    licencia?: string
    roles: string[]
  }): void
  (e: 'cancel'): void
  (e: 'resetPassword', id: number): void
}>()

const isEditing = computed(() => !!props.initial?.id)

const id        = ref<number | undefined>(props.initial?.id)
const rut       = ref<string>(props.initial?.rut ?? '')
const nombre    = ref<string>(props.initial?.nombre ?? '')
const apellido  = ref<string>(props.initial?.apellido ?? '')
const email     = ref<string>(props.initial?.email ?? '')
const username  = ref<string>(props.initial?.username ?? '')
const telefono  = ref<string>(props.initial?.telefono ?? '')
const licencia  = ref<string>(props.initial?.licencia ?? '')
const rolesSel  = ref<string[]>(props.initial?.roles ?? [])

// Mostrar SIEMPRE los 4 roles
const baseRoles = ['ADMINISTRADOR', 'PROPIETARIO', 'CONDUCTOR', 'SUPERVISOR']
const rolesUI = computed(() => {
  const set = new Set<string>([...baseRoles, ...(props.allRoles || [])])
  return Array.from(set)
})

watchEffect(() => {
  id.value       = props.initial?.id
  rut.value      = props.initial?.rut ?? ''
  nombre.value   = props.initial?.nombre ?? ''
  apellido.value = props.initial?.apellido ?? ''
  email.value    = props.initial?.email ?? ''
  username.value = props.initial?.username ?? ''
  telefono.value = props.initial?.telefono ?? ''
  licencia.value = props.initial?.licencia ?? ''
  rolesSel.value = props.initial?.roles ?? []
})

// Valida RUT chileno en formato 12345678-9 (sin puntos, con guión) 
function validarRutChilenoFront(raw: string): boolean {
  const value = raw.trim().toUpperCase()
  if (!/^\d{7,8}-[\dkK]$/.test(value)) return false

  const [cuerpo, dv] = value.split('-')
  if (!cuerpo || !dv) return false

  let suma = 0
  let multiplo = 2

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    const digit = cuerpo.charAt(i)
    suma += parseInt(digit, 10) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto = suma % 11
  const dvCalcNum = 11 - resto
  let dvCalc: string

  if (dvCalcNum === 11) dvCalc = '0'
  else if (dvCalcNum === 10) dvCalc = 'K'
  else dvCalc = String(dvCalcNum)

  return dv === dvCalc
}

// Normaliza el RUT (solo mayúsculas, sin espacios) 
function normalizarRut(raw: string): string {
  return raw.trim().toUpperCase()
}

// Validación de teléfono chileno SIN +56 → 912345678 */
function validarTelefono(raw: string): boolean {
  const clean = raw.replace(/\s+/g, '')
  if (!clean) return true // opcional
  return /^9\d{8}$/.test(clean)
}
function normalizarTelefono(raw: string): string {
  return raw.replace(/\s+/g, '')
}

//Valida TODOS los campos y devuelve lista de errores 
function validate(): string[] {
  const errors: string[] = []

  // RUT
  if (!rut.value.trim()) {
    errors.push('RUT: es obligatorio.')
  } else if (!validarRutChilenoFront(rut.value)) {
    errors.push('RUT: inválido. Usa el formato 12345678-9 (sin puntos).')
  }

  // Nombre (sin números)
  const soloLetras = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/
  if (!nombre.value.trim()) {
    errors.push('Nombre: es obligatorio.')
  } else if (!soloLetras.test(nombre.value.trim())) {
    errors.push('Nombre: no puede contener números ni símbolos.')
  }

  // Apellido (sin números)
  if (!apellido.value.trim()) {
    errors.push('Apellido: es obligatorio.')
  } else if (!soloLetras.test(apellido.value.trim())) {
    errors.push('Apellido: no puede contener números ni símbolos.')
  }

  // Email (simple, sin type="email" del navegador)
  if (!email.value.trim()) {
    errors.push('Email: es obligatorio.')
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.value.trim())) {
      errors.push('Email: formato inválido. Ejemplo: correo@ejemplo.cl')
    }
  }

  // Usuario
  if (!username.value.trim()) {
    errors.push('Usuario: es obligatorio.')
  } else if (username.value.trim().length < 3) {
    errors.push('Usuario: debe tener al menos 3 caracteres.')
  }

  // Teléfono (si viene, validar formato chileno)
  if (telefono.value && !validarTelefono(telefono.value)) {
    errors.push('Teléfono: usa el formato 912345678 (sin +56, sin espacios).')
  }

  return errors
}

function onSave() {
  const errors = validate()

  if (errors.length > 0) {
    const message =
      '⚠️ Errores de Validación (Revisar campos):\n- ' +
      errors.join('\n- ')

    toast.error(message, { timeout: 8000 })
    return
  }

  const rutNormalizado = normalizarRut(rut.value)
  const telNormalizado = telefono.value ? normalizarTelefono(telefono.value) : ''

  const payload = {
    rut: rutNormalizado,
    nombre: nombre.value.trim(),
    apellido: apellido.value.trim(),
    email: email.value.trim().toLowerCase(),
    username: username.value.trim(),
    telefono: telNormalizado || undefined,
    licencia: licencia.value.trim() || undefined,
    roles: rolesSel.value,
  }

  emit('save', payload)
}

function onResetPassword() {
  if (isEditing.value && id.value) emit('resetPassword', id.value)
}

function marcarTodos() {
  rolesSel.value = [...rolesUI.value]
}
function limpiarRoles() {
  rolesSel.value = []
}
</script>

<template>
  <form @submit.prevent="onSave">
    <div class="form-grid">
      <label>
        <span>RUT</span>
        <input
          v-model="rut"
          class="input"
          placeholder="12345678-9"
        />
        <small class="hint">Ejemplo: 12345678-9 (sin puntos)</small>
      </label>

      <label>
        <span>Nombre</span>
        <input v-model="nombre" class="input" placeholder="Juan" />
      </label>

      <label>
        <span>Apellido</span>
        <input v-model="apellido" class="input" placeholder="Pérez" />
      </label>

      <label>
        <span>Email</span>
        <input
          v-model="email"
          class="input"
          placeholder="correo@ejemplo.cl"
        />
      </label>

      <label>
        <span>Usuario</span>
        <input
          v-model="username"
          class="input"
          placeholder="jperez"
        />
      </label>

      <label>
        <span>Teléfono</span>
        <input
          v-model="telefono"
          class="input"
          placeholder="912345678"
        />
        <small class="hint">Ejemplo: 912345678 (sin +56, sin espacios)</small>
      </label>

      <label>
        <span>Licencia</span>
        <input
          v-model="licencia"
          class="input"
          placeholder="A2, A3, B, etc."
        />
      </label>

      <!-- ROLES -->
      <label class="roles">
        <span>Roles</span>
        <div class="roles-box">
          <label v-for="r in rolesUI" :key="r" class="chk">
            <input type="checkbox" :value="r" v-model="rolesSel" />
            <span>{{ r }}</span>
          </label>
        </div>
        <div class="roles-actions">
          <button type="button" class="btn ghost" @click="marcarTodos">✅ Marcar todos</button>
          <button type="button" class="btn ghost" @click="limpiarRoles">🧹 Limpiar</button>
        </div>
      </label>

      <div class="actions">
        <button class="btn" type="submit">
          💾 {{ isEditing ? 'Guardar Cambios' : 'Crear Usuario' }}
        </button>
        <button class="btn ghost" type="button" @click="$emit('cancel')">✖ Cancelar</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem 1rem}
.roles{grid-column:1 / -1;display:flex;flex-direction:column;gap:.5rem}
.roles-box{display:flex;gap:.75rem;flex-wrap:wrap;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem}
.roles-actions{display:flex;gap:.5rem}
.chk{display:flex;align-items:center;gap:.35rem}
.actions{grid-column:1 / -1;display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem}
label>span{display:block;font-size:.85rem;margin-bottom:.25rem;color:#374151;font-weight:600}
.input,textarea.input{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none}
.input:focus,textarea.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.55rem .9rem;font-weight:600;cursor:pointer}
.btn:hover{background:#1d4ed8}
.btn.ghost{background:#f3f4f6;color:#111827}
.btn.ghost:hover{background:#e5e7eb}
.hint{font-size:.78rem;color:#6b7280;display:block;margin-top:.1rem}
</style>
