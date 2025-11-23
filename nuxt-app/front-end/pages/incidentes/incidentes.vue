<script setup lang="ts">
// 🔥 INCIDENTES – Admin / Propietario / Supervisor
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuth } from '~/composables/useAuth'
import IncidenteForm from '~/components/IncidenteForm.vue'
import IncidentMap from '~/components/IncidenteMap.vue'

definePageMeta({ layout: 'panel' })

const toast = useToast()

/* ================= Tipos ================= */
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

type CatalogoBus = { id: number; label: string }
type CatalogoOpt = { id: number; nombre: string }

/* ================= Auth / Roles ================= */
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
const canChangeState = computed(() =>
  isAdmin.value || isPropietario.value || isSupervisor.value
)
const canDelete = computed(() => isAdmin.value)

const currentUserId = computed<number | null>(() =>
  (user.value?.id_usuario ?? user.value?.id ?? null) as number | null
)

/* ================= Paginación + filtros ================= */
const ROWS_PER_PAGE = 10
const page = ref(1)

const search = reactive({
  q: '',
  id_bus: '' as number | '',
  id_tipo_incidente: '' as number | '',
})

/* ================= Estado UI ================= */
const items = ref<Incidente[]>([])
const loading = ref(false)
const errorMsg = ref('')

const showForm = ref(false)
const editing = ref<Incidente | null>(null)

const showConfirmModal = ref(false)
const toDelete = ref<Incidente | null>(null)

const showMap = ref(false)
const mapAddress = ref('')

let abortCtrl: AbortController | null = null
let debounceId: number | null = null

/* ================= Catálogos ================= */
const catalogo = ref<{
  buses: CatalogoBus[]
  tipos: CatalogoOpt[]
  estados: CatalogoOpt[]
}>({
  buses: [],
  tipos: [],
  estados: [],
})

async function loadCatalogos() {
  try {
    const res = await $fetch<any>('/api/incidentes/catalogos', {
      headers: { 'Cache-Control': 'no-store' },
    })

    catalogo.value = {
      buses: (res?.buses || []).map((b: any) => ({
        id: Number(b.id ?? b.id_bus ?? 0),
        label: String(b.label ?? b.patente ?? ''),
      })),
      tipos: (res?.tipos || []).map((t: any) => ({
        id: Number(t.id ?? t.id_tipo_incidente ?? 0),
        nombre: String(t.nombre ?? t.nombre_tipo ?? t.label ?? ''),
      })),
      estados: (res?.estados || []).map((e: any) => ({
        id: Number(e.id ?? e.id_estado_incidente ?? 0),
        nombre: String(e.nombre ?? e.nombre_estado ?? e.label ?? ''),
      })),
    }
  } catch (e: any) {
    console.error('Error cargando catálogos', e)
    toast.error('No se pudieron cargar los catálogos de incidentes.')
  }
}

/* ================= Utilidades / Normalize ================= */
function ymdOr(raw: unknown): string {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(String(raw))
  if (!Number.isFinite(+d)) return String(raw).slice(0, 10)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
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
    (typeof r?.estado === 'string'
      ? r.estado
      : (r?.estado?.nombre ?? r?.estado?.nombre_estado)) ?? null

  const tipoNombre =
    (typeof r?.tipo === 'string'
      ? r.tipo
      : (r?.tipo?.nombre ?? r?.tipo?.nombre_tipo)) ?? null

  return {
    id: Number(r?.id ?? r?.id_incidente ?? r?.idIncidente ?? 0),
    id_usuario: Number(r?.id_usuario ?? r?.usuario?.id ?? 0),
    bus: { id: Number(rawBusId || 0) || null, label: extractBusLabel(r) },
    fecha: ymdOr(r?.fecha),
    urgencia: r?.urgencia ?? '',
    ubicacion: r?.ubicacion ?? '',
    descripcion: r?.descripcion ?? '',
    estadoId:
      Number(
        r?.id_estado_incidente ??
          r?.estado?.id ??
          r?.estado?.id_estado_incidente ??
          0,
      ) || null,
    estado: estadoNombre ? String(estadoNombre) : null,
    tipoId:
      Number(
        r?.id_tipo_incidente ??
          r?.tipo?.id ??
          r?.tipo?.id_tipo_incidente ??
          0,
      ) || null,
    tipo: tipoNombre ? String(tipoNombre) : null,
  }
}

const normalizeMany = (arr: any[]) => arr.map(normalizeOne)

/* ============== Helpers de estado / badges ============== */
function estadoUpper(estado: string | null | undefined) {
  return (estado || '').toUpperCase()
}

function badgeClass(row: Incidente): string {
  const s = estadoUpper(row.estado)
  if (s === 'REPORTADO') return 'badge badge-yellow'
  if (s === 'EN REVISIÓN') return 'badge badge-blue'
  if (s === 'RESUELTO') return 'badge badge-green'
  if (s === 'DESCARTADO') return 'badge badge-red'
  return 'badge'
}

/* Normalizador para string de estado (sin tildes) */
function normalizeEstadoStr(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

/* Buscar id_estado_incidente a partir del nombre */
function getEstadoIdByName(nombre: string): number | null {
  const target = normalizeEstadoStr(nombre)

  const found = catalogo.value.estados.find((e) => {
    const n = normalizeEstadoStr(e.nombre)
    return n === target || n.includes(target) || target.includes(n)
  })

  return found ? found.id : null
}

/* ================= Carga API ================= */
async function load(): Promise<void> {
  if (abortCtrl) abortCtrl.abort()
  abortCtrl = new AbortController()
  loading.value = true
  errorMsg.value = ''

  try {
    const query: Record<string, any> = {
      q: search.q || undefined,
      id_bus: search.id_bus || undefined,
      id_tipo_incidente: search.id_tipo_incidente || undefined,
      pageSize: 100,
    }

    const res = await $fetch<{ items?: any[] } | any>('/api/incidentes', {
      query,
      signal: abortCtrl.signal as any,
      headers: { 'Cache-Control': 'no-store' },
    })

    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.items)
      ? res.items
      : []

    items.value = normalizeMany(list)
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      errorMsg.value = e?.data?.message || e?.message || 'Error cargando incidentes'
      toast.error(errorMsg.value)
    }
  } finally {
    loading.value = false
  }
}

/* ================= Ciclo de vida ================= */
onMounted(async () => {
  await loadCatalogos()
  await load()
})

watch(
  () => ({ ...search }),
  () => {
    page.value = 1
    if (debounceId) window.clearTimeout(debounceId)
    debounceId = window.setTimeout(load, 300)
  },
  { deep: true },
)

/* ================= Paginación ================= */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(items.value.length / ROWS_PER_PAGE)),
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * ROWS_PER_PAGE
  return items.value.slice(start, start + ROWS_PER_PAGE)
})

/* ================= ABM ================= */
function openCreate(): void {
  if (!canCreate.value) return
  showForm.value = true
  editing.value = null
}

function openEdit(row: Incidente): void {
  if (!canEdit.value) return
  editing.value = { ...row }
  showForm.value = true
}

function askDelete(row: Incidente): void {
  if (!canDelete.value) return
  toDelete.value = row
  showConfirmModal.value = true
}

async function removeOne() {
  if (!toDelete.value) return
  try {
    await $fetch(`/api/incidentes/${toDelete.value.id}`, { method: 'DELETE' } as any)
    toast.success(`Incidente #${toDelete.value.id} eliminado correctamente.`)
  } catch (e: any) {
    const msg =
      e?.data?.message || e?.message || 'No se pudo eliminar el incidente.'
    toast.error(msg)
  } finally {
    showConfirmModal.value = false
    await load()
  }
}

/* ========= Guardar (form) ========= */
async function handleSave(payload: {
  id?: number
  id_bus: number | null
  id_usuario?: number
  fecha: string
  urgencia?: string
  ubicacion?: string
  descripcion?: string
  id_tipo_incidente: number | null
  id_estado_incidente?: number | null
}): Promise<void> {
  try {
    const uid = currentUserId.value ?? payload.id_usuario

    const errors: string[] = []

    if (payload.id_bus == null || Number.isNaN(Number(payload.id_bus))) {
      errors.push('Debes seleccionar un bus.')
    }

    if (!payload.fecha || !String(payload.fecha).trim()) {
      errors.push('Debes ingresar una fecha.')
    }

    if (
      payload.id_tipo_incidente == null ||
      Number.isNaN(Number(payload.id_tipo_incidente))
    ) {
      errors.push('Debes seleccionar un tipo de incidente.')
    }

    if (!payload.urgencia || !String(payload.urgencia).trim()) {
      errors.push('Debes seleccionar una urgencia.')
    }

    if (!uid) {
      errors.push('No se pudo determinar el usuario que registra el incidente.')
    }

    if (errors.length > 0) {
      toast.error('⚠️ Corrige los siguientes campos:\n- ' + errors.join('\n- '), {
        timeout: 8000,
      })
      return
    }

    const body: Record<string, any> = {
      id_bus: Number(payload.id_bus),
      id_usuario: Number(uid),
      fecha: payload.fecha,
      urgencia: payload.urgencia || undefined,
      ubicacion: payload.ubicacion || undefined,
      descripcion: payload.descripcion || undefined,
      id_tipo_incidente: Number(payload.id_tipo_incidente),
    }

    if (payload.id_estado_incidente != null) {
      body.id_estado_incidente = Number(payload.id_estado_incidente)
    }

    if (payload.id) {
      await $fetch(`/api/incidentes/${payload.id}`, {
        method: 'PUT',
        body,
      } as any)
      toast.success(`Incidente #${payload.id} actualizado correctamente.`)
    } else {
      await $fetch('/api/incidentes', { method: 'POST', body } as any)
      toast.success('Incidente creado correctamente.')
    }

    showForm.value = false
    await load()
  } catch (e: any) {
    const msg =
      e?.data?.message || e?.message || 'No se pudo guardar el incidente.'
    toast.error(msg)
  }
}

/* ========= Cambiar ESTADO desde botones ========= */
async function cambiarEstado(
  row: Incidente,
  nuevoEstado: 'REPORTADO' | 'EN REVISIÓN' | 'RESUELTO' | 'DESCARTADO',
) {
  if (!canChangeState.value) return

  const idEstado = getEstadoIdByName(nuevoEstado)
  if (!idEstado) {
    toast.error(`No se encontró el estado "${nuevoEstado}" en el catálogo.`)
    console.error('Estados en catálogo:', catalogo.value.estados)
    return
  }

  try {
    const body: Record<string, any> = {
      id_bus: row.bus.id,
      id_usuario: row.id_usuario,
      fecha: row.fecha,
      urgencia: row.urgencia || undefined,
      ubicacion: row.ubicacion || undefined,
      descripcion: row.descripcion || undefined,
      id_tipo_incidente: row.tipoId != null ? Number(row.tipoId) : undefined,
      id_estado_incidente: idEstado,
    }

    const res = await $fetch<{ item?: any }>(`/api/incidentes/${row.id}`, {
      method: 'PUT',
      body,
    } as any)

    const updated = normalizeOne(res.item ?? res)
    const idx = items.value.findIndex((i) => i.id === updated.id)
    if (idx !== -1) {
      items.value[idx] = updated
    }

    toast.success(`Incidente #${row.id} marcado como "${nuevoEstado}".`)
  } catch (e: any) {
    const msg =
      e?.data?.message || e?.message || 'No se pudo actualizar el estado.'
    toast.error(msg)
    console.error('Error al cambiar estado', e)
  }
}

/* ================= Mapa ================= */
function verMapa(row: Incidente): void {
  mapAddress.value = row.ubicacion || ''
  showMap.value = true
}
</script>

<template>
  <div class="grid">
    <!-- ENCABEZADO / FILTROS -->
    <div class="card">
      <h3>
        Incidentes
        <span class="chip">
          {{ isAdmin ? 'Admin' : isPropietario ? 'Propietario' : isSupervisor ? 'Supervisor' : 'Solo lectura' }}
        </span>
      </h3>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" v-model="search.q" placeholder="Buscar…" />
        </div>

        <div>
          <label class="label">Bus</label>
          <select class="input" v-model="search.id_bus">
            <option value="">Todos</option>
            <option v-for="b in catalogo.buses" :key="b.id" :value="b.id">
              {{ b.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select class="input" v-model="search.id_tipo_incidente">
            <option value="">Todos</option>
            <option v-for="t in catalogo.tipos" :key="t.id" :value="t.id">
              {{ t.nombre }}
            </option>
          </select>
        </div>

        <div class="actions">
          <button
            v-if="canCreate"
            class="btn"
            @click="openCreate"
          >
            + Nuevo Incidente
          </button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="pagedItems.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="inc-list">
        <article
          v-for="row in pagedItems"
          :key="row.id"
          class="inc-card"
        >
          <!-- Header -->
          <header class="inc-card-header">
            <div class="inc-main-info">
              <div class="inc-icon">🚍</div>
              <div>
                <div class="inc-title">
                  {{ row.bus?.label || 'Bus sin asignar' }}
                </div>
                <div class="inc-sub">
                  #{{ row.id }} · {{ row.fecha }} · {{ row.urgencia || 'Sin urgencia' }}
                </div>
                <div class="inc-sub small">
                  Usuario: {{ row.id_usuario }}
                </div>
              </div>
            </div>

            <span :class="
              row.estado
                ? badgeClass(row)
                : 'badge'
            ">
              {{ row.estado || '—' }}
            </span>
          </header>

          <!-- Body -->
          <section class="inc-body">
            <div class="inc-field">
              <span class="field-label">Tipo</span>
              <span class="field-value">{{ row.tipo || '—' }}</span>
            </div>

            <div class="inc-field">
              <span class="field-label">Urgencia</span>
              <span class="field-value">{{ row.urgencia || '—' }}</span>
            </div>

            <div class="inc-field">
              <span class="field-label">Estado</span>
              <span class="field-value">
                {{ row.estado || '—' }}
              </span>
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
              <!-- Cambios rápidos de estado -->
              <button
                class="btn-pill"
                v-if="canChangeState && estadoUpper(row.estado) === 'REPORTADO'"
                @click="cambiarEstado(row, 'EN REVISIÓN')"
              >
                🔎 En revisión
              </button>

              <button
                class="btn-pill"
                v-if="canChangeState && estadoUpper(row.estado) === 'EN REVISIÓN'"
                @click="cambiarEstado(row, 'RESUELTO')"
              >
                ✅ Resuelto
              </button>

              <button
                class="btn-pill danger-pill"
                v-if="canChangeState && ['REPORTADO','EN REVISIÓN'].includes(estadoUpper(row.estado))"
                @click="cambiarEstado(row, 'DESCARTADO')"
              >
                🚫 Descartar
              </button>

              <!-- Editar -->
              <button
                class="btn-outline"
                v-if="canEdit"
                @click="openEdit(row)"
              >
                ✏️ Editar
              </button>

              <!-- Eliminar solo admin -->
              <button
                class="btn-outline danger-outline"
                v-if="canDelete"
                @click="askDelete(row)"
              >
                🗑 Eliminar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- PAGINADOR -->
      <div class="pager" v-if="totalPages > 1">
        <button class="pager-btn" @click="page--" :disabled="page === 1">◀</button>
        <span class="pager-info">Página {{ page }} de {{ totalPages }}</span>
        <button class="pager-btn" @click="page++" :disabled="page === totalPages">▶</button>
      </div>
    </div>

    <!-- MODAL FORM -->
    <div v-if="showForm && canEdit" class="backdrop" @click.self="showForm = false">
      <div class="card modal">
        <h3 style="margin-top:0">{{ editing ? 'Editar Incidente' : 'Nuevo Incidente' }}</h3>

        <IncidenteForm
          :initial="editing
            ? {
                id: editing.id,
                id_bus: editing.bus?.id ?? null,
                fecha: editing.fecha,
                urgencia: editing.urgencia,
                ubicacion: editing.ubicacion,
                descripcion: editing.descripcion,
                id_estado_incidente: editing.estadoId ?? null,
                id_tipo_incidente: editing.tipoId ?? null
              }
            : {
                id_bus: null,
                fecha: new Date().toISOString().slice(0,10),
                urgencia: '',
                ubicacion: '',
                descripcion: '',
                id_estado_incidente: null,
                id_tipo_incidente: null
              }"
          :buses="catalogo.buses"
          :estados="catalogo.estados"
          :tipos="catalogo.tipos"
          @cancel="showForm=false"
          @save="handleSave"
        />
      </div>
    </div>

    <!-- MODAL ELIMINAR -->
    <div v-if="showConfirmModal" class="backdrop">
      <div class="card small">
        <h3 style="color:#dc2626">Confirmar eliminación</h3>
        <p>¿Eliminar incidente #{{ toDelete?.id }}?</p>
        <div class="modal-actions">
          <button class="btn" @click="showConfirmModal=false">Cancelar</button>
          <button class="btn danger-btn" @click="removeOne">Eliminar</button>
        </div>
      </div>
    </div>

    <!-- MODAL MAPA -->
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
  grid-template-columns:2fr 1.2fr 1.2fr auto;
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

/* Lista tarjetas */
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
  background:#f1f5f9;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

/* Header card */
.inc-card-header {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
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
.inc-sub.small {
  font-size:.8rem;
  color:#6b7280;
}

/* Badges estado */
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

/* Body card */
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

/* Footer card */
.inc-card-footer {
  margin-top:1rem;
  padding-top:.8rem;
  border-top:1px solid #e5e7eb;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:.5rem;
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
.danger-outline {
  border-color:#fecaca;
}
.danger-outline:hover {
  background:#fee2e2;
}

/* Pills estado rápido */
.footer-actions {
  display:flex;
  flex-wrap:wrap;
  gap:.4rem;
}
.btn-pill {
  border:none;
  border-radius:999px;
  padding:.35rem .8rem;
  background:#e5e7eb;
  font-size:.8rem;
  font-weight:600;
  cursor:pointer;
}
.btn-pill:hover {
  background:#d1d5db;
}
.danger-pill {
  background:#fee2e2;
  color:#991b1b;
}
.danger-pill:hover {
  background:#fecaca;
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
.small {
  width:min(420px,90vw);
  text-align:center;
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

/* Paginador */
.pager {
  margin-top:.75rem;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.75rem;
  font-size:.85rem;
}
.pager-btn {
  border:1px solid #d1d5db;
  border-radius:999px;
  padding:.25rem .7rem;
  background:#f9fafb;
  cursor:pointer;
}
.pager-btn:disabled {
  opacity:.5;
  cursor:default;
}
.pager-info { color:#4b5563; }

@media (max-width:768px) {
  .filters {
    grid-template-columns:1fr 1fr;
  }
  .inc-body {
    grid-template-columns:1fr;
  }
  .inc-card-footer {
    flex-direction:column;
    align-items:flex-start;
  }
}
</style>
