<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from 'vue-toastification'
import IncidenteForm from '../../../components/IncidenteForm.vue'
import IncidentMap from '../../../components/IncidenteMap.vue'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type Incidente = {
  id: number
  id_usuario: number
  bus: { id: number | null; label: string }
  fecha: string
  urgencia?: string
  ubicacion?: string
  descripcion?: string
  estadoId?: number | null
  estado?: string | null
  tipoId?: number | null
  tipo?: string | null
}

type CatalogoBus = { id:number; label:string }
type CatalogoOpt = { id:number; nombre:string }
type SuggestedBus = { busId: number; busLabel: string } | null

/*  Auth  */
const { user } = useAuth()
const currentUserId = computed<number | null>(() =>
  (user.value?.id_usuario ?? user.value?.id ?? null) as number | null
)

const search = reactive({
  q: '' as string,
  from: '' as string,
  to: '' as string
})

const items = ref<Incidente[]>([])
const loading = ref(false)
const errorMsg = ref('')

const showForm = ref(false)
const editing = ref<Incidente | null>(null)

const showMap = ref(false)
const mapAddress = ref('')

let abortCtrl: AbortController | null = null
let debounceId: number | null = null

/*  Catálogos */
const estadosCat = ref<CatalogoOpt[]>([])
const tiposCat   = ref<CatalogoOpt[]>([])
const busesConductor = ref<CatalogoBus[]>([])

async function loadEstadosTipos() {
  try {
    const res = await $fetch<any>('/api/incidentes/catalogos', { headers: { 'Cache-Control': 'no-store' } })
    estadosCat.value = (res?.estados || []).map((s:any) => ({
      id: Number(s.id ?? s.id_estado_incidente ?? s.value),
      nombre: String(s.nombre ?? s.nombre_estado ?? s.label ?? s),
    }))
    tiposCat.value = (res?.tipos || []).map((t:any) => ({
      id: Number(t.id ?? t.id_tipo_incidente ?? t.value),
      nombre: String(t.nombre ?? t.nombre_tipo ?? t.label ?? t),
    }))
  } catch (e) {
    console.error('Error cargando estados/tipos', e)
    estadosCat.value = []
    tiposCat.value = []
  }
}

async function loadBusesConductor() {
  if (!currentUserId.value) return
  try {
    const res = await $fetch<{ items: CatalogoBus[] }>('/api/conductor/buses', {
      query: {
        id_usuario: currentUserId.value,
        days: 90,
      },
      headers: { 'Cache-Control': 'no-store' }
    })
    busesConductor.value = res.items || []
  } catch (e) {
    console.error('Error cargando buses del conductor', e)
    busesConductor.value = []
  }
}

/*  Sugerencia de bus por fecha  */
const suggested = ref<SuggestedBus>(null)
async function fetchSuggestedBusByFecha(fechaIso: string) {
  if (!currentUserId.value) { suggested.value = null; return }
  try {
    const r = await $fetch<{ suggested: { busId:number; busLabel:string } | null }>(
      '/api/conductor/turnos/sugerido',
      {
        query: {
          id_usuario: currentUserId.value,
          fecha: fechaIso,
          graceHours: 24
        },
        headers: { 'Cache-Control': 'no-store' }
      }
    )
    suggested.value = r?.suggested ? { busId: r.suggested.busId, busLabel: r.suggested.busLabel } : null
  } catch {
    suggested.value = null
  }
}

/* Mezclar sugerido si no está en la lista */
const busesForForm = computed<CatalogoBus[]>(() => {
  const base = busesConductor.value || []
  if (suggested.value?.busId) {
    const exists = base.some(b => Number(b.id) === Number(suggested.value!.busId))
    return exists ? base : [{ id: suggested.value.busId, label: suggested.value.busLabel }, ...base]
  }
  return base
})

/*  Utilidades  */
function ymdOr(raw: unknown): string {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(String(raw))
  if (!Number.isFinite(+d)) return String(raw).slice(0, 10)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function extractBusLabel(r: any): string {
  const b = r?.bus
  if (!b) return '—'
  if (typeof b === 'string') return b || '—'
  const patente = b?.patente ?? b?.label ?? ''
  const modelo = b?.modelo ?? ''
  return patente ? `${patente}${modelo ? ' - ' + modelo : ''}` : (b?.label || '—')
}
function normalizeOne(r: any): Incidente {
  const rawBusId =
    r?.id_bus ??
    (typeof r?.bus === 'object' ? (r.bus.id ?? r.bus.id_bus) : undefined)
  const estadoNombre =
    (typeof r?.estado === 'string' ? r.estado :
      (r?.estado?.nombre ?? r?.estado?.nombre_estado)) ?? null
  const tipoNombre =
    (typeof r?.tipo === 'string' ? r.tipo :
      (r?.tipo?.nombre ?? r?.tipo?.nombre_tipo)) ?? null

  return {
    id: Number(r?.id ?? r?.id_incidente ?? r?.idIncidente ?? 0),
    id_usuario: Number(r?.id_usuario ?? r?.usuario?.id ?? 0),
    bus: { id: Number(rawBusId || 0) || null, label: extractBusLabel(r) },
    fecha: ymdOr(r?.fecha),
    urgencia: r?.urgencia ?? '',
    ubicacion: r?.ubicacion ?? '',
    descripcion: r?.descripcion ?? '',
    estadoId:
      Number(r?.id_estado_incidente ?? r?.estado?.id ?? r?.estado?.id_estado_incidente ?? 0) || null,
    estado: estadoNombre ? String(estadoNombre) : null,
    tipoId:
      Number(r?.id_tipo_incidente ?? r?.tipo?.id ?? r?.tipo?.id_tipo_incidente ?? 0) || null,
    tipo: tipoNombre ? String(tipoNombre) : null
  }
}

/* Conductor solo puede editar si el incidente está REPORTADO */
function isEditable(row: Incidente): boolean {
  const s = (row.estado || '').toUpperCase()
  return s === '' || s === 'REPORTADO'
}

/* Badge de estado con colores */
function estadoNombre(row: Incidente): string {
  return (row.estado || '').toUpperCase()
}

function badgeClass(row: Incidente): string {
  const s = estadoNombre(row)
  if (s === 'REPORTADO')   return 'badge badge-yellow'
  if (s === 'EN REVISIÓN') return 'badge badge-blue'
  if (s === 'RESUELTO')    return 'badge badge-green'
  if (s === 'DESCARTADO')  return 'badge badge-red'
  return 'badge'
}

async function load(): Promise<void> {
  if (!currentUserId.value) return
  if (abortCtrl) abortCtrl.abort()
  abortCtrl = new AbortController()
  loading.value = true
  errorMsg.value = ''
  try {
    const query: Record<string, any> = {
      limit: 100,
      q: search.q || undefined,
      from: search.from || undefined,
      to: search.to || undefined,
      id_usuario: currentUserId.value
    }

    const res = await $fetch<{ items?: any[] } | any>('/api/conductor/incidentes', {
      query,
      signal: abortCtrl.signal as any,
      headers: { 'Cache-Control': 'no-store' }
    })

    const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : [])
    const mineOnly = list.filter((r: any) => Number(r?.id_usuario) === currentUserId.value)
    items.value = mineOnly.map(normalizeOne)
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      errorMsg.value = e?.data?.message || e?.message || 'Error cargando incidentes'
      toast.error(errorMsg.value)
    }
  } finally {
    loading.value = false
  }
}

/*  Espera auth lista  */
async function waitAuthReady(timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!currentUserId.value && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50))
  }
}

/*  Ciclo de vida  */
onMounted(async () => {
  await waitAuthReady()
  await Promise.all([
    loadEstadosTipos(),
    loadBusesConductor()
  ])
  await load()
})

watch(() => user.value?.id_usuario ?? user.value?.id, async () => {
  await loadBusesConductor()
  await load()
})

watch(() => ({ ...search }), () => {
  if (debounceId) window.clearTimeout(debounceId)
  debounceId = window.setTimeout(load, 300)
}, { deep: true })


function openCreate(): void {
  showForm.value = true
  editing.value = null
  const today = new Date().toISOString().slice(0, 10)
  fetchSuggestedBusByFecha(today)
}

function openEdit(row: Incidente): void {
  if (currentUserId.value && row.id_usuario !== currentUserId.value) {
    toast.error('No puedes editar incidentes de otros usuarios.')
    return
  }
  if (!isEditable(row)) {
    toast.error('Solo puedes editar incidentes en estado REPORTADO.')
    return
  }
  editing.value = { ...row }
  showForm.value = true
  if (row.fecha) fetchSuggestedBusByFecha(row.fecha)
}

async function handleSave(payload: {
  id?: number
  id_bus: number | null
  id_usuario?: number
  fecha: string
  urgencia?: string
  ubicacion?: string
  descripcion?: string
  id_tipo_incidente: number | ''
}): Promise<void> {
  try {
    const uid = currentUserId.value
    if (!uid && !payload.id) {
      toast.error('No se pudo determinar el usuario. Inicia sesión.')
      return
    }

    //  Validaciones de permisos cuando es edición
    if (payload.id) {
      const existing = items.value.find(i => i.id === payload.id)
      if (!existing) {
        toast.error('Incidente no encontrado.')
        return
      }
      if (existing.id_usuario !== uid) {
        toast.error('No puedes editar incidentes de otros usuarios.')
        return
      }
      if (!isEditable(existing)) {
        toast.error('Solo puedes modificar incidentes en estado REPORTADO.')
        return
      }
    }

    // --- Validaciones de campos obligatorios ---
    const errors: string[] = []

    const idBusFinal =
      suggested.value?.busId ??
      (payload.id_bus != null ? Number(payload.id_bus) : NaN)

    if (!Number.isFinite(idBusFinal)) {
      errors.push('Debes seleccionar un bus.')
    }

    if (!payload.fecha || !String(payload.fecha).trim()) {
      errors.push('Debes ingresar una fecha.')
    }

    if (!payload.id_tipo_incidente || Number.isNaN(Number(payload.id_tipo_incidente))) {
      errors.push('Debes seleccionar un tipo de incidente.')
    }

    if (!payload.urgencia || !String(payload.urgencia).trim()) {
      errors.push('Debes seleccionar una urgencia.')
    }

    // Si falta algo, mostramos TODOS los errores en un solo toast
    if (errors.length > 0) {
      toast.error(
        '⚠️ Corrige los siguientes campos:\n- ' + errors.join('\n- '),
        { timeout: 8000 }
      )
      return
    }

    const body: Record<string, any> = {
      id_bus: idBusFinal,
      id_usuario: Number(payload.id_usuario ?? uid!),
      fecha: payload.fecha,
      urgencia: payload.urgencia || undefined,
      ubicacion: payload.ubicacion || undefined,
      descripcion: payload.descripcion || undefined,
      id_tipo_incidente: Number(payload.id_tipo_incidente)
    }

    if (payload.id) {
      await $fetch(`/api/incidentes/${payload.id}`, { method: 'PUT', body } as any)
      toast.success(`Incidente (${payload.urgencia}) actualizado correctamente.`)
    } else {
      await $fetch('/api/incidentes', { method: 'POST', body } as any)
      toast.success(`Incidente (${payload.urgencia}) creado correctamente.`)
    }

    showForm.value = false
    await load()
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'No se pudo guardar el incidente'
    toast.error(msg)
  }
}

/*  Mapa  */
function verMapa(row: Incidente): void {
  mapAddress.value = row.ubicacion || ''
  showMap.value = true
}
</script>

<template>
  <div class="grid">
    <!-- Encabezado y filtros -->
    <div class="card">
      <h3>
        Mis Incidentes
        <span class="chip">Conductor</span>
      </h3>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" placeholder="Texto en descripción/ubicación…" v-model="search.q" />
        </div>
        <div>
          <label class="label">Desde</label>
          <input class="input" type="date" v-model="search.from" />
        </div>
        <div>
          <label class="label">Hasta</label>
          <input class="input" type="date" v-model="search.to" />
        </div>
        <div class="actions">
          <button class="btn" @click="openCreate">+ Nuevo Incidente</button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA EN TARJETAS (solo incidentes del conductor) -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="items.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="inc-list">
        <article v-for="row in items" :key="row.id" class="inc-card">
          <!-- Header -->
          <header class="inc-card-header">
            <div class="inc-main-info">
              <div class="inc-icon">⚠️</div>
              <div>
                <div class="inc-title">
                  {{ row.bus?.label || 'Bus sin asignar' }}
                </div>
                <div class="inc-sub">
                  {{ row.fecha }} · {{ row.urgencia || 'Sin urgencia' }}
                </div>
              </div>
            </div>

            <span :class="badgeClass(row)">
              {{ row.estado || 'REPORTADO' }}
            </span>
          </header>

          <!-- Body -->
          <section class="inc-body">
            <div class="inc-field">
              <span class="field-label">ID</span>
              <span class="field-value">#{{ row.id }}</span>
            </div>

            <div class="inc-field">
              <span class="field-label">Tipo</span>
              <span class="field-value">{{ row.tipo || '—' }}</span>
            </div>

            <div class="inc-field">
              <span class="field-label">Urgencia</span>
              <span class="field-value">{{ row.urgencia || '—' }}</span>
            </div>

            <div class="inc-field full">
              <span class="field-label">Ubicación</span>
              <span class="field-value ellipsis">
                {{ row.ubicacion || '—' }}
              </span>
            </div>

            <div class="inc-field full">
              <span class="field-label">Descripción</span>
              <span class="field-value ellipsis">
                {{ row.descripcion || '—' }}
              </span>
            </div>
          </section>

          <!-- Footer acciones -->
          <footer class="inc-card-footer">
            <button class="btn-outline" @click="verMapa(row)">
              🗺 Ver mapa
            </button>

            <div class="footer-actions">
              <button
                class="btn-outline"
                :disabled="!isEditable(row)"
                @click="openEdit(row)"
              >
                ✏️ Editar
              </button>
            </div>
          </footer>
        </article>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="showForm" class="backdrop" @click.self="showForm = false">
      <div class="card modal">
        <h3 style="margin-top:0">{{ editing ? 'Editar Incidente' : 'Nuevo Incidente' }}</h3>

        <IncidenteForm
          :initial="editing ? {
            id: editing.id,
            id_bus: editing.bus?.id ?? suggested?.busId ?? null,
            fecha: editing.fecha,
            urgencia: editing.urgencia,
            ubicacion: editing.ubicacion,
            descripcion: editing.descripcion,
            id_tipo_incidente: editing.tipoId ?? undefined
          } : {
            id_bus: suggested?.busId ?? null,
            fecha: new Date().toISOString().slice(0,10)
          }"
          :buses="busesForForm"
          :estados="estadosCat"
          :tipos="tiposCat"
          @cancel="showForm=false"
          @save="handleSave"
          @change-fecha="fetchSuggestedBusByFecha"
        />
        <small class="hint">
          Bus sugerido: <strong class="code">{{ suggested?.busLabel || '—' }}</strong>
        </small>
      </div>
    </div>

    <!-- Modal Mapa -->
    <div v-if="showMap" class="backdrop" @click.self="showMap=false">
      <div class="card modal">
        <div class="modal-header">
          <h3>Ubicación del incidente</h3>
          <button class="row-action" @click="showMap=false">✖</button>
        </div>
        <IncidentMap :address="mapAddress" />
        <small class="hint">Fuente: OpenStreetMap / Nominatim.</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display:grid;
  gap:1rem;
}

.card {
  background:#fff;
  border-radius:12px;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  padding:1rem;
}

/* Filtros */
.filters {
  display:grid;
  grid-template-columns:1fr 150px 150px 160px;
  gap:1rem;
  align-items:end;
}
.label {
  font-size:.85rem;
  font-weight:600;
  color:#4b5563;
  margin-bottom:.35rem;
}
.input {
  width:100%;
  border:1px solid #e5e7eb;
  border-radius:10px;
  padding:.5rem .75rem;
}
.input:focus {
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,.25);
}
.actions {
  display:flex;
  justify-content:flex-end;
}
.btn {
  background:#2563eb;
  color:#fff;
  border:none;
  border-radius:10px;
  padding:.55rem .9rem;
  font-weight:600;
  cursor:pointer;
}
.btn:hover { background:#1d4ed8; }

.error {
  color:#dc2626;
  margin-top:.75rem;
  text-align:right;
}
.chip {
  margin-left:.5rem;
  background:#eef;
  border-radius:999px;
  padding:.1rem .6rem;
  font-size:.8rem;
  border:1px solid #d1d5db;
}

.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

.inc-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.inc-card {
  border-radius:20px;
  border:1px solid #e5e7eb;
  padding:1.3rem 1.6rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.inc-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.inc-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.inc-icon {
  width:50px;
  height:50px;
  background:#eff6ff;
  border-radius:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}

.inc-title {
  font-size:1.1rem;
  font-weight:700;
}

.inc-sub {
  font-size:.9rem;
  color:#4b5563;
}

.badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:95px;
  padding:.2rem .7rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:700;
  text-transform:uppercase;
}
.badge-yellow{background:#fef9c3;color:#92400e}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-green{background:#dcfce7;color:#166534}
.badge-red{background:#fee2e2;color:#991b1b}

.inc-body {
  margin-top:1rem;
  background:#ffffffc9;
  border-radius:15px;
  padding:1rem;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:.8rem 1rem;
}

.inc-field {
  background:#f9fafb;
  border-radius:12px;
  padding:.7rem;
  display:flex;
  flex-direction:column;
}

.inc-field.full {
  grid-column:1 / -1;
}

.field-label {
  font-size:.7rem;
  color:#9ca3af;
  text-transform:uppercase;
  margin-bottom:.3rem;
  font-weight:600;
}

.field-value {
  font-size:.95rem;
  font-weight:600;
}

.ellipsis {
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.inc-card-footer {
  margin-top:1rem;
  padding-top:.8rem;
  border-top:1px solid #e5e7eb;
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.btn-outline {
  border:1px solid #d1d5db;
  background:#f9fafb;
  padding:.45rem .9rem;
  border-radius:10px;
  font-weight:600;
  cursor:pointer;
}
.btn-outline:hover {
  background:#e8edff;
  border-color:#2563eb;
}
.footer-actions {
  display:flex;
  gap:.5rem;
}

/* Modales */
.backdrop {
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.4);
  display:grid;
  place-items:center;
  z-index:50;
}
.modal {
  width:min(780px,92vw);
}
.modal-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:.5rem;
}

.row-action {
  background:transparent;
  border:1px solid #e5e7eb;
  border-radius:8px;
  padding:.25rem .5rem;
  cursor:pointer;
}
.row-action:hover { background:#f3f4f6; }

.hint {
  color:#6b7280;
  font-size:.8rem;
  margin-top:.5rem;
}
.code {
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Courier New",monospace;
}

@media (max-width:768px) {
  .filters {
    grid-template-columns:1fr 1fr;
  }
  .inc-body {
    grid-template-columns:1fr;
  }
  .inc-card-footer {
    flex-direction:column;
    gap:.5rem;
  }
}
</style>
