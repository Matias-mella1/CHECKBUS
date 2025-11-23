<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })

// === Estado general ===
const loading = ref(true)
const errorMsg = ref('')

// === Auth ===
const { user, refresh } = useAuth()

// Roles del usuario
const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})
const isSupervisor = computed(() => rolesUsuario.value.includes('SUPERVISOR'))

// === Datos ===
const incidentes   = ref<any[]>([])
const turnos       = ref<any[]>([])
const mantenciones = ref<any[]>([])
const alertas      = ref<any[]>([])
const documentos   = ref<any[]>([])

const hasAlertasApi = ref(true)
const hasDocsApi    = ref(true)

// === Helpers ===
function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function busLabelIncidente(i: any): string {
  if (!i) return '—'
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
    if (url.includes('/api/alertas'))     hasAlertasApi.value = false
    if (url.includes('/api/documentos'))  hasDocsApi.value    = false
    return null
  }
}

// === Carga Supervisor ===
async function loadSupervisor() {
  loading.value = true
  errorMsg.value = ''
  try {
    const incRes  = await safeFetch<{ items?: any[] }>('/api/incidentes')
    const turnRes = await safeFetch<{ items?: any[] }>('/api/turnos')
    const mantRes = await safeFetch<{ items?: any[] }>('/api/mantenimientos')
    const alertRes= await safeFetch<{ items?: any[] }>('/api/alertas')
    const docRes  = await safeFetch<{ items?: any[] }>('/api/documentos')

    incidentes.value   = incRes?.items  ?? []
    turnos.value       = turnRes?.items ?? []
    mantenciones.value = mantRes?.items ?? []
    alertas.value      = alertRes?.items?? []
    documentos.value   = docRes?.items  ?? []
  } catch (e:any) {
    console.error('loadSupervisor error →', e)
    errorMsg.value = e?.data?.message || e?.message || 'Error al cargar datos para supervisor'
  } finally {
    loading.value = false
  }
}

// === KPIs ===
const kpiIncPendientes = computed(() =>
  incidentes.value.filter(i => {
    const s = String(i.estado ?? i.estado_incidente ?? '').toUpperCase()
    return s === 'REPORTADO' || s === 'EN REVISION' || s === 'EN REVISIÓN'
  }).length
)

const kpiTurnosPorValidar = computed(() =>
  turnos.value.filter(t => {
    const s = String(t.estado ?? t.estado_turno ?? '').toUpperCase()
    return s === 'COMPLETADO' || s === 'POR VALIDAR'
  }).length
)

const kpiMantPorValidar = computed(() =>
  mantenciones.value.filter(m => {
    const s = String(m.estado?.nombre_estado ?? m.estado ?? '').toUpperCase()
    return s.includes('PENDIENTE') || s.includes('POR VALIDAR') || s.includes('TERMINADO')
  }).length
)

const kpiAlertasActivas = computed(() =>
  alertas.value.filter(a => {
    const s = String(a.estado ?? '').toUpperCase()
    return s === 'ACTIVA' || s === 'ABIERTA'
  }).length
)

// === Listas filtradas ===
const incidentesPendientes = computed(() =>
  incidentes.value.filter(i => {
    const s = String(i.estado ?? i.estado_incidente ?? '').toUpperCase()
    return s === 'REPORTADO' || s === 'EN REVISION' || s === 'EN REVISIÓN'
  })
)

const turnosPendientes = computed(() =>
  turnos.value.filter(t => {
    const s = String(t.estado ?? t.estado_turno ?? '').toUpperCase()
    return s === 'COMPLETADO' || s === 'POR VALIDAR'
  })
)

const mantencionesPendientes = computed(() =>
  mantenciones.value.filter(m => {
    const s = String(m.estado?.nombre_estado ?? m.estado ?? '').toUpperCase()
    return s.includes('PENDIENTE') || s.includes('POR VALIDAR') || s.includes('TERMINADO')
  })
)

const alertasActivas = computed(() =>
  alertas.value.filter(a => {
    const s = String(a.estado ?? '').toUpperCase()
    return s === 'ACTIVA' || s === 'ABIERTA'
  })
)

const documentosPendientes = computed(() =>
  documentos.value.filter(d => {
    const s = String(d.estado ?? '').toUpperCase()
    return s === 'PENDIENTE' || s === 'POR VALIDAR'
  })
)

// === Init ===
onMounted(async () => {
  await refresh(true)
  if (!isSupervisor.value) {
    loading.value = false
    errorMsg.value = 'No tienes rol de SUPERVISOR.'
    return
  }
  await loadSupervisor()
})
</script>

<template>
  <div class="page">
    <!-- SIN ROL SUPERVISOR -->
    <div v-if="!isSupervisor" class="not-allowed">
      <div class="not-allowed-icon">⛔</div>
      <h2>Acceso restringido</h2>
      <p>Este panel es solo para usuarios con rol <strong>SUPERVISOR</strong>.</p>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <p v-else class="hint">Contacta al administrador si crees que es un error.</p>
    </div>

    <template v-else>
      <!-- HEADER + KPIs -->
      <section class="page-header-card">
        <div class="header-left">
          <div class="pill">SUPERVISOR</div>
          <h2 class="page-title">Panel de Supervisión</h2>
          
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </div>

        <div class="header-stats">
          <div class="stat stat-inc">
            <div class="stat-icon">⚠️</div>
            <div>
              <span class="stat-label">Incidentes</span>
              <span class="stat-value">{{ kpiIncPendientes }}</span>
            </div>
          </div>
          <div class="stat stat-turnos">
            <div class="stat-icon">🕒</div>
            <div>
              <span class="stat-label">Turnos </span>
              <span class="stat-value">{{ kpiTurnosPorValidar }}</span>
            </div>
          </div>
          <div class="stat stat-mant">
            <div class="stat-icon">🛠️</div>
            <div>
              <span class="stat-label">Mantenciones</span>
              <span class="stat-value">{{ kpiMantPorValidar }}</span>
            </div>
          </div>
          <div class="stat stat-alert">
            <div class="stat-icon">🚨</div>
            <div>
              <span class="stat-label">Alertas </span>
              <span class="stat-value">{{ kpiAlertasActivas }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- GRID PRINCIPAL -->
      <div class="grid">
        <!-- Incidentes -->
        <section class="block-card block-incidentes">
          <header class="block-header">
            <div class="block-title-wrap">
              <span class="block-icon">⚠️</span>
              <div>
                <h3 class="block-title">Incidentes</h3>
                
              </div>
            </div>
            <span class="block-counter">{{ incidentesPendientes.length }}</span>
          </header>

          <div v-if="loading" class="list-empty">Cargando…</div>
          <template v-else>
            <div v-if="incidentesPendientes.length" class="table-wrapper">
              <table class="nice-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Bus</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="i in incidentesPendientes" :key="i.id">
                    <td class="col-title">{{ i.titulo ?? '(Sin título)' }}</td>
                    <td class="col-bus">{{ busLabelIncidente(i) }}</td>
                    <td>{{ fmtDate(i.fecha) }}</td>
                    <td>
                      <span class="tag tag-warning">
                        {{ i.estado ?? i.estado_incidente ?? '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty ok">✅ No hay incidentes pendientes de revisión.</div>
          </template>
        </section>

        <!-- Turnos -->
        <section class="block-card block-turnos">
          <header class="block-header">
            <div class="block-title-wrap">
              <span class="block-icon">🕒</span>
              <div>
                <h3 class="block-title">Turnos</h3>
               
              </div>
            </div>
            <span class="block-counter">{{ turnosPendientes.length }}</span>
          </header>

          <div v-if="loading" class="list-empty">Cargando…</div>
          <template v-else>
            <div v-if="turnosPendientes.length" class="table-wrapper">
              <table class="nice-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bus</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in turnosPendientes" :key="t.id">
                    <td>#{{ t.id }}</td>
                    <td>{{ t.bus?.patente ?? t.bus ?? '—' }}</td>
                    <td>{{ fmtDate(t.hora_inicio ?? t.inicio) }}</td>
                    <td>{{ fmtDate(t.hora_fin ?? t.fin) }}</td>
                    <td>
                      <span class="tag tag-info">
                        {{ t.estado ?? t.estado_turno ?? '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty ok">✅ No hay turnos pendientes de validación.</div>
          </template>
        </section>

        <!-- Mantenciones -->
        <section class="block-card block-mant">
          <header class="block-header">
            <div class="block-title-wrap">
              <span class="block-icon">🛠️</span>
              <div>
                <h3 class="block-title">Mantenimientos</h3>
               
              </div>
            </div>
            <span class="block-counter">{{ mantencionesPendientes.length }}</span>
          </header>

          <div v-if="loading" class="list-empty">Cargando…</div>
          <template v-else>
            <div v-if="mantencionesPendientes.length" class="table-wrapper">
              <table class="nice-table">
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in mantencionesPendientes" :key="m.id">
                    <td>{{ m.bus?.patente ?? '—' }}</td>
                    <td>{{ fmtDate(m.fecha) }}</td>
                    <td>
                      <span class="tag tag-info">
                        {{ m.estado?.nombre_estado ?? m.estado ?? '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty ok">✅ No hay mantenimientos por validar.</div>
          </template>
        </section>

        <!-- Alertas -->
        <section class="block-card block-alertas">
          <header class="block-header">
            <div class="block-title-wrap">
              <span class="block-icon">🚨</span>
              <div>
                <h3 class="block-title">Alertas </h3>
               
              </div>
            </div>
            <span class="block-counter">{{ alertasActivas.length }}</span>
          </header>

          <div v-if="!hasAlertasApi" class="empty">
            ⚠️ Módulo de alertas no disponible.
          </div>

          <template v-else>
            <div v-if="loading" class="list-empty">Cargando…</div>
            <template v-else>
              <div v-if="alertasActivas.length" class="table-wrapper">
                <table class="nice-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in alertasActivas" :key="a.id">
                      <td>{{ a.tipo ?? a.tipo_alerta ?? 'Alerta' }}</td>
                      <td class="col-title">{{ a.descripcion ?? '—' }}</td>
                      <td>{{ fmtDate(a.fecha) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty ok">✅ No hay alertas activas.</div>
            </template>
          </template>
        </section>

        <!-- Documentos -->
        <section class="block-card block-docs">
          <header class="block-header">
            <div class="block-title-wrap">
              <span class="block-icon">📄</span>
              <div>
                <h3 class="block-title">Documentos</h3>
                
              </div>
            </div>
            <span class="block-counter">{{ documentosPendientes.length }}</span>
          </header>

          <div v-if="!hasDocsApi" class="empty">
            ⚠️ Módulo de documentos no disponible.
          </div>

          <template v-else>
            <div v-if="loading" class="list-empty">Cargando…</div>
            <template v-else>
              <div v-if="documentosPendientes.length" class="table-wrapper">
                <table class="nice-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Subido por</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="d in documentosPendientes" :key="d.id">
                      <td>{{ d.tipo ?? d.tipo_documento ?? 'Documento' }}</td>
                      <td>{{ d.usuario?.nombre ?? d.subido_por ?? '—' }}</td>
                      <td>{{ fmtDate(d.fecha_subida ?? d.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty ok">✅ No hay documentos pendientes de validación.</div>
            </template>
          </template>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page{
  padding:1.25rem;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  gap:1rem;
  background:
    radial-gradient(circle at top left,#dbeafe 0,#e5f3ff 40%,#e0f2fe 100%);
}

/* Acceso restringido */
.not-allowed{
  margin:auto;
  max-width:480px;
  text-align:center;
  background:#ffffff;
  border-radius:18px;
  padding:1.5rem 1.75rem;
  box-shadow:0 16px 40px rgba(15,23,42,.18);
}
.not-allowed-icon{
  font-size:2.2rem;
  margin-bottom:.5rem;
}
.hint{
  color:#6b7280;
  font-size:.9rem;
}

/* Header general */
.page-header-card{
  background:linear-gradient(135deg,#1d4ed8,#4f46e5);
  border-radius:18px;
  padding:1.1rem 1.3rem;
  box-shadow:0 12px 32px rgba(15,23,42,.28);
  color:#e5e7eb;
  display:flex;
  justify-content:space-between;
  align-items:stretch;
  gap:1rem;
  position:relative;
  overflow:hidden;
}
.page-header-card::after{
  content:'';
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at top right,rgba(255,255,255,.25) 0,transparent 55%);
  pointer-events:none;
}
.header-left{
  position:relative;
  z-index:1;
}
.pill{
  display:inline-flex;
  align-items:center;
  gap:.25rem;
  padding:.18rem .7rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.08em;
  background:rgba(15,23,42,.3);
  border:1px solid rgba(191,219,254,.5);
  margin-bottom:.35rem;
}
.page-title{
  margin:0 0 .2rem;
  font-size:1.35rem;
  font-weight:800;
}
.page-subtitle{
  margin:0;
  font-size:.9rem;
  color:#e5e7eb;
}
.page-subtitle strong{
  font-weight:700;
}

/* Header stats */
.header-stats{
  position:relative;
  z-index:1;
  display:grid;
  grid-auto-flow:column;
  grid-auto-columns:minmax(140px,1fr);
  gap:.6rem;
}
.stat{
  background:rgba(15,23,42,.45);
  border-radius:14px;
  padding:.55rem .7rem;
  display:flex;
  align-items:center;
  gap:.5rem;
  backdrop-filter:blur(6px);
}
.stat-icon{
  width:30px;
  height:30px;
  border-radius:999px;
  background:rgba(15,23,42,.7);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.2rem;
}
.stat-label{
  display:block;
  font-size:.75rem;
  text-transform:uppercase;
  letter-spacing:.06em;
  color:#c7d2fe;
}
.stat-value{
  font-size:1.1rem;
  font-weight:800;
  color:#f9fafb;
}
.stat-inc   .stat-icon{background:rgba(248,113,113,.8)}
.stat-turnos.stat .stat-icon{background:rgba(96,165,250,.8)}
.stat-mant  .stat-icon{background:rgba(251,191,36,.85)}
.stat-alert .stat-icon{background:rgba(239,68,68,.9)}

/* Grid secciones */
.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
  gap:1rem;
}

/* Cards */
.block-card{
  background:#ffffff;
  border-radius:18px;
  padding:.95rem 1.1rem 1.15rem;
  box-shadow:0 10px 24px rgba(15,23,42,.12);
  border:1px solid #e5e7eb;
  position:relative;
}
.block-card::before{
  content:'';
  position:absolute;
  inset:0;
  border-radius:inherit;
  pointer-events:none;
  opacity:.6;
}
.block-incidentes::before{
  border-top:3px solid #f97316;
}
.block-turnos::before{
  border-top:3px solid #3b82f6;
}
.block-mant::before{
  border-top:3px solid #22c55e;
}
.block-alertas::before{
  border-top:3px solid #ef4444;
}
.block-docs::before{
  border-top:3px solid #8b5cf6;
}

.block-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:.5rem;
  gap:.5rem;
}
.block-title-wrap{
  display:flex;
  align-items:flex-start;
  gap:.6rem;
}
.block-icon{
  width:32px;
  height:32px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.2rem;
  background:#eff6ff;
}
.block-incidentes .block-icon{ background:#fff7ed; }
.block-mant       .block-icon{ background:#ecfdf5; }
.block-alertas    .block-icon{ background:#fef2f2; }
.block-docs       .block-icon{ background:#f5f3ff; }

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
.block-counter{
  align-self:flex-start;
  padding:.12rem .55rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:700;
  background:#eef2ff;
  color:#4f46e5;
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
  background:#e0f2fe;
}
.col-title{
  max-width:260px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.col-bus{
  max-width:190px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Tags */
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

/* Mensajes */
.empty,
.list-empty{
  text-align:center;
  color:#9ca3af;
  padding:1rem .25rem;
  font-size:.9rem;
}
.empty.ok{
  color:#16a34a;
}

/* Errores */
.error{
  color:#fee2e2;
  font-size:.88rem;
  margin-top:.4rem;
}

/* Responsive */
@media (max-width:960px){
  .header-stats{
    grid-auto-flow:row;
    grid-auto-columns:auto;
  }
}
@media (max-width:900px){
  .page{
    padding:.85rem;
  }
  .page-header-card{
    flex-direction:column;
  }
}
@media (max-width:640px){
  .grid{
    grid-template-columns:1fr;
  }
}
</style>
