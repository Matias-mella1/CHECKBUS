<script setup lang="ts">
import { ref, reactive, computed, watchEffect } from 'vue'
import MantenimientoForm from '../../components/MantenimientoForm.vue'
import { useToast } from 'vue-toastification'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })
const toast = useToast()

/*  Auth / Roles */
const { user } = useAuth()

const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})

const isAdmin = computed(() =>
  rolesUsuario.value.includes('ADMINISTRADOR') ||
  rolesUsuario.value.includes('ADMIN')
)

const isPropietario = computed(() =>
  rolesUsuario.value.includes('PROPIETARIO')
)

const isSupervisor = computed(() =>
  rolesUsuario.value.includes('SUPERVISOR')
)

// Permisos
const canCreate = computed(() => isAdmin.value || isPropietario.value)
const canEdit = computed(() => isAdmin.value || isPropietario.value)
const canDelete = computed(() => isAdmin.value)                     // solo admin
const canChangeStatus = computed(() => isAdmin.value || isPropietario.value)
const canEditRelaciones = computed(() => isAdmin.value || isPropietario.value) // repuestos/mecánicos

/* Tipos  */
type CatalogBus = { id_bus:number; patente:string }
type CatalogTaller = { id_taller:number; nombre:string }
type CatalogTipo = { id_tipo_mantenimiento:number; nombre_tipo:string }
type CatalogEstado = { id_estado_mantenimiento:number; nombre_estado:string }

type Row = {
  id_mantenimiento: number
  id_bus: number
  id_taller: number
  id_tipo_mantenimiento: number
  id_estado_mantenimiento: number
  fecha: string | Date
  observaciones?: string | null
  costo?: number | null
  costo_mano_obra?: number | null
  costo_repuestos?: number | null
  costo_total?: number | null
  bus?: CatalogBus | null
  taller?: CatalogTaller | null
  tipo?: CatalogTipo | null
  estado?: CatalogEstado | null
}

type RepuestoMant = {
  id_repuesto: number
  id_mantenimiento: number
  cantidad: number
  repuesto: {
    id_repuesto: number
    nombre: string
    descripcion: string
    costo: number
    estado: string
    tipo: string
    proveedor: string
  }
}

type MecanicoMant = {
  id_mecanico: number
  id_mantenimiento: number
  actividad: string
  mecanico: {
    id_mecanico: number
    nombre: string
    apellido: string
    id_taller: number
    taller: { id_taller: number; nombre: string } | null
  }
}

/*  Filtros  */
const search = reactive({
  q: '',
  id_bus: '' as number | '',
  id_taller: '' as number | '',
  id_tipo_mantenimiento: '' as number | '',
  id_estado_mantenimiento: '' as number | '',
  from: '',
  to: ''
})

/* ========= Catálogos ========= */
const { buses, talleres, tipos, estados } = await $fetch<{
  buses: CatalogBus[]
  talleres: CatalogTaller[]
  tipos: CatalogTipo[]
  estados: CatalogEstado[]
}>('/api/mantenimientos/catalogos')

const items = ref<Row[]>([])
const loading = ref(false)
const errorMsg = ref('')

const estadoKey = (row: Row) =>
  (row.estado?.nombre_estado ?? '').toUpperCase()

const estadoConfig: Record<string, { class: string; icon: string }> = {
  PENDIENTE:   { class: 'badge badge-yellow', icon: '⏳' },
  'EN PROCESO':{ class: 'badge badge-blue',   icon: '🔧' },
  COMPLETADO:  { class: 'badge badge-green',  icon: '✅' },
  ANULADO:     { class: 'badge badge-red',    icon: '🚫' }
}

const badgeClass = (row: Row) => estadoConfig[estadoKey(row)]?.class ?? 'badge'
const badgeIcon  = (row: Row) => estadoConfig[estadoKey(row)]?.icon  ?? '•'

const isPendiente = (r:Row) => estadoKey(r) === 'PENDIENTE'
const isEnProceso = (r:Row) => estadoKey(r) === 'EN PROCESO'
const isAnulado   = (r:Row) => estadoKey(r) === 'ANULADO'

function toDateOnly(value: string | Date): string {
  if (!value) return ''
  const d = new Date(value as any)
  return Number.isNaN(+d)
    ? String(value).slice(0, 10)
    : d.toISOString().slice(0, 10)
}

/*  Carga lista principal */
async function load () {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{items:Row[]}>('/api/mantenimientos', {
      query: {
        q: search.q || undefined,
        id_bus: search.id_bus || undefined,
        id_taller: search.id_taller || undefined,
        id_tipo_mantenimiento: search.id_tipo_mantenimiento || undefined,
        id_estado_mantenimiento: search.id_estado_mantenimiento || undefined,
        from: search.from || undefined,
        to: search.to || undefined
      }
    })

    items.value = (res.items || []).map((r: any) => {
      const base = r.costo_total ?? r.costo ?? null
      const baseNum = base != null ? Number(base) : null
      return {
        ...r,
        costo: baseNum,
        costo_mano_obra: r.costo_mano_obra != null ? Number(r.costo_mano_obra) : null,
        costo_repuestos: r.costo_repuestos != null ? Number(r.costo_repuestos) : null,
        costo_total: r.costo_total != null ? Number(r.costo_total) : baseNum
      } as Row
    })
  } catch (e:any) {
    errorMsg.value = e?.data?.message || 'Error cargando mantenimientos'
  } finally {
    loading.value = false
  }
}

watchEffect(load)
const filtered = computed(() => items.value)

/* ========= Form / Relaciones ========= */
const showForm = ref(false)
const showRelaciones = ref(false)
const editing = ref<Row | null>(null)

const repuestosMant = ref<RepuestoMant[]>([])
const mecanicosMant = ref<MecanicoMant[]>([])
const loadingRel = ref(false)
const relError = ref('')

const catalogoRepuestos = ref<{ id:number; nombre:string }[]>([])
const catalogoMecanicos = ref<{ id:number; nombre:string }[]>([])

const nuevoRepuesto = reactive<{ id_repuesto:number|''; cantidad:number }>({
  id_repuesto: '' as number | '',
  cantidad: 1
})

const nuevoMecanico = reactive<{ id_mecanico:number|''; actividad:string }>({
  id_mecanico: '' as number | '',
  actividad: ''
})

const totalRepuestos = computed(() =>
  repuestosMant.value.reduce((acc, r) => acc + r.cantidad * (r.repuesto.costo ?? 0), 0)
)
const manoObra = computed(
  () => editing.value?.costo_mano_obra ?? editing.value?.costo ?? 0
)
const totalMantencion = computed(
  () => manoObra.value + totalRepuestos.value
)

async function reloadEditingMant () {
  if (!editing.value?.id_mantenimiento) return
  await load()
  const updated = items.value.find(i => i.id_mantenimiento === editing.value?.id_mantenimiento)
  if (updated) editing.value = { ...editing.value, ...updated }
}

/* ABM Mantención */
function openCreate () {
  if (!canCreate.value) return
  editing.value = null
  showForm.value = true
  repuestosMant.value = []
  mecanicosMant.value = []
  relError.value = ''
}

function openEditMant (row: Row) {
  if (!canEdit.value) return
  if (isAnulado(row)) return
  editing.value = { ...row }
  showForm.value = true
}

async function openRelaciones (row: Row) {
  // Todos pueden VER, pero solo admin/propietario pueden editar
  editing.value = { ...row }
  showRelaciones.value = true
  repuestosMant.value = []
  mecanicosMant.value = []
  relError.value = ''
  loadingRel.value = true
  try {
    await Promise.all([
      loadRepuestosMant(row.id_mantenimiento),
      loadMecanicosMant(row.id_mantenimiento),
      loadCatalogoRepuestos(),
      loadCatalogoMecanicos()
    ])
  } finally {
    loadingRel.value = false
  }
}

async function removeRow (id: number) {
  if (!canDelete.value) {
    toast.error('Solo un administrador puede eliminar mantenciones.')
    return
  }
  if (!confirm('¿Eliminar mantenimiento?')) return
  try {
    await $fetch(`/api/mantenimientos/${id}`, { method: 'DELETE' } as any)
    await load()
    toast.success('🗑️ Mantención eliminada correctamente.')
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo eliminar la mantención')
  }
}

function toFormInitial (r: Row | null | undefined) {
  if (!r) return undefined
  return {
    id_mantenimiento: r.id_mantenimiento,
    id_bus: r.id_bus,
    id_taller: r.id_taller,
    id_tipo_mantenimiento: r.id_tipo_mantenimiento,
    id_estado_mantenimiento: r.id_estado_mantenimiento,
    fecha: toDateOnly(r.fecha),
    costo: r.costo_mano_obra ?? r.costo ?? undefined,
    observaciones: r.observaciones ?? ''
  }
}

type SavePayload = {
  id_mantenimiento?: number
  id_bus: number
  id_taller: number
  id_tipo_mantenimiento: number
  id_estado_mantenimiento: number
  fecha: string
  costo?: number
  observaciones?: string | null
}

async function save (payload: SavePayload) {
  if (!canEdit.value && !canCreate.value) return

  const body: any = { ...payload, fecha: toDateOnly(payload.fecha) }
  if (body.costo !== undefined) {
    body.costo_mano_obra = body.costo
    delete body.costo
  }

  try {
    if (payload.id_mantenimiento) {
      const { id_mantenimiento, ...rest } = body
      await $fetch(`/api/mantenimientos/${payload.id_mantenimiento}`, {
        method: 'PUT',
        body: rest
      } as any)
      toast.success('✅ Mantención actualizada correctamente.')
    } else {
      await $fetch('/api/mantenimientos', { method: 'POST', body } as any)
      toast.success('🎉 Mantención creada con éxito.')
    }
    showForm.value = false
    await load()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo guardar la mantención')
  }
}

/*  Cambiar estado */
function findEstadoIdByNombre(nombre: string): number | null {
  const e = estados.find(e =>
    e.nombre_estado.toUpperCase() === nombre.toUpperCase()
  )
  return e?.id_estado_mantenimiento ?? null
}

async function cambiarEstado(
  row: Row,
  nuevoEstadoNombre: 'PENDIENTE' | 'EN PROCESO' | 'COMPLETADO' | 'ANULADO'
) {
  if (!canChangeStatus.value) return

  const idEstado = findEstadoIdByNombre(nuevoEstadoNombre)
  if (!idEstado) {
    toast.error(`No se encontró el estado "${nuevoEstadoNombre}".`)
    return
  }

  if (nuevoEstadoNombre === 'COMPLETADO' && !confirm('¿Marcar mantención como COMPLETADA?')) return
  if (nuevoEstadoNombre === 'ANULADO' && !confirm('¿ANULAR esta mantención?')) return

  try {
    await $fetch(`/api/mantenimientos/${row.id_mantenimiento}`, {
      method: 'PUT',
      body: {
        id_bus: row.id_bus,
        id_taller: row.id_taller,
        id_tipo_mantenimiento: row.id_tipo_mantenimiento,
        id_estado_mantenimiento: idEstado,
        fecha: toDateOnly(row.fecha),
        costo_mano_obra: row.costo_mano_obra ?? row.costo ?? undefined,
        observaciones: row.observaciones ?? undefined
      }
    } as any)

    row.id_estado_mantenimiento = idEstado
    row.estado = { id_estado_mantenimiento: idEstado, nombre_estado: nuevoEstadoNombre }
    toast.success(`Estado cambiado a ${nuevoEstadoNombre}.`)
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo cambiar el estado')
  }
}

/* Repuestos  */
async function loadRepuestosMant (id_mantenimiento: number) {
  try {
    const res = await $fetch<{ items: RepuestoMant[] }>(
      `/api/mantenimientos/${id_mantenimiento}/repuestos`
    )
    repuestosMant.value = res.items
  } catch (e:any) {
    relError.value = e?.data?.message || 'Error cargando repuestos del mantenimiento'
  }
}

async function loadCatalogoRepuestos () {
  const res = await $fetch<any>('/api/repuestos', {
    query: { pageSize: 200 },
    headers: { 'Cache-Control': 'no-store' }
  })
  const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : [])
  catalogoRepuestos.value = list.map((r:any) => ({
    id: Number(r.id ?? r.id_repuesto ?? 0),
    nombre: String(r.nombre ?? '')
  }))
}

async function addRepuestoToMant () {
  if (!canEditRelaciones.value) return
  if (!editing.value?.id_mantenimiento) return
  if (!nuevoRepuesto.id_repuesto) {
    toast.error('Selecciona un repuesto')
    return
  }
  try {
    await $fetch(`/api/mantenimientos/${editing.value.id_mantenimiento}/repuestos`, {
      method: 'POST',
      body: {
        id_repuesto: nuevoRepuesto.id_repuesto,
        cantidad: nuevoRepuesto.cantidad || 1
      }
    } as any)

    nuevoRepuesto.id_repuesto = '' as any
    nuevoRepuesto.cantidad = 1

    await loadRepuestosMant(editing.value.id_mantenimiento)
    await reloadEditingMant()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo agregar el repuesto')
  }
}

async function removeRepuestoFromMant (id_repuesto:number) {
  if (!canEditRelaciones.value) return
  if (!editing.value?.id_mantenimiento) return
  if (!confirm('¿Quitar repuesto de esta mantención?')) return
  try {
    await $fetch(
      `/api/mantenimientos/${editing.value.id_mantenimiento}/repuestos/${id_repuesto}`,
      { method: 'DELETE' } as any
    )

    await loadRepuestosMant(editing.value.id_mantenimiento)
    await reloadEditingMant()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo quitar el repuesto')
  }
}

/* ========= Mecánicos ========= */
async function loadMecanicosMant (id_mantenimiento: number) {
  try {
    const res = await $fetch<{ items: MecanicoMant[] }>(
      `/api/mantenimientos/${id_mantenimiento}/mecanicos`
    )
    mecanicosMant.value = res.items
  } catch (e:any) {
    relError.value = e?.data?.message || 'Error cargando mecánicos del mantenimiento'
  }
}

async function loadCatalogoMecanicos () {
  const res = await $fetch<{ items:any[] }>('/api/mecanicos', {
    headers: { 'Cache-Control': 'no-store' }
  })
  catalogoMecanicos.value = res.items.map(m => ({
    id: m.id_mecanico,
    nombre: `${m.nombre} ${m.apellido}`.trim()
  }))
}

async function addMecanicoToMant () {
  if (!canEditRelaciones.value) return
  if (!editing.value?.id_mantenimiento) return
  if (!nuevoMecanico.id_mecanico) {
    toast.error('Selecciona un mecánico')
    return
  }
  try {
    await $fetch(`/api/mantenimientos/${editing.value.id_mantenimiento}/mecanicos`, {
      method: 'POST',
      body: {
        id_mecanico: nuevoMecanico.id_mecanico,
        actividad: nuevoMecanico.actividad || null
      }
    } as any)

    nuevoMecanico.id_mecanico = '' as any
    nuevoMecanico.actividad = ''

    await loadMecanicosMant(editing.value.id_mantenimiento)
    await reloadEditingMant()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo agregar el mecánico')
  }
}

async function removeMecanicoFromMant (id_mecanico:number) {
  if (!canEditRelaciones.value) return
  if (!editing.value?.id_mantenimiento) return
  if (!confirm('¿Quitar mecánico de esta mantención?')) return
  try {
    await $fetch(
      `/api/mantenimientos/${editing.value.id_mantenimiento}/mecanicos/${id_mecanico}`,
      { method: 'DELETE' } as any
    )

    await loadMecanicosMant(editing.value.id_mantenimiento)
    await reloadEditingMant()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo quitar el mecánico')
  }
}

async function saveRelaciones () {
  if (!canEditRelaciones.value) return
  if (!editing.value?.id_mantenimiento) return
  const id = editing.value.id_mantenimiento

  loadingRel.value = true
  relError.value = ''
  try {
    // Actualizar repuestos actuales
    for (const r of repuestosMant.value) {
      await $fetch(
        `/api/mantenimientos/${id}/repuestos/${r.id_repuesto}`,
        { method: 'DELETE' } as any
      )
      await $fetch(`/api/mantenimientos/${id}/repuestos`, {
        method: 'POST',
        body: {
          id_repuesto: r.id_repuesto,
          cantidad: r.cantidad
        }
      } as any)
    }

    // Actualizar mecánicos actuales
    for (const m of mecanicosMant.value) {
      await $fetch(
        `/api/mantenimientos/${id}/mecanicos/${m.id_mecanico}`,
        { method: 'DELETE' } as any
      )
      await $fetch(`/api/mantenimientos/${id}/mecanicos`, {
        method: 'POST',
        body: {
          id_mecanico: m.id_mecanico,
          actividad: m.actividad || null
        }
      } as any)
    }

    await Promise.all([
      loadRepuestosMant(id),
      loadMecanicosMant(id),
      reloadEditingMant()
    ])

    toast.success('Cambios de repuestos y mecánicos guardados correctamente.')
    showRelaciones.value = false
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudieron guardar los cambios')
  } finally {
    loadingRel.value = false
  }
}

function fmtFecha (d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function fmtMoney (n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(n)
}
</script>

<template>
  <div class="grid">
    <!-- Filtros -->
    <div class="card">
      <h3 class="card-title">
        Mantenimientos
        <span class="chip">
          <template v-if="isAdmin">Admin</template>
          <template v-else-if="isPropietario">Propietario</template>
          <template v-else-if="isSupervisor">Supervisor (solo lectura)</template>
        </span>
      </h3>

      <div class="filters">
        <div>
          <label class="label">Bus</label>
          <select class="input" v-model.number="search.id_bus">
            <option value="">Todos</option>
            <option v-for="b in buses" :key="b.id_bus" :value="b.id_bus">
              #{{ b.id_bus }} - {{ b.patente }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Taller</label>
          <select class="input" v-model.number="search.id_taller">
            <option value="">Todos</option>
            <option v-for="t in talleres" :key="t.id_taller" :value="t.id_taller">
              {{ t.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select class="input" v-model.number="search.id_tipo_mantenimiento">
            <option value="">Todos</option>
            <option
              v-for="t in tipos"
              :key="t.id_tipo_mantenimiento"
              :value="t.id_tipo_mantenimiento"
            >
              {{ t.nombre_tipo }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Estado</label>
          <select class="input" v-model.number="search.id_estado_mantenimiento">
            <option value="">Todos</option>
            <option
              v-for="e in estados"
              :key="e.id_estado_mantenimiento"
              :value="e.id_estado_mantenimiento"
            >
              {{ e.nombre_estado }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Desde</label>
          <input class="input" type="date" v-model="search.from" />
        </div>

        <div>
          <label class="label">Hasta</label>
          <input class="input" type="date" v-model="search.to" />
        </div>

        <div class="filters-actions">
          <button
            class="btn"
            v-if="canCreate"
            @click="openCreate"
          >
            + Nueva mantención
          </button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- Lista -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando...</div>
      <div v-else-if="filtered.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="mant-list">
        <article
          v-for="m in filtered"
          :key="m.id_mantenimiento"
          class="mant-card"
        >
          <header class="mant-card-header">
            <div class="mant-main-info">
              <div class="mant-icon">🛠️</div>
              <div>
                <div class="mant-title">
                  Mantención #{{ m.id_mantenimiento }}
                </div>
                <div class="mant-subtitle">
                  Bus {{ m.bus?.patente ?? '—' }}
                  <span v-if="m.tipo"> · {{ m.tipo?.nombre_tipo }}</span>
                </div>
                <div class="mant-subtitle">
                  Taller: {{ m.taller?.nombre ?? '—' }}
                </div>
              </div>
            </div>

            <span :class="badgeClass(m)">
              <span class="badge-icon">{{ badgeIcon(m) }}</span>
              <span>{{ m.estado?.nombre_estado ?? '—' }}</span>
            </span>
          </header>

          <section class="mant-card-body">
            <div class="mant-metric">
              <span class="metric-label">Fecha</span>
              <span class="metric-value">{{ fmtFecha(m.fecha) }}</span>
            </div>
            <div class="mant-metric">
              <span class="metric-label">Mano de obra</span>
              <span class="metric-value">{{ fmtMoney(m.costo_mano_obra) }}</span>
            </div>
            <div class="mant-metric">
              <span class="metric-label">Repuestos</span>
              <span class="metric-value">{{ fmtMoney(m.costo_repuestos) }}</span>
            </div>
            <div class="mant-metric">
              <span class="metric-label">Total</span>
              <span class="metric-value">{{ fmtMoney(m.costo_total) }}</span>
            </div>
            <div class="mant-metric mant-metric-wide">
              <span class="metric-label">Observaciones</span>
              <span class="metric-value">
                {{ m.observaciones?.slice(0, 120) ?? '—' }}
                <span v-if="m.observaciones && m.observaciones.length > 120">…</span>
              </span>
            </div>
          </section>

          <footer class="mant-card-footer">
            <button class="btn-outline" type="button" @click="openRelaciones(m)">
              Ver repuestos y mecánicos
            </button>

            <div class="mant-footer-actions">
              <div class="mant-status-actions">
                <button
                  v-if="canChangeStatus && isPendiente(m)"
                  class="row-action"
                  type="button"
                  title="Marcar EN PROCESO"
                  @click="cambiarEstado(m, 'EN PROCESO')"
                >
                  🔧 En proceso
                </button>

                <button
                  v-if="canChangeStatus && isEnProceso(m)"
                  class="row-action"
                  type="button"
                  title="Marcar COMPLETADO"
                  @click="cambiarEstado(m, 'COMPLETADO')"
                >
                  ✅ Completar
                </button>

                <button
                  v-if="canChangeStatus && (isPendiente(m) || isEnProceso(m))"
                  class="row-action danger"
                  type="button"
                  title="Anular mantención"
                  @click="cambiarEstado(m, 'ANULADO')"
                >
                  🚫 Anular
                </button>
              </div>

              <div class="mant-crud-actions">
                <button
                  class="btn-outline"
                  type="button"
                  title="Editar mantención"
                  v-if="canEdit"
                  @click="openEditMant(m)"
                  :disabled="isAnulado(m)"
                >
                  Editar
                </button>
                <button
                  class="btn-outline danger-outline"
                  type="button"
                  title="Eliminar"
                  v-if="canDelete"
                  @click="removeRow(m.id_mantenimiento)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>

    <!-- Modal mantención -->
    <div v-if="showForm" class="backdrop">
      <div class="card modal md">
        <h3 class="card-title">
          {{ editing ? 'Editar mantención' : 'Nueva mantención' }}
        </h3>

        <MantenimientoForm
          :initial="toFormInitial(editing)"
          :buses="buses"
          :talleres="talleres"
          :tipos="tipos"
          :estados="estados"
          @cancel="showForm=false"
          @save="save"
          @validationError="msg => toast.error(msg, { timeout: 8000 })"
        />
      </div>
    </div>

    <!-- Modal relaciones -->
    <div v-if="showRelaciones && editing?.id_mantenimiento" class="backdrop">
      <div class="card modal lg">
        <h3 class="card-title">
          Mantención #{{ editing.id_mantenimiento }} – Repuestos y mecánicos
        </h3>

        <p v-if="relError" class="error">{{ relError }}</p>
        <p v-if="loadingRel" class="muted">Cargando repuestos y mecánicos...</p>

        <div class="rel-grid">
          <!-- Repuestos -->
          <div>
            <h4 class="subtitle">Repuestos de la mantención</h4>

            <!-- Toolbar solo para admin / propietario -->
            <div class="rel-toolbar" v-if="canEditRelaciones">
              <select class="input" v-model.number="nuevoRepuesto.id_repuesto">
                <option :value="''">Selecciona repuesto…</option>
                <option v-for="r in catalogoRepuestos" :key="r.id" :value="r.id">
                  {{ r.nombre }}
                </option>
              </select>
              <input
                class="input w-90"
                type="number"
                min="1"
                v-model.number="nuevoRepuesto.cantidad"
              />
              <button class="btn" type="button" @click="addRepuestoToMant" :disabled="loadingRel">
                + Agregar
              </button>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Cantidad</th>
                  <th>Costo unit.</th>
                  <th>Proveedor</th>
                  <th class="w-actions"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="repuestosMant.length === 0">
                  <td colspan="6" class="empty-row">
                    Sin repuestos asociados
                  </td>
                </tr>
                <tr v-for="r in repuestosMant" :key="r.id_repuesto">
                  <td>{{ r.id_repuesto }}</td>
                  <td>{{ r.repuesto.nombre }}</td>
                  <td>
                    <input
                      class="input w-80"
                      type="number"
                      min="1"
                      v-model.number="r.cantidad"
                      :disabled="!canEditRelaciones"
                    />
                  </td>
                  <td>{{ fmtMoney(r.repuesto.costo) }}</td>
                  <td>{{ r.repuesto.proveedor }}</td>
                  <td class="row-actions">
                    <button
                      class="row-action danger"
                      type="button"
                      title="Quitar repuesto"
                      v-if="canEditRelaciones"
                      @click="removeRepuestoFromMant(r.id_repuesto)"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
                <tr v-if="repuestosMant.length > 0">
                  <td colspan="3" class="text-right bold">Total repuestos</td>
                  <td colspan="3">{{ fmtMoney(totalRepuestos) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mecánicos -->
          <div>
            <h4 class="subtitle">Mecánicos de la mantención</h4>

            <!-- Toolbar solo para admin / propietario -->
            <div class="rel-toolbar" v-if="canEditRelaciones">
              <select class="input" v-model.number="nuevoMecanico.id_mecanico">
                <option :value="''">Selecciona mecánico…</option>
                <option v-for="m in catalogoMecanicos" :key="m.id" :value="m.id">
                  {{ m.nombre }}
                </option>
              </select>
              <input
                class="input"
                v-model="nuevoMecanico.actividad"
                placeholder="Actividad (opcional)"
              />
              <button class="btn" type="button" @click="addMecanicoToMant" :disabled="loadingRel">
                + Agregar
              </button>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mecánico</th>
                  <th>Taller</th>
                  <th>Actividad</th>
                  <th class="w-actions"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="mecanicosMant.length === 0">
                  <td colspan="5" class="empty-row">
                    Sin mecánicos asociados
                  </td>
                </tr>
                <tr v-for="m in mecanicosMant" :key="m.id_mecanico">
                  <td>{{ m.id_mecanico }}</td>
                  <td>{{ m.mecanico.nombre }} {{ m.mecanico.apellido }}</td>
                  <td>{{ m.mecanico.taller?.nombre ?? '—' }}</td>
                  <td>
                    <input
                      class="input"
                      v-model="m.actividad"
                      placeholder="Actividad"
                      :disabled="!canEditRelaciones"
                    />
                  </td>
                  <td class="row-actions">
                    <button
                      class="row-action danger"
                      type="button"
                      title="Quitar mecánico"
                      v-if="canEditRelaciones"
                      @click="removeMecanicoFromMant(m.id_mecanico)"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="editing" class="summary-costs">
          <div>Mano de obra: {{ fmtMoney(manoObra) }}</div>
          <div>Total repuestos: {{ fmtMoney(totalRepuestos) }}</div>
          <div class="summary-total">Total mantención: {{ fmtMoney(totalMantencion) }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn-outline" type="button" @click="showRelaciones=false">
            Cerrar
          </button>
          <button
            class="btn"
            type="button"
            v-if="canEditRelaciones"
            @click="saveRelaciones"
            :disabled="loadingRel"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid{display:grid;gap:1rem;}
.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);padding:1rem;}
.card-title{margin:0 0 .75rem 0;display:flex;align-items:center;gap:.5rem;}
.subtitle{margin:0 0 .5rem 0;}
.chip{background:#eef;border-radius:999px;padding:.1rem .6rem;font-size:.8rem;border:1px solid #d1d5db;}
.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem 1rem;align-items:end;}
.filters-actions{grid-column:-2/-1;display:flex;align-items:end;justify-content:end;}
.label{display:block;font-size:.85rem;color:#4b5563;margin-bottom:.35rem;font-weight:600;}
.input{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:.5rem .75rem;outline:none;}
.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25);}
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:.55rem .9rem;font-weight:600;cursor:pointer;}
.btn:hover{background:#1d4ed8;}
.btn-outline{border:1px solid #d1d5db;background:#f9fafb;padding:.45rem .9rem;border-radius:10px;font-weight:600;cursor:pointer;}
.btn-outline:hover{border-color:#2563eb;background:#e8edff;}
.danger-outline{color:#b91c1c;background:#fef2f2;}
.danger-outline:hover{background:#fee2e2;border-color:#ef4444;}
.list-empty{padding:2rem;text-align:center;color:#6b7280;}
.mant-list{display:flex;flex-direction:column;gap:1rem;}
.mant-card{border-radius:16px;border:1px solid #d4e0f0;;padding:1rem 1.25rem;background:rgba(118,184,245,0.14);box-shadow:0 8px 20px rgba(0,0,0,.05);}
.mant-card-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;}
.mant-main-info{display:flex;align-items:center;gap:1rem;}
.mant-icon{width:50px;height:50px;background:#eef2ff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;}
.mant-title{font-size:1.1rem;font-weight:700;}
.mant-subtitle{color:#6b7280;font-size:.85rem;}
.mant-card-body{margin-top:1rem;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;}
.mant-metric{background:#f9fafb;border-radius:12px;padding:.7rem;}
.mant-metric-wide{grid-column:1/-1;}
.metric-label{font-size:.7rem;color:#9ca3af;text-transform:uppercase;}
.metric-value{font-size:.95rem;font-weight:600;}
.mant-card-footer{margin-top:1rem;padding-top:.75rem;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:.75rem;}
.mant-footer-actions{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
.mant-status-actions,.mant-crud-actions{display:flex;gap:.35rem;flex-wrap:wrap;}
.table{width:100%;border-collapse:collapse;}
.table thead th{text-align:left;font-size:.9rem;color:#374151;background:#f3f4f6;padding:.65rem .75rem;}
.table tbody td{border-top:1px solid #e5e7eb;padding:.65rem .75rem;}
.table tbody tr:hover{background:#f9fafb;}
.row-action{background:transparent;border:1px solid #e5e7eb;border-radius:8px;padding:.25rem .5rem;cursor:pointer;font-size:.8rem;display:inline-flex;align-items:center;gap:.25rem;}
.row-action:hover{background:#f3f4f6;}
.row-action.danger{border-color:#fecaca;}
.row-action.danger:hover{background:#fee2e2;}
.row-action:disabled{opacity:.5;cursor:not-allowed;}
.badge{display:inline-flex;align-items:center;gap:.25rem;padding:.2rem .55rem;border-radius:999px;font-size:.75rem;font-weight:600;}
.badge-icon{font-size:.8rem;}
.badge-yellow{background:#fef9c3;color:#92400e;}
.badge-blue{background:#dbeafe;color:#1e40af;}
.badge-green{background:#dcfce7;color:#166534;}
.badge-red{background:#fee2e2;color:#991b1b;}
.error{color:#dc2626;margin-top:.5rem;}
.muted{color:#6b7280;}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);display:grid;place-items:center;z-index:50;}
.modal{max-height:90vh;overflow:auto;}
.modal.md{width:min(620px,92vw);}
.modal.lg{width:min(920px,92vw);}
.rel-grid{display:grid;gap:1.5rem;margin-top:.5rem;}
.rel-toolbar{display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;}
.w-90{width:90px;}
.w-80{width:80px;}
.w-actions{width:110px;}
.empty-row{text-align:center;color:#6b7280;}
.text-right{text-align:right;}
.bold{font-weight:600;}
.summary-costs{margin-top:1rem;text-align:right;font-weight:600;}
.summary-total{margin-top:.25rem;}
.modal-footer{margin-top:1rem;display:flex;justify-content:flex-end;gap:.5rem;}
.row-actions{display:flex;gap:.35rem;}
@media (max-width:1024px){.mant-card-body{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:768px){
  .filters{grid-template-columns:1fr 1fr;}
  .mant-card-body{grid-template-columns:1fr;}
  .mant-card-footer{flex-direction:column;align-items:flex-start;}
  .mant-footer-actions{width:100%;justify-content:space-between;}
}
@media (max-width:640px){.filters{grid-template-columns:1fr;}}
</style>
