<script setup lang="ts">
import { reactive, computed, ref, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'

type TipoOpt = { id: number; nombre: string; categoria?: string | null }
type EstadoOpt = { id: number; nombre: string; categoria?: string | null }
type PickOpt = { id: number; label: string }

type Initial = {
  id_documento?: number        
  nombre_archivo?: string
  id_tipo_documento?: number | null
  id_estado_documento?: number | null
  fecha_caducidad?: string | null
  id_bus?: number | null
  id_usuario?: number | null
  id_mantenimiento?: number | null
  id_incidente?: number | null
}

const props = withDefaults(
  defineProps<{
    tipos?: TipoOpt[]
    estados?: EstadoOpt[]
    buses?: PickOpt[]
    usuarios?: PickOpt[]
    initial?: Initial
    mode?: 'create' | 'edit'
  }>(),
  {
    tipos: () => [],
    estados: () => [],
    buses: () => [],
    usuarios: () => [],
    initial: () => ({}),
    mode: 'create',
  }
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'save', payload: {
    id_documento?: number  
    file: File | null
    nombre_archivo: string
    id_tipo_documento: number
    id_estado_documento: number
    fecha_caducidad?: string
    id_bus?: number | null
    id_usuario?: number | null
    id_mantenimiento?: number | null
    id_incidente?: number | null
  }): void
}>()

const toast = useToast()


const form = reactive({
  id_documento: props.initial?.id_documento ?? undefined as number | undefined,
  file: null as File | null,
  nombre_archivo: props.initial?.nombre_archivo ?? '',
  id_tipo_documento: props.initial?.id_tipo_documento ?? ('' as number | ''),
  id_estado_documento: props.initial?.id_estado_documento ?? ('' as number | ''),
  fecha_caducidad: props.initial?.fecha_caducidad ?? '',
  id_bus: props.initial?.id_bus ?? null as number | null,
  id_usuario: props.initial?.id_usuario ?? null as number | null,
  id_mantenimiento: props.initial?.id_mantenimiento ?? null as number | null,
  id_incidente: props.initial?.id_incidente ?? null as number | null,
  error: '' as string,
})


const selectedCategoria = ref<string | ''>('')

const categorias = computed(() => {
  const set = new Set<string>()
  for (const t of props.tipos) {
    if (t.categoria) set.add(String(t.categoria))
  }
  return Array.from(set).sort()
})

const tiposFiltrados = computed(() => {
  if (!selectedCategoria.value) return props.tipos
  return props.tipos.filter(
    t => (t.categoria ?? '') === selectedCategoria.value
  )
})


onMounted(() => {
  if (form.id_tipo_documento) {
    const t = props.tipos.find(tt => tt.id === Number(form.id_tipo_documento))
    if (t?.categoria) {
      selectedCategoria.value = String(t.categoria)
    }
  }
})


const estadosOrdenados = computed(() => {
  const prioridadNombres = ['VIGENTE', 'POR VENCER', 'VENCIDO', 'ANULADO']
  const norm = (s: string) => s.trim().toUpperCase()

  const prioridad = (e: EstadoOpt) => {
    const idx = prioridadNombres.indexOf(norm(e.nombre))
    return idx === -1 ? prioridadNombres.length : idx
  }

  return [...props.estados].sort((a, b) => {
    const pa = prioridad(a)
    const pb = prioridad(b)
    if (pa !== pb) return pa - pb
    return a.nombre.localeCompare(b.nombre)
  })
})

const estadoVigenteId = computed<number | null>(() => {
  const est = estadosOrdenados.value.find(e =>
    e.nombre.trim().toUpperCase().includes('VIGENTE')
  )
  return est ? est.id : null
})

watch(
  () => form.fecha_caducidad,
  (val) => {
    if (!val && !form.id_estado_documento && estadoVigenteId.value) {
      form.id_estado_documento = estadoVigenteId.value
    }
  }
)


const selectedTipo = computed(() =>
  (props.tipos ?? []).find(t => t.id === Number(form.id_tipo_documento))
)

const categoriaTipo = computed(() =>
  (selectedTipo.value?.categoria || '').toString()
)

const categoriaLower = computed(() => categoriaTipo.value.toLowerCase())

const requiereBus = computed(
  () => categoriaLower.value === 'vehículo' || categoriaLower.value === 'vehiculo'
)
const requiereUsuario = computed(
  () => categoriaLower.value === 'conductor'
)
const requiereMantenimiento = computed(
  () => categoriaLower.value === 'mantenimiento'
)
const requiereIncidente = computed(
  () => categoriaLower.value === 'incidente'
)


function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  form.file = f
  if (f && !form.nombre_archivo) form.nombre_archivo = f.name

  const MAX_MB = 50
  if (f && f.size / (1024 * 1024) > MAX_MB) {
    form.error = `El archivo supera el máximo permitido (${MAX_MB} MB).`
    form.file = null
  } else {
    form.error = ''
  }
}

const incidentes = ref<PickOpt[]>([])
const incidentesLoading = ref(false)

async function loadIncidentes() {
  if (incidentesLoading.value) return
  incidentesLoading.value = true
  try {
    const res = await $fetch<{ items: any[] }>('/api/incidentes', {
      query: { pageSize: 50 },
    })
    const arr = Array.isArray(res.items) ? res.items : []
    incidentes.value = arr.map((x: any) => ({
      id: Number(x.id ?? x.id_incidente),
      label: String(
        x.titulo ??
        x.descripcion ??
        `Incidente #${x.id ?? x.id_incidente}`
      ),
    }))
  } catch {
    
  } finally {
    incidentesLoading.value = false
  }
}

watch(requiereIncidente, async (on) => {
  if (on && !incidentes.value.length) {
    await loadIncidentes()
  }
})


function buildErrors(): string[] {
  const errors: string[] = []


  if (props.mode === 'create' && !form.file) {
    errors.push('Archivo: debes seleccionar un archivo.')
  }

  const nombre = form.nombre_archivo.trim()
  if (!nombre) {
    errors.push('Nombre: es obligatorio.')
  } else if (nombre.length > 100) {
    errors.push('Nombre: máx 100 caracteres.')
  }

  if (!form.id_tipo_documento) {
    errors.push('Tipo: debes seleccionar uno.')
  }

  if (!form.id_estado_documento) {
    errors.push('Estado: debes seleccionar uno.')
  }

  if (requiereBus.value && !form.id_bus) {
    errors.push('Bus: debes seleccionar uno (categoría Vehículo).')
  }
  if (requiereUsuario.value && !form.id_usuario) {
    errors.push('Conductor: debes seleccionar uno (categoría Conductor).')
  }
  if (requiereMantenimiento.value && !form.id_mantenimiento) {
    errors.push('Mantenimiento: debes ingresar el ID (categoría Mantenimiento).')
  }
  if (requiereIncidente.value && !form.id_incidente) {
    errors.push('Incidente: debes seleccionar uno (categoría Incidente).')
  }

  return errors
}

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


function onSave() {
  const errors = buildErrors()
  if (errors.length) {
    form.error = errors[0] ?? ''
    showValidationToast(errors)
    return
  }

  emit('save', {
    id_documento: form.id_documento,  
    file: form.file,                  
    nombre_archivo: form.nombre_archivo.trim(),
    id_tipo_documento: Number(form.id_tipo_documento),
    id_estado_documento: Number(form.id_estado_documento),
    fecha_caducidad: form.fecha_caducidad || undefined,
    id_bus: form.id_bus ?? null,
    id_usuario: form.id_usuario ?? null,
    id_mantenimiento: form.id_mantenimiento ?? null,
    id_incidente: form.id_incidente ?? null,
  })
}
</script>

<template>
  <form @submit.prevent="onSave">
    <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
  
      <div class="span-2">
        <label class="label">
          Archivo
          <span v-if="mode === 'create'">*</span>
        </label>
        <input
          class="input"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
          @change="onFileChange"
        />
        <p v-if="mode === 'edit'" class="hint">
          Si no subes un archivo nuevo, se conserva el actual.
        </p>
        <p v-if="form.file" class="hint">
          Tamaño: {{ (form.file.size / 1024 / 1024).toFixed(2) }} MB
        </p>
      </div>


      <div class="span-2">
        <label class="label">Nombre *</label>
        <input
          class="input"
          v-model="form.nombre_archivo"
          placeholder="Nombre visible del documento"
        />
      </div>


      <div>
        <label class="label">Categoría</label>
        <select class="input" v-model="selectedCategoria">
          <option value="">Todas</option>
          <option
            v-for="c in categorias"
            :key="c"
            :value="c"
          >
            {{ c }}
          </option>
        </select>
      </div>


      <div>
        <label class="label">Tipo *</label>
        <select class="input" v-model.number="form.id_tipo_documento">
          <option :value="''" disabled>Selecciona tipo…</option>

          <option
            v-for="t in tiposFiltrados"
            :key="t.id"
            :value="t.id"
          >
            {{ t.nombre }}
          </option>
        </select>
      </div>

  
      <div>
        <label class="label">Estado *</label>
        <select class="input" v-model.number="form.id_estado_documento">
          <option :value="''" disabled>Selecciona estado…</option>
          <option
            v-for="e in estadosOrdenados"
            :key="e.id"
            :value="e.id"
          >
            {{ e.nombre }}
          </option>
        </select>
      </div>

      
      <div>
        <label class="label">Fecha de caducidad</label>
        <input
          class="input"
          type="date"
          v-model="form.fecha_caducidad"
        />
      </div>

 
      <div v-if="requiereBus">
        <label class="label">Bus *</label>
        <select class="input" v-model.number="form.id_bus">
          <option :value="null" disabled>Selecciona un bus…</option>
          <option v-for="b in props.buses" :key="b.id" :value="b.id">
            {{ b.label }}
          </option>
        </select>
      </div>


      <div v-if="requiereUsuario">
        <label class="label">Conductor *</label>
        <select class="input" v-model.number="form.id_usuario">
          <option :value="null" disabled>Selecciona un conductor…</option>
          <option v-for="u in props.usuarios" :key="u.id" :value="u.id">
            {{ u.label }}
          </option>
        </select>
      </div>


      <div v-if="requiereMantenimiento">
        <label class="label">ID Mantenimiento *</label>
        <input
          class="input"
          type="number"
          min="1"
          v-model.number="form.id_mantenimiento"
          placeholder="ID mantenimiento"
        />
      </div>

    
      <div v-if="requiereIncidente">
        <label class="label">Incidente *</label>
        <select class="input" v-model.number="form.id_incidente">
          <option :value="null" disabled>
            {{ incidentesLoading ? 'Cargando incidentes…' : 'Selecciona un incidente…' }}
          </option>
          <option
            v-for="i in incidentes"
            :key="i.id"
            :value="i.id"
          >
            {{ i.label }} (#{{ i.id }})
          </option>
        </select>
      </div>


      <p v-if="form.error" class="error span-2">⚠️ {{ form.error }}</p>


      <div class="actions span-2">
        <button
          type="button"
          class="row-action"
          @click="$emit('cancel')"
        >
          ✖ Cancelar
        </button>
        <button type="submit" class="btn">
          {{ mode === 'edit' ? '💾 Guardar cambios' : '💾 Guardar' }}
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.label{display:block;font-size:.85rem;color:#4b5563;margin-bottom:.35rem;font-weight:600}
.hint{font-size:.8rem;color:#6b7280;margin-top:.25rem}
.input, textarea.input, select.input{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none}
.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.grid{display:grid}
.span-2{grid-column:span 2 / span 2}
.actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.75rem}
.row-action{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:.45rem .8rem;cursor:pointer;font-weight:600;font-size:.9rem;min-width:100px;text-align:center}
.row-action:hover{background:#e5e7eb}
.btn{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.45rem .8rem;font-weight:600;cursor:pointer;font-size:.9rem;min-width:110px;text-align:center}
.btn:hover{background:#1d4ed8}
.error{color:#dc2626;margin-top:.5rem}
</style>
