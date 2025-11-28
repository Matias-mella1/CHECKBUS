<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useToast } from 'vue-toastification'
import { useAuth } from '~/composables/useAuth'

const toast = useToast()

definePageMeta({ layout: 'panel' })

//roles
const { user } = useAuth()

const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})

const isAdmin = computed(() => rolesUsuario.value.includes('ADMINISTRADOR'))
const isSupervisor = computed(() => rolesUsuario.value.includes('SUPERVISOR'))
const isPropietario = computed(() => rolesUsuario.value.includes('PROPIETARIO'))

// SUPERVISOR = solo lectura
const isReadOnly = computed(() => isSupervisor.value)

// ADMIN y PROPIETARIO pueden crear/editar
const canEdit = computed(() => isAdmin.value || isPropietario.value)
const canCreate = computed(() => isAdmin.value || isPropietario.value)

// Solo ADMIN puede eliminar
const canDelete = computed(() => isAdmin.value)

/* ================= Tipos ================= */
type EstadoBus = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'
type Combustible = 'DIESEL' | 'GASOLINA' | 'GAS' | 'ELECTRICO'

interface Bus {
  id: number
  code: number
  plate: string
  model: string
  brand: string
  fuel: Combustible
  year: number
  km: number
  capacidad: number
  estado: EstadoBus
  fechaRevisionTecnica: string | null
  fechaExtintor: string | null
  extintorVigente: boolean
}

type BusInput = Omit<Bus, 'id' | 'code' | 'extintorVigente'>


const search = reactive({ q: '', estado: '' as '' | EstadoBus })
const items = ref<Bus[]>([])
const loading = ref(false)
const errorMsg = ref<string>('')

let abortCtrl: AbortController | null = null
let debounceId: number | null = null

//paginacion
const ROWS_PER_PAGE = 10
const page = ref(1)
const totalPages = computed(() =>
  Math.max(1, Math.ceil((items.value.length || 0) / ROWS_PER_PAGE))
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * ROWS_PER_PAGE
  const end = start + ROWS_PER_PAGE
  return items.value.slice(start, end)
})


function normalizeFuel(v: any): Combustible {
  const s = String(v ?? '').toUpperCase()
  if (s === 'DIESEL') return 'DIESEL'
  if (s === 'GASOLINA') return 'GASOLINA'
  if (s === 'GAS') return 'GAS'
  if (s === 'ELECTRICO' || s === 'ELÉCTRICO') return 'ELECTRICO'
  return 'DIESEL'
}
function normalizeEstado(v: any): EstadoBus {
  const s = String(v ?? '').toUpperCase()
  if (s === 'MANTENIMIENTO') return 'MANTENIMIENTO'
  if (s === 'FUERA DE SERVICIO' || s === 'FUERA_DE_SERVICIO') return 'FUERA DE SERVICIO'
  return 'OPERATIVO'
}
function ymdOrNull(v: any): string | null {
  const s = String(v ?? '')
  if (!s) return null
  return s.slice(0, 10)
}
function isVigente(fecha: string | null): boolean {
  if (!fecha) return false
  const hoy = new Date().toISOString().slice(0, 10)
  return fecha >= hoy
}
function normalizeBus(raw: any): Bus {
  const fechaRev = ymdOrNull(raw.fecha_revision_tecnica ?? raw.fechaRevisionTecnica)
  const fechaExt = ymdOrNull(raw.fecha_extintor ?? raw.fechaExtintor)

  return {
    id: Number(raw.id ?? raw.id_bus),
    code: Number(raw.code ?? raw.codigo ?? 0),
    plate: String(raw.patente ?? raw.plate ?? ''),
    model: String(raw.modelo ?? raw.model ?? ''),
    brand: String(raw.marca ?? raw.brand ?? ''),
    fuel: normalizeFuel(raw.combustible ?? raw.fuel),
    year: Number(raw.annio ?? raw.anio ?? raw.year ?? new Date().getFullYear()),
    km: Number(raw.km ?? raw.kilometraje ?? 0),
    capacidad: Number(raw.capacidad ?? 0),
    estado: normalizeEstado(raw.estado ?? raw.estado_bus?.nombre_estado),
    fechaRevisionTecnica: fechaRev,
    fechaExtintor: fechaExt,
    extintorVigente: isVigente(fechaExt),
  }
}
function normalizeMany(arr: any[]): Bus[] {
  return (arr || []).map(normalizeBus)
}

/* ================= Carga ================= */
async function load() {
  if (abortCtrl) abortCtrl.abort()
  abortCtrl = new AbortController()

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{ items: any[] }>('/api/buses', {
      query: { q: search.q || undefined, estado: search.estado || undefined },
      signal: abortCtrl.signal as any,
    })
    items.value = normalizeMany(res.items)
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      errorMsg.value = e?.data?.message || e?.message || 'Error cargando buses'
    }
  } finally {
    loading.value = false
  }
}

async function loadOne(id: number): Promise<Bus> {
  const raw = await $fetch<any>(`/api/buses/${id}`)
  return normalizeBus(raw)
}

onMounted(load)

watch(
  () => ({ q: search.q, estado: search.estado }),
  () => {
    if (debounceId) window.clearTimeout(debounceId)
    page.value = 1
    debounceId = window.setTimeout(load, 300)
  },
  { deep: false }
)

const showForm = ref(false)
const editing = ref<Bus | null>(null)
const validationError = ref('')

const form = reactive<BusInput>({
  plate: '',
  model: '',
  brand: '',
  fuel: 'DIESEL',
  year: new Date().getFullYear(),
  km: 0,
  capacidad: 0,
  estado: 'OPERATIVO',
  fechaRevisionTecnica: null,
  fechaExtintor: null,
})

function resetForm() {
  Object.assign(form, {
    plate: '',
    model: '',
    brand: '',
    fuel: 'DIESEL' as Combustible,
    year: new Date().getFullYear(),
    km: 0,
    capacidad: 0,
    estado: 'OPERATIVO' as EstadoBus,
    fechaRevisionTecnica: null as string | null,
    fechaExtintor: null as string | null,
  })
  validationError.value = ''
}

function toBusInput(b: any): BusInput {
  const n = normalizeBus(b)
  return {
    plate: n.plate,
    model: n.model,
    brand: n.brand,
    fuel: n.fuel,
    year: n.year,
    km: n.km,
    capacidad: n.capacidad,
    estado: n.estado,
    fechaRevisionTecnica: n.fechaRevisionTecnica || null,
    fechaExtintor: n.fechaExtintor || null,
  }
}

function openCreate() {
  if (!canCreate.value) return   // solo admin / propietario
  editing.value = null
  resetForm()
  showForm.value = true
}

async function openEdit(b: Bus) {
  if (!canEdit.value) return     // solo admin / propietario
  try {
    const full = await loadOne(b.id)
    editing.value = full
    Object.assign(form, toBusInput(full))
  } catch {
    editing.value = b
    Object.assign(form, toBusInput(b))
  }
  validationError.value = ''
  showForm.value = true
}
function validate(): string[] {
  const errors: string[] = []
  const patenteRegex = /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2}|[A-Z]{5}\d{1})$/i

  if (!form.plate) {
    errors.push('Patente: Es un campo obligatorio y no puede estar vacío.')
  } else if (!patenteRegex.test(form.plate)) {
    errors.push('Patente: El formato es incorrecto. Use AA1234 (antigua), ABCD12 (actual) o ABCDE1 (nueva).')
  }

  if (!form.model) {
    errors.push('Modelo: Es un campo obligatorio y no puede estar vacío.')
  }

  if (!form.brand) {
    errors.push('Marca: Es un campo obligatorio.')
  } else if (form.brand.length < 2) {
    errors.push('Marca: Debe tener al menos 2 caracteres.')
  }

  if (!form.fuel) {
    errors.push('Combustible: Debe seleccionar una opción.')
  }

  if (form.capacidad === 0 || form.capacidad === null) {
    errors.push('Capacidad: La cantidad de pasajeros es obligatoria.')
  } else if (form.capacidad < 1) {
    errors.push('Capacidad: Debe ser mínimo 1 pasajero.')
  } else if (form.capacidad > 100) {
    errors.push('Capacidad: Es demasiado alta (máx. 100).')
  }

  const currentYear = new Date().getFullYear()
  if (form.year < 1990 || form.year > currentYear + 1) {
    errors.push(`Año: El valor no es válido (rango 1990 - ${currentYear + 1}).`)
  }

  return errors
}

//gurdar
async function saveBus() {
  if (!canEdit.value) return   // solo admin / propietario

  const feErrors = validate()
  if (feErrors.length > 0) {
    validationError.value = feErrors.join(' | ')
    const message =
      '⚠️ Errores de Validación (Revisar campos):\n- ' +
      feErrors.join('\n- ')
    toast.error(message, { timeout: 8000 })
    return
  }

  const mappedBody: any = {
    patente: form.plate,
    modelo: form.model,
    marca: form.brand,
    combustible: form.fuel,
    anio: form.year,
    kilometraje: form.km,
    capacidad: form.capacidad,
    estado: form.estado,
    fechaRevisionTecnica: form.fechaRevisionTecnica || null,
    fechaExtintor: form.fechaExtintor || null,
  }

  try {
    const isEditing = !!editing.value
    if (isEditing) {
      await $fetch(`/api/buses/${editing.value!.id}`, { method: 'PUT', body: mappedBody } as any)
      toast.success(`✅ Bus ${form.plate} actualizado correctamente.`)
    } else {
      await $fetch('/api/buses', { method: 'POST', body: mappedBody } as any)
      toast.success(`🎉 Bus ${form.plate} creado con éxito.`)
    }
    showForm.value = false
    await load()
  } catch (e: any) {
    const backendError = e?.data?.message || e?.message || 'No se pudo guardar el bus'
    validationError.value = backendError
    toast.error(`🛑 Error del Sistema \n${backendError}`, { timeout: 8000 })
  }
}

//eliminar
const busToDelete = ref<Bus | null>(null)
const showConfirmModal = ref(false)

function openRemoveConfirmation(b: Bus) {
  if (!canDelete.value) return  // solo admin
  busToDelete.value = b
  showConfirmModal.value = true
}
function cancelRemoval() {
  busToDelete.value = null
  showConfirmModal.value = false
}
async function removeBus() {
  if (!canDelete.value) return  // solo admin
  if (!busToDelete.value) return
  const id = busToDelete.value.id
  const plate = busToDelete.value.plate

  try {
    await $fetch(`/api/buses/${id}`, { method: 'DELETE' } as any)
    cancelRemoval()
    toast.success(`🗑️ Bus ${plate} eliminado correctamente.`)
    await load()
  } catch (e: any) {
    const backendError = e?.data?.message || e?.message || 'No se pudo eliminar el bus'
    errorMsg.value = backendError
    cancelRemoval()
    toast.error(`🛑 Error al eliminar: ${backendError}`)
  }
}

/* ================= Paginación ================= */
function goToPage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
}
</script>

<template>
  <div class="grid">
    <!-- Filtros -->
    <div class="card">
      <div class="card-header-top">
        <h3>Buses</h3>

        <!-- Pills de modo según rol -->
        <span v-if="isReadOnly" class="pill-readonly">
          👀 Solo lectura (Supervisor)
        </span>
        <span v-else-if="isAdmin" class="pill-admin">
          🛠️ Modo administrador
        </span>
        <span v-else class="pill-owner">
          ✏️ Modo propietario (puede editar)
        </span>
      </div>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" placeholder="Patente o modelo" v-model="search.q" />
        </div>
        <div>
          <label class="label">Estado</label>
          <select class="select" v-model="search.estado">
            <option value="">Todos</option>
            <option value="OPERATIVO">OPERATIVO</option>
            <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            <option value="FUERA DE SERVICIO">FUERA DE SERVICIO</option>
          </select>
        </div>
        <div style="display:flex; align-items:end; justify-content:end">
          <!-- admin y propietario pueden crear -->
          <button v-if="canCreate" class="btn" @click="openCreate">
            + Nuevo Bus
          </button>
        </div>
      </div>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA DE TARJETAS -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando...</div>
      <div v-else-if="items.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="bus-list">
        <article
          v-for="b in pagedItems"
          :key="b.id"
          class="bus-card"
        >
          <!-- Cabecera -->
          <header class="bus-card-header">
            <div class="bus-main-info">
              <div class="bus-icon">🚐</div>
              <div>
                <div class="bus-plate">{{ b.plate }}</div>
                <div class="bus-model">{{ b.brand }} {{ b.model }}</div>
              </div>
            </div>
            <StatusBadge :status="b.estado" />
          </header>

          <!-- Métricas -->
          <section class="bus-card-body">
            <div class="bus-metric">
              <span class="metric-label">Año</span>
              <span class="metric-value">{{ b.year }}</span>
            </div>
            <div class="bus-metric">
              <span class="metric-label">Capacidad</span>
              <span class="metric-value">{{ b.capacidad }}</span>
            </div>
            <div class="bus-metric">
              <span class="metric-label">Kilometraje</span>
              <span class="metric-value">{{ b.km.toLocaleString() }} km</span>
            </div>
          </section>

          <!-- Footer -->
          <footer class="bus-card-footer">
            <!-- Aquí podrías dejar espacio para info extra -->
            <div></div>

            <!-- Acciones: admin y propietario pueden editar, solo admin puede eliminar -->
            <div class="footer-actions" v-if="canEdit">
              <button class="btn-outline" @click="openEdit(b)">Editar</button>
              <button
                v-if="canDelete"
                class="btn-outline danger-outline"
                @click="openRemoveConfirmation(b)"
              >
                Eliminar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- Paginación -->
      <div class="pager" v-if="totalPages > 1">
        <button class="pager-btn" :disabled="page === 1" @click="goToPage(page - 1)">◀ Anterior</button>
        <span class="pager-info">Página {{ page }} de {{ totalPages }}</span>
        <button class="pager-btn" :disabled="page === totalPages" @click="goToPage(page + 1)">Siguiente ▶</button>
      </div>
    </div>

    <!-- FORMULARIO MODAL (admin + propietario) -->
    <div v-if="showForm && canEdit" class="backdrop">
      <div class="card" style="width:min(780px,92vw);">
        <h3>{{ editing ? 'Editar Bus' : 'Nuevo Bus' }}</h3>

        <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
          <div>
            <label class="label">Patente</label>
            <input class="input" v-model="form.plate" required />
          </div>
          <div>
            <label class="label">Modelo</label>
            <input class="input" v-model="form.model" required />
          </div>
          <div>
            <label class="label">Marca</label>
            <input class="input" v-model="form.brand" required />
          </div>
          <div>
            <label class="label">Combustible</label>
            <select class="select" v-model="form.fuel">
              <option value="DIESEL">DIESEL</option>
              <option value="GASOLINA">GASOLINA</option>
              <option value="GAS">GAS</option>
              <option value="ELECTRICO">ELÉCTRICO</option>
            </select>
          </div>
          <div>
            <label class="label">Año</label>
            <input class="input" type="number" v-model.number="form.year" />
          </div>
          <div>
            <label class="label">Kilómetros</label>
            <input class="input" type="number" v-model.number="form.km" />
          </div>
          <div>
            <label class="label">Capacidad</label>
            <input class="input" type="number" v-model.number="form.capacidad" />
          </div>
          <div>
            <label class="label">Revisión Técnica</label>
            <input class="input" type="date" v-model="form.fechaRevisionTecnica" />
          </div>
          <div>
            <label class="label">Extintor</label>
            <input class="input" type="date" v-model="form.fechaExtintor" />
          </div>
          <div>
            <label class="label">Estado</label>
            <select class="select" v-model="form.estado">
              <option value="OPERATIVO">OPERATIVO</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
              <option value="FUERA DE SERVICIO">FUERA DE SERVICIO</option>
            </select>
          </div>
        </div>

        <p v-if="validationError" class="error">{{ validationError }}</p>

        <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:1.25rem">
          <button class="btn" style="background:#6b7280" @click="showForm=false">Cancelar</button>
          <button class="btn" @click="saveBus">Guardar</button>
        </div>
      </div>
    </div>

    <!-- MODAL ELIMINACIÓN (solo admin) -->
    <div v-if="showConfirmModal && canDelete" class="backdrop">
      <div class="card confirm-card">
        <h3>Confirmar Eliminación</h3>
        <p v-if="busToDelete">
          ¿Eliminar <strong>{{ busToDelete.plate }}</strong>?
        </p>

        <div class="confirm-actions">
          <button class="btn" style="background:#6b7280" @click="cancelRemoval">Cancelar</button>
          <button class="btn danger-btn" @click="removeBus">Eliminar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; gap: 1rem; }

.card {
  background:#fff;
  border-radius:12px;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  padding:1rem;
}

.card-header-top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:.5rem;
}

.pill-readonly{
  padding:.1rem .6rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
  background:#f3f4f6;
  color:#4b5563;
}

.pill-admin{
  padding:.1rem .6rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
  background:#dcfce7;
  color:#166534;
}

.pill-owner{
  padding:.1rem .6rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
  background:#e0f2fe;
  color:#1d4ed8;
}

.filters {
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:1rem;
  align-items:end;
}

.label {
  font-size:.85rem;
  font-weight:600;
  color:#4b5563;
  margin-bottom:.35rem;
}

.input,.select {
  width:100%;
  border:1px solid #e5e7eb;
  border-radius:10px;
  padding:.55rem .75rem;
}

.input:focus,.select:focus {
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,.25);
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

.danger-btn {
  background:#dc2626;
  color:#fff;
}

.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

/* TARJETAS DE BUS */
.bus-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.bus-card {
  border-radius:16px;
  border:1px solid #e5e7eb;
  padding:1rem 1.25rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.bus-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.bus-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.bus-icon {
  width:50px;
  height:50px;
  background:#eef2ff;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}

.bus-plate {
  font-size:1.2rem;
  font-weight:700;
  letter-spacing:.08em;
}

.bus-model {
  color:#6b7280;
  font-size:.85rem;
}

/* Métricas */
.bus-card-body {
  margin-top:1rem;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:.8rem;
}

.bus-metric {
  background:#f9fafb;
  border-radius:12px;
  padding:.7rem;
}

.metric-label {
  font-size:.7rem;
  color:#9ca3af;
  text-transform:uppercase;
}

.metric-value {
  font-size:1rem;
  font-weight:600;
}

/* Footer */
.bus-card-footer {
  margin-top:1rem;
  padding-top:.75rem;
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
  border-color:#2563eb;
  background:#e8edff;
}

.danger-outline {
  color:#b91c1c;
  background:#fef2f2;
}
.danger-outline:hover {
  background:#fee2e2;
  border-color:#ef4444;
}

.footer-actions{
  display:flex;
  gap:.5rem;
}

/* Paginación */
.pager{
  margin-top:1rem;
  display:flex;
  justify-content:center;
  align-items:center;
  gap:.75rem;
  font-size:.9rem;
}
.pager-btn{
  border:1px solid #d1d5db;
  border-radius:999px;
  padding:.3rem .8rem;
  background:#fff;
  cursor:pointer;
}
.pager-btn:disabled{
  opacity:.4;
  cursor:default;
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

.confirm-card {
  text-align:center;
  width:min(400px,90vw);
}

.confirm-actions {
  display:flex;
  justify-content:center;
  gap:1rem;
  margin-top:1.2rem;
}

.error{
  color:#dc2626;
  margin-top:.35rem;
  font-size:.9rem;
}

@media (max-width:768px) {
  .filters { grid-template-columns:1fr; }
  .bus-card-body { grid-template-columns:1fr; }
  .bus-card-footer { flex-direction:column; gap:.6rem; }
}
</style>
