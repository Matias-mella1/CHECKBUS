<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

definePageMeta({
  layout: 'panel',
})

/* ===============================
   Tipos
================================ */
type Estado = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'

interface BusRow {
  id: number
  code: number
  plate: string
  model: string
  year: number
  km: number
  status: Estado
}

interface UserRow {
  id: number
  nombre: string
  email: string
  rol: string
  telefono: string
  estado: 'ACTIVO' | 'INACTIVO'
}

/* ===============================
   Estado
================================ */
const buses   = ref<BusRow[]>([])
const users   = ref<UserRow[]>([])
const alertas = ref<any[]>([])   // 👈 NUEVO: lista de alertas

const loading  = ref(false)
const errorMsg = ref<string | null>(null)

/* ===============================
   Helpers
================================ */
function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data))  return payload.data
  return []
}

function normalizeEstado(v: any): Estado {
  const s = String(v ?? '').toUpperCase()
  if (s === 'MANTENIMIENTO') return 'MANTENIMIENTO'
  if (s === 'FUERA DE SERVICIO' || s === 'FUERA_DE_SERVICIO') return 'FUERA DE SERVICIO'
  return 'OPERATIVO'
}

function normalizeBus(raw: any): BusRow {
  return {
    id:    Number(raw?.id ?? raw?.id_bus ?? 0),
    code:  Number(raw?.code ?? raw?.codigo ?? 0),
    plate: String(raw?.patente ?? raw?.plate ?? ''),
    model: String(raw?.modelo ?? raw?.model ?? ''),
    year:  Number(raw?.annio ?? raw?.anio ?? raw?.year ?? 0),
    km:    Number(raw?.km ?? raw?.kilometraje ?? 0),
    status: normalizeEstado(raw?.estado ?? raw?.status),
  }
}

function estadoClass(s: Estado) {
  return s.toLowerCase().replace(/\s+/g, '-')
}

/* ===============================
   Carga de datos
================================ */
let aborter: AbortController | null = null

async function loadBuses() {
  if (aborter) aborter.abort()
  aborter = new AbortController()

  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<any>('/api/buses', {
      signal: aborter.signal as any,
    })
    const arr = pickArray(res)
    buses.value = arr.map(normalizeBus)
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    errorMsg.value = e?.data?.message || e?.message || 'Error al cargar buses'
    console.error('loadBuses error →', e)
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const res = await $fetch<{ items: UserRow[] }>('/api/usuarios')
    users.value = res.items || []
  } catch (e: any) {
    console.error('Error cargando usuarios:', e)
  }
}

// 👇 NUEVO: cargar alertas desde la API
async function loadAlertas() {
  try {
    const res = await $fetch<any>('/api/alertas', {
      // si tu API soporta filtros podrías hacer:
      // query: { estado: 'ACTIVA' }
    })
    alertas.value = pickArray(res)
  } catch (e: any) {
    console.error('Error cargando alertas:', e)
  }
}

/* ===============================
   Auto actualización
================================ */
let timer: number | null = null
onMounted(() => {
  loadBuses()
  loadUsers()
  loadAlertas()              // 👈 también cargamos alertas al inicio
  // refrescamos solo buses de forma periódica
  timer = window.setInterval(loadBuses, 10000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (aborter) aborter.abort()
})

/* ===============================
   KPIs
================================ */
const kpiTotal = computed(() => buses.value.length)
const kpiMant  = computed(() => buses.value.filter(r => r.status === 'MANTENIMIENTO').length)
const kpiUsers = computed(() => users.value.length)

// 🔴 AHORA: KPI de alertas ACTIVAS (estado ACTIVA)
const kpiAlert = computed(() =>
  alertas.value.filter(a => {
    const nombreEstado = String(
      a?.estado?.nombre_estado ?? a?.estado ?? ''
    ).toUpperCase()
    return nombreEstado === 'ACTIVA'
  }).length
)
</script>

<template>
  <div class="dashboard">
    <!-- Header general -->
    <header class="dashboard-header">
      <div>
        <h1 class="dash-title">Panel general</h1>
        <p class="dash-subtitle">
          Vista rápida de tu flota, usuarios y estados actuales.
        </p>
        <p v-if="errorMsg" class="error">⚠️ {{ errorMsg }}</p>
      </div>
    </header>

    <!-- KPIs -->
    <section class="cards">
      <article class="card stat total">
        <div class="stat-icon">🚌</div>
        <div class="stat-text">
          <h4>Buses</h4>
          <p>{{ kpiTotal }}</p>
        </div>
      </article>

      <article class="card stat oper">
        <div class="stat-icon">👥</div>
        <div class="stat-text">
          <h4>Usuarios</h4>
          <p>{{ kpiUsers }}</p>
        </div>
      </article>

      <article class="card stat mant">
        <div class="stat-icon">🛠️</div>
        <div class="stat-text">
          <h4>En mantenimiento</h4>
          <p>{{ kpiMant }}</p>
        </div>
      </article>

      <!-- KPI ALERTAS (alertas ACTIVAS) -->
      <article class="card stat alert">
        <div class="stat-icon">⚠️</div>
        <div class="stat-text">
          <h4>Alertas</h4>
          <p>{{ kpiAlert }}</p>
        </div>
      </article>
    </section>

    <!-- Listado de Buses -->
    <section class="card table-card">
      <div class="card-header">
        <div>
          <h3>Listado de Buses</h3>
          <p class="card-subtitle">Estado actual y kilometraje de cada unidad.</p>
        </div>
      </div>

      <div v-if="errorMsg" class="empty">⚠️ {{ errorMsg }}</div>

      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Patente</th>
              <th>Modelo</th>
              <th>Año</th>
              <th>KM</th>
              <th class="text-right">Estado</th>
            </tr>
          </thead>

          <tbody v-if="loading">
            <tr v-for="i in 3" :key="i">
              <td colspan="6"><div class="skeleton"></div></td>
            </tr>
          </tbody>

          <tbody v-else-if="buses.length">
            <tr v-for="r in buses" :key="r.id">
              <td class="col-id">#{{ r.id }}</td>
              <td>{{ r.plate }}</td>
              <td>{{ r.model || '—' }}</td>
              <td>{{ r.year || '—' }}</td>
              <td>
                {{ Number.isFinite(r.km) ? r.km.toLocaleString() + ' km' : '—' }}
              </td>
              <td class="text-right">
                <span :class="['badge', estadoClass(r.status)]">
                  {{ r.status }}
                </span>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="6">
                <div class="empty">
                  <span class="empty-icon">🚌</span>
                  No hay buses registrados.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Listado de Usuarios -->
    <section class="card table-card">
      <div class="card-header">
        <div>
          <h3>Listado de Usuarios</h3>
          <p class="card-subtitle">Personas con acceso al sistema y su estado.</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Teléfono</th>
              <th class="text-right">Estado</th>
            </tr>
          </thead>

          <tbody v-if="users.length">
            <tr v-for="u in users" :key="u.id">
              <td class="col-name">{{ u.nombre }}</td>
              <td class="col-email">{{ u.email }}</td>
              <td>{{ u.rol }}</td>
              <td>{{ u.telefono || '—' }}</td>
              <td class="text-right">
                <span :class="['badge', u.estado === 'ACTIVO' ? 'activo' : 'inactivo']">
                  {{ u.estado }}
                </span>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr>
              <td colspan="5">
                <div class="empty">
                  <span class="empty-icon">👥</span>
                  No hay usuarios registrados.
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: radial-gradient(circle at top, #e0f2ff 0, #e5f3ff 35%, #e5f3ff 100%);
  min-height: 100vh;
}

/* Header */
.dashboard-header {
  background: #ffffff;
  border-radius: 16px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dash-title {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
  font-weight: 700;
}
.dash-subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

/* ===== KPI Cards ===== */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
}
.card.stat {
  padding: 1rem;
  border-radius: 16px;
  color: white;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.18);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
  position: relative;
  isolation: isolate;
  cursor: default;
  transition: transform 0.18s ease, box-shadow 0.18s ease, translate 0.18s ease;
}
.card.stat::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background: radial-gradient(circle at top left, #fff 0, transparent 50%);
  pointer-events: none;
}
.card.stat:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.26);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
.stat-text h4 {
  font-size: 0.9rem;
  margin: 0 0 0.1rem;
  opacity: 0.9;
}
.stat-text p {
  font-size: 1.7rem;
  font-weight: 700;
  margin: 0;
}

.stat.total { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
.stat.oper  { background: linear-gradient(135deg, #16a34a, #15803d); }
.stat.mant  { background: linear-gradient(135deg, #f59e0b, #d97706); }
.stat.alert { background: linear-gradient(135deg, #dc2626, #b91c1c); }

/* ===== Cards de tablas ===== */
.table-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 1rem 1.1rem 1.2rem;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}
.card-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
.card-subtitle {
  margin: 0.1rem 0 0;
  font-size: 0.82rem;
  color: #6b7280;
}

/* ===== Tablas ===== */
.table-wrapper {
  margin-top: 0.25rem;
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}
th,
td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}
th {
  background: #f9fafb;
  font-weight: 600;
  font-size: 0.8rem;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
tbody tr:nth-child(odd) td {
  background: #f9fafb;
}
tbody tr:hover td {
  background: #eef2ff;
}
.text-right {
  text-align: right;
}
.col-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.8rem;
  color: #6b7280;
}
.col-name {
  font-weight: 600;
}
.col-email {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== Estados / badges ===== */
.badge {
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #ffffff;
}
.badge.operativo {
  background: #16a34a;
}
.badge.mantenimiento {
  background: #f59e0b;
}
.badge.fuera-de-servicio {
  background: #dc2626;
}
.badge.activo {
  background: #16a34a;
}
.badge.inactivo {
  background: #6b7280;
}

/* ===== Mensajes vacíos ===== */
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.2rem;
  color: #6b7280;
  font-weight: 500;
  font-size: 0.9rem;
}
.empty-icon {
  font-size: 1.2rem;
  opacity: 0.9;
}

/* ===== Errores ===== */
.error {
  margin-top: 0.35rem;
  color: #dc2626;
  font-size: 0.9rem;
}

/* ===== Cargando ===== */
.skeleton {
  width: 100%;
  height: 30px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f3f3f3 25%, #e0e0e0 50%, #f3f3f3 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}
@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .dashboard {
    padding: 1rem;
  }
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
@media (max-width: 640px) {
  .cards {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
