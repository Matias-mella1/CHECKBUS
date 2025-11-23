<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })

// === Estado general ===
const modo = ref<'PROPIETARIO' | 'CONDUCTOR'>('PROPIETARIO')
const loading = ref(true)
const errorMsg = ref('')

// === Auth ===
const { user, refresh } = useAuth()

// Roles del usuario
const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})
const isPropietario = computed(() => rolesUsuario.value.includes('PROPIETARIO'))
const isConductor   = computed(() => rolesUsuario.value.includes('CONDUCTOR'))

// ID usuario logueado
const myUserId = computed(() => Number((user.value as any)?.id ?? 0))

// === Datos ===
const buses = ref<any[]>([])
const mantenciones = ref<any[]>([])
const incidentes = ref<any[]>([])
const hasIncidentesApi = ref(true)
const turnos = ref<any[]>([])

// === Stats rápidas ===
const totalBuses = computed(() => buses.value.length)
const totalMantenciones = computed(() => mantenciones.value.length)
const totalIncidentes = computed(() => incidentes.value.length)
const totalTurnos = computed(() => turnos.value.length)

// === Helpers ===
function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

// 🔧 helper separado para el bus del incidente
const busLabelIncidente = (i: any): string => {
  if (!i) return '—'

  // si el backend ya trae campos planos
  if (i.bus_patente)  return String(i.bus_patente)
  if (i.bus_label)    return String(i.bus_label)
  if (i.patente)      return String(i.patente)
  if (i.plate)        return String(i.plate)
  if (typeof i.bus === 'string') return i.bus

  const b = i.bus || {}

  const plate = b.patente ?? b.plate ?? b.placa ?? ''
  const code  = b.code ?? b.codigo ?? ''
  const model = b.modelo ?? b.model ?? ''

  if (code && plate && model) return `${code} - ${plate} (${model})`
  if (code && plate)          return `${code} - ${plate}`
  if (plate && model)         return `${plate} (${model})`
  return plate || code || model || '—'
}

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    return (await $fetch(url, { credentials: 'include' })) as T
  } catch (e: any) {
    console.error('safeFetch error →', url, e?.data || e)
    if (url.includes('/api/incidentes')) {
      hasIncidentesApi.value = false
    }
    return null
  }
}

// === Carga Propietario ===
async function loadPropietario() {
  loading.value = true
  errorMsg.value = ''
  try {
    const busRes = await safeFetch<{ items?: any[] }>('/api/buses')
    buses.value = busRes?.items ?? []

    const mantRes = await safeFetch<{ items?: any[] }>('/api/mantenimientos')
    mantenciones.value = mantRes?.items ?? []

    const incRes = await safeFetch<{ items?: any[] }>('/api/incidentes')
    incidentes.value = incRes?.items ?? []
  } catch (e: any) {
    console.error('loadPropietario error →', e)
    errorMsg.value = e?.data?.message || e?.message || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

// === Carga Conductor ===
async function loadTurnos() {
  loading.value = true
  errorMsg.value = ''
  turnos.value = []
  try {
    if (!myUserId.value) await refresh(true)

    const r = await $fetch<{ items?: any[] }>('/api/conductor/turnos', {
      query: { id_usuario: myUserId.value || undefined },
      credentials: 'include',
    })

    turnos.value = (r.items ?? []).map(t => ({
      id: t.id,
      bus: t.bus ?? '—',
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: String(t.estado || '').toUpperCase(),
      titulo: t.titulo || '—',
      descripcion: t.descripcion || '—',
    }))
  } catch (e: any) {
    console.error('loadTurnos error →', e)
    errorMsg.value = e?.data?.message || e?.message || 'No se pudieron cargar los turnos.'
  } finally {
    loading.value = false
  }
}

// === Cambio de modo ===
async function cambiarModo(nuevo: 'PROPIETARIO' | 'CONDUCTOR') {
  if (modo.value === nuevo) return
  modo.value = nuevo

  if (nuevo === 'PROPIETARIO') {
    await loadPropietario()
  } else {
    if (!myUserId.value) await refresh(true)
    await loadTurnos()
  }
}

// === Inicialización ===
onMounted(async () => {
  await refresh(true)

  if (isPropietario.value) {
    modo.value = 'PROPIETARIO'
    await loadPropietario()
  } else if (isConductor.value) {
    modo.value = 'CONDUCTOR'
    await loadTurnos()
  } else {
    // sin rol → no cargamos nada pero evitamos error
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <!-- ===================== BARRA DE MODOS ===================== -->
    <div class="mode-bar">
      <button
        v-if="isPropietario"
        :class="['mode-btn', { active: modo === 'PROPIETARIO' }]"
        @click="cambiarModo('PROPIETARIO')"
      >
        Modo Propietario
      </button>

      <button
        v-if="isConductor"
        :class="['mode-btn', { active: modo === 'CONDUCTOR' }]"
        @click="cambiarModo('CONDUCTOR')"
      >
        Modo Conductor
      </button>
    </div>

    <!-- ===================== MODO PROPIETARIO ===================== -->
    <div v-if="modo === 'PROPIETARIO'" class="flota-grid">
      <!-- Header / Stats -->
      <section class="page-header-card">
        <div>
          <h2 class="page-title">Resumen General de Mi Flota</h2>
          <p class="page-subtitle">
            Vista rápida de tus buses, mantenciones e incidentes recientes.
          </p>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </div>

        <div class="header-stats">
          <div class="stat">
            <span class="stat-label">Buses</span>
            <span class="stat-value">{{ totalBuses }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Mantenciones</span>
            <span class="stat-value accent">{{ totalMantenciones }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Incidentes</span>
            <span class="stat-value danger">{{ totalIncidentes }}</span>
          </div>
        </div>
      </section>

      <!-- Buses -->
      <section class="block-card">
        <header class="block-header">
          <div>
            <h3 class="block-title">Mis Buses</h3>
            <p class="block-subtitle">Estado actual de la flota.</p>
          </div>
        </header>

        <div v-if="loading" class="skeleton" style="height:42px"></div>
        <template v-else>
          <div class="table-wrapper" v-if="buses.length">
            <table class="nice-table">
              <thead>
                <tr>
                  <th>Patente</th>
                  <th>Modelo</th>
                  <th>Año</th>
                  <th>KM</th>
                  <th class="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in buses" :key="b.id">
                  <td>{{ b.patente ?? b.plate ?? '—' }}</td>
                  <td>{{ b.modelo ?? b.model ?? '—' }}</td>
                  <td>{{ b.anio ?? b.year ?? '—' }}</td>
                  <td>{{ b.km ?? '—' }}</td>
                  <td class="text-right">
                    <span
                      class="tag"
                      :class="{
                        'tag-success': (b.estado || '').toUpperCase() === 'OPERATIVO',
                        'tag-danger': (b.estado || '').toUpperCase() === 'FUERA DE SERVICIO'
                      }"
                    >
                      {{ b.estado || '—' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">🚌 No hay buses registrados.</div>
        </template>
      </section>

      <!-- Mantenciones -->
      <section class="block-card">
        <header class="block-header">
          <div>
            <h3 class="block-title">Mantenciones</h3>
            <p class="block-subtitle">Próximas y recientes.</p>
          </div>
        </header>

        <div v-if="loading" class="skeleton" style="height:42px"></div>
        <template v-else>
          <div v-if="mantenciones.length" class="table-wrapper">
            <table class="nice-table">
              <thead>
                <tr>
                  <th>Bus</th>
                  <th>Fecha</th>
                  <th class="text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in mantenciones" :key="m.id">
                  <td>{{ m.bus?.patente ?? '—' }}</td>
                  <td>{{ fmtDate(m.fecha) }}</td>
                  <td class="text-right">
                    <span class="tag tag-info">
                      {{ m.estado?.nombre_estado ?? '—' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">🛠️ Sin mantenciones.</div>
        </template>
      </section>

      <!-- Incidentes -->
      <section class="block-card">
        <header class="block-header">
          <div>
            <h3 class="block-title">Incidentes</h3>
            <p class="block-subtitle">Últimos reportes asociados a tus buses.</p>
          </div>
        </header>

        <div v-if="!hasIncidentesApi" class="empty">
          ⚠️ Módulo de incidentes no disponible.
        </div>

        <template v-else>
          <div v-if="loading" class="skeleton" style="height:42px"></div>

          <template v-else>
            <div v-if="incidentes.length" class="table-wrapper">
              <table class="nice-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Bus</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in incidentes" :key="i.id">
                    <td class="col-title">
                      {{ i.titulo ?? '(Sin título)' }}
                    </td>
                    <td class="col-bus">
                      {{ busLabelIncidente(i) }}
                    </td>
                    <td>{{ fmtDate(i.fecha) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="empty">⚠️ Sin incidentes.</div>
          </template>
        </template>
      </section>
    </div>

    <!-- ===================== MODO CONDUCTOR ===================== -->
    <div v-else class="flota-grid">
      <section class="page-header-card">
        <div>
          <h2 class="page-title">Mis Turnos</h2>
          <p class="page-subtitle">
            Turnos asignados como conductor.
          </p>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </div>

        <div class="header-stats">
          <div class="stat">
            <span class="stat-label">Total turnos</span>
            <span class="stat-value">{{ totalTurnos }}</span>
          </div>
        </div>
      </section>

      <section class="block-card">
        <div v-if="loading" class="list-empty">Cargando…</div>
        <div v-else-if="!turnos.length" class="list-empty">
          🕒 No tienes turnos asignados.
        </div>

        <div v-else class="turn-list">
          <article
            v-for="t in turnos"
            :key="t.id"
            class="turn-card"
          >
            <header class="turn-header">
              <div class="turn-main">
                <div class="turn-icon">🚌</div>
                <div>
                  <div class="turn-title">
                    Turno #{{ t.id }} — {{ t.bus }}
                  </div>
                  <div class="turn-sub">
                    {{ t.titulo || 'Sin título' }}
                  </div>
                </div>
              </div>

              <div class="turn-meta">
                <span
                  :class="[
                    'badge',
                    t.estado === 'PROGRAMADO'
                      ? 'badge-blue'
                      : t.estado === 'EN CURSO'
                        ? 'badge-yellow'
                        : t.estado === 'COMPLETADO'
                          ? 'badge-green'
                          : 'badge-red'
                  ]"
                >
                  {{ t.estado }}
                </span>
              </div>
            </header>

            <section class="turn-body">
              <div class="turn-grid">
                <div class="metric">
                  <span class="metric-label">Inicio</span>
                  <span class="metric-value">{{ fmtDate(t.hora_inicio) }}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Fin</span>
                  <span class="metric-value">{{ fmtDate(t.hora_fin) }}</span>
                </div>
                <div class="metric full">
                  <span class="metric-label">Descripción</span>
                  <span class="metric-value multiline">
                    {{ t.descripcion || '—' }}
                  </span>
                </div>
              </div>
            </section>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page{
  padding:1.25rem;
  background:#e5f3ff;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  gap:1rem;
}

/* Barra de modos */
.mode-bar{
  display:flex;
  justify-content:center;
  gap:.75rem;
  margin-bottom:.25rem;
}
.mode-btn{
  min-width:200px;
  padding:.7rem 1.6rem;
  border-radius:999px;
  border:1px solid #1d4ed8;
  background:#ffffff;
  font-weight:700;
  font-size:.95rem;
  color:#1d4ed8;
  cursor:pointer;
  box-shadow:0 4px 12px rgba(37,99,235,.18);
  transition:all .15s ease;
}
.mode-btn.active{
  background:#1d4ed8;
  color:#fff;
  box-shadow:0 6px 18px rgba(37,99,235,.32);
}
.mode-btn:hover{
  transform:translateY(-1px);
}

/* Layout */
.flota-grid{
  display:flex;
  flex-direction:column;
  gap:1rem;
}

/* Header general */
.page-header-card{
  background:#ffffff;
  border-radius:16px;
  padding:1rem 1.25rem;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}
.page-title{
  margin:0 0 .25rem;
  font-size:1.25rem;
  font-weight:700;
}
.page-subtitle{
  margin:0;
  font-size:.9rem;
  color:#6b7280;
}

/* Stats */
.header-stats{
  display:flex;
  gap:.75rem;
  flex-wrap:wrap;
}
.stat{
  background:#f3f4ff;
  border-radius:12px;
  padding:.45rem .9rem;
  min-width:130px;
}
.stat-label{
  font-size:.75rem;
  text-transform:uppercase;
  color:#6b7280;
}
.stat-value{
  display:block;
  font-size:1rem;
  font-weight:700;
  color:#111827;
}
.stat-value.accent{ color:#1d4ed8; }
.stat-value.danger{ color:#b91c1c; }

/* Cards de bloque */
.block-card{
  background:#ffffff;
  border-radius:16px;
  padding:.9rem 1.1rem 1.1rem;
  box-shadow:0 1px 3px rgba(0,0,0,.07);
}
.block-header{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom:.5rem;
}
.block-title{
  margin:0;
  font-size:1rem;
  font-weight:700;
}
.block-subtitle{
  margin:.1rem 0 0;
  font-size:.82rem;
  color:#6b7280;
}

/* Tablas */
.table-wrapper{
  margin-top:.25rem;
  overflow-x:auto;
}
.nice-table{
  width:100%;
  border-collapse:collapse;
  font-size:.9rem;
}
.nice-table thead{
  background:#f3f4f6;
}
.nice-table th,
.nice-table td{
  padding:.55rem .75rem;
  border-top:1px solid #e5e7eb;
}
.nice-table th{
  font-size:.78rem;
  text-transform:uppercase;
  letter-spacing:.03em;
  color:#6b7280;
  font-weight:600;
}
.nice-table tbody tr:nth-child(odd){
  background:#f9fafb;
}
.nice-table tbody tr:hover{
  background:#e5edff;
}
.text-right{
  text-align:right;
}

/* columnas incidentes */
.col-title{
  max-width:420px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.col-bus{
  width:220px;
}

.empty{
  text-align:center;
  color:#9ca3af;
  padding:.75rem 0;
  font-size:.9rem;
}
.error{
  color:#dc2626;
  margin-top:.35rem;
  font-size:.9rem;
}

/* Tags estado */
.tag{
  display:inline-flex;
  align-items:center;
  padding:.15rem .6rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
  background:#e5e7eb;
  color:#374151;
}
.tag-success{
  background:#dcfce7;
  color:#166534;
}
.tag-danger{
  background:#fee2e2;
  color:#991b1b;
}
.tag-warning{
  background:#fef9c3;
  color:#92400e;
}
.tag-info{
  background:#e0f2fe;
  color:#0369a1;
}

/* Turnos como cards */
.list-empty{
  padding:2rem;
  text-align:center;
  color:#6b7280;
}
.turn-list{
  display:flex;
  flex-direction:column;
  gap:1rem;
}
.turn-card{
  border-radius:18px;
  border:1px solid #e5e7eb;
  padding:1.1rem 1.4rem;
  background:#eff6ff;
  box-shadow:0 8px 20px rgba(0,0,0,.04);
}
.turn-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}
.turn-main{
  display:flex;
  align-items:center;
  gap:.9rem;
}
.turn-icon{
  width:48px;
  height:48px;
  border-radius:14px;
  background:#dbeafe;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}
.turn-title{
  font-size:1.05rem;
  font-weight:700;
}
.turn-sub{
  font-size:.85rem;
  color:#4b5563;
}
.turn-meta{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:.3rem;
}

/* Body turnos */
.turn-body{
  margin-top:.9rem;
  background:#ffffffde;
  border-radius:14px;
  padding:.9rem 1rem;
}
.turn-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.8rem 1.2rem;
}
.metric{
  background:#f9fafb;
  border-radius:10px;
  padding:.55rem .7rem;
}
.metric.full{
  grid-column:1 / -1;
}
.metric-label{
  font-size:.7rem;
  text-transform:uppercase;
  color:#9ca3af;
}
.metric-value{
  font-size:.9rem;
  font-weight:600;
}
.metric-value.multiline{
  white-space:pre-wrap;
  word-break:break-word;
}

/* Badges de turnos */
.badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:96px;
  padding:.2rem .6rem;
  border-radius:999px;
  font-size:.78rem;
  font-weight:700;
}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-yellow{background:#fef9c3;color:#92400e}
.badge-green{background:#dcfce7;color:#166534}
.badge-red{background:#fee2e2;color:#991b1b}

/* Skeleton */
.skeleton{
  width:100%;
  border-radius:6px;
  background:linear-gradient(90deg,#f3f3f3 25%,#e0e0e0 50%,#f3f3f3 75%);
  background-size:200% 100%;
  animation:loading 1.5s infinite;
}
@keyframes loading{
  0%{background-position:200% 0}
  100%{background-position:-200% 0}
}

/* Responsive */
@media (max-width:900px){
  .page{
    padding:.75rem;
  }
  .page-header-card{
    flex-direction:column;
  }
  .header-stats{
    width:100%;
  }
}
@media (max-width:768px){
  .turn-card{
    padding:1rem;
  }
  .turn-header{
    flex-direction:column;
    align-items:flex-start;
  }
  .turn-meta{
    flex-direction:row;
    align-items:center;
    gap:.4rem;
  }
  .turn-grid{
    grid-template-columns:1fr;
  }
}
</style>
