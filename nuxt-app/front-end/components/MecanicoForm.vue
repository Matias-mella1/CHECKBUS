<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useToast } from 'vue-toastification'

const toast = useToast()

const props = defineProps<{
  initial?: { id_mecanico?:number; id_taller?:number; nombre?:string; apellido?:string }
  talleres: { id_taller:number; nombre:string }[]
}>()

const emit = defineEmits<{
  (e:'cancel'):void
  (e:'save', v:{ id_mecanico?:number; id_taller:number; nombre:string; apellido:string }):void
}>()

const form = reactive({
  id_mecanico: props.initial?.id_mecanico,
  id_taller: props.initial?.id_taller ?? ('' as unknown as number|''),
  nombre: props.initial?.nombre ?? '',
  apellido: props.initial?.apellido ?? '',
})
const saving = ref(false)

// ---- Toast de validación (SOLO TEXTO) ----
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

function validate(): boolean {
  const errors: string[] = []

  // Taller
  if (!form.id_taller) {
    errors.push('Taller: es obligatorio.')
  }

  // Nombre
  const nombre = form.nombre.trim()
  if (!nombre) {
    errors.push('Nombre: es obligatorio.')
  } else if (nombre.length < 2) {
    errors.push('Nombre: debe tener al menos 2 caracteres.')
  }

  // Apellido
  const apellido = form.apellido.trim()
  if (!apellido) {
    errors.push('Apellido: es obligatorio.')
  } else if (apellido.length < 2) {
    errors.push('Apellido: debe tener al menos 2 caracteres.')
  }

  if (errors.length) {
    showValidationToast(errors)
    return false
  }
  return true
}

async function onSubmit(){
  if (!validate()) return

  try {
    saving.value = true
    emit('save', {
      ...(form.id_mecanico ? { id_mecanico: form.id_mecanico } : {}),
      id_taller: Number(form.id_taller),
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="grid gap-3">
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="field">
        <span>Taller</span>
        <select v-model="form.id_taller">
          <option disabled :value="''">Seleccione</option>
          <option
            v-for="t in talleres"
            :key="t.id_taller"
            :value="t.id_taller"
          >
            {{ t.nombre }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Nombre</span>
        <input v-model="form.nombre" />
      </label>

      <label class="field">
        <span>Apellido</span>
        <input v-model="form.apellido" />
      </label>
    </div>

    <div class="actions">
      <button
        type="button"
        class="btn ghost"
        @click="$emit('cancel')"
        :disabled="saving"
      >
        Cancelar
      </button>
      <button
        type="submit"
        class="btn"
        :disabled="saving"
      >
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
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
  cursor:pointer;
}
.btn.ghost{
  background:#f3f4f6;
  color:#111827;
}
.actions{
  display:flex;
  gap:.5rem;
  justify-content:flex-end;
}
</style>
