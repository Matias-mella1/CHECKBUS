<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'panel',
})

type BusesEstado = { estado: string; cantidad: number }
type MantEstado = { estado: string; cantidad: number }
type IncidenteItem = {
  id: number
  fecha: string
  bus: string
  tipo: string
  estado: string
  descripcion: string
}
type AlertaItem = {
  id: number
  fecha: string
  bus: string   
  tipo: string
  estado: string
  prioridad: string
  titulo: string
  descripcion: string
}
type DocItem = {
  id: number
  vence: string
  bus: string  
  tipo: string
  estado: string
  nombre_archivo: string
}
type TopBusIncidente = {
  id_bus: number
  patente: string
  cantidad: number
}
type ResumenFlota = {
  totalBuses: number
  busesOperativos: number
  busesEnTaller: number
  busesFueraServicio: number
  kmPromedio: number | null
  kmMaximo: number | null
  busesSinRevisionVigente: number
  busesSinExtintorVigente: number
  mantUltimoMes: number
  incidentesUltimos30: number
}

const loading = ref(true)
const errorMsg = ref('')

const resumen = ref<ResumenFlota | null>(null)

const busesPorEstado = ref<BusesEstado[]>([])
const mantPorEstado = ref<MantEstado[]>([])
const incidentesRecientes = ref<IncidenteItem[]>([])
const alertasActivas = ref<AlertaItem[]>([])
const docsPorVencer = ref<DocItem[]>([])
const topBusesIncidentes = ref<TopBusIncidente[]>([])

function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

// Chip de prioridad para alertas
function prioridadClass(p: string) {
  const v = (p || '').toUpperCase()
  if (v.includes('ALTA')) return 'badge badge--high'
  if (v.includes('MEDIA')) return 'badge badge--medium'
  if (v.includes('BAJA')) return 'badge badge--low'
  return 'badge'
}

/**
 * Normaliza listas que pueden venir como:
 *  - [] directamente
 *  - { items: [] }
 *  - null / undefined
 */
function normalizeList<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val as T[]
  if (val && Array.isArray(val.items)) return val.items as T[]
  return []
}

async function loadResumen() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await $fetch<any>('/api/reportes/flota-resumen', {
      credentials: 'include',
    })

    if (!data || !data.resumen) {
      throw new Error('Respuesta inválida del servidor')
    }

    resumen.value = data.resumen as ResumenFlota

    busesPorEstado.value      = normalizeList<BusesEstado>(data.busesPorEstado)
    mantPorEstado.value       = normalizeList<MantEstado>(data.mantPorEstado)
    incidentesRecientes.value = normalizeList<IncidenteItem>(data.incidentesRecientes)
    alertasActivas.value      = normalizeList<AlertaItem>(data.alertasActivas)
    docsPorVencer.value       = normalizeList<DocItem>(data.docsPorVencer)
    topBusesIncidentes.value  = normalizeList<TopBusIncidente>(data.topBusesIncidentes)

    console.log(
      'flota-resumen ->',
      'alertas:', alertasActivas.value.length,
      'docsPorVencer:', docsPorVencer.value.length,
    )
  } catch (e: any) {
    console.error('Error cargando flota-resumen:', e)
    errorMsg.value =
      e?.data?.message || e?.message || 'Error al cargar reporte de flota.'
  } finally {
    loading.value = false
  }
}

function descargarPdf() {
  window.open('/api/reportes/flota', '_blank')
}

onMounted(loadResumen)
</script>

<template>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="header-text">
        <p class="overline">Panel de control · Flota</p>
        <h1>📊 Reporte general de flota</h1>
        <p class="subtitle">
          Visión global del estado de la flota, mantenciones, incidentes, alertas y documentos clave.
        </p>
      </div>
      <button class="btn-download" @click="descargarPdf">
        <span class="btn-icon">⬇</span>
        <span>Descargar PDF</span>
      </button>
    </div>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div v-if="loading" class="loading">
      <div class="loader" />
      <span>Cargando datos de la flota…</span>
    </div>

    <div v-else class="grid">
      <!-- ================= RESUMEN PRINCIPAL ================= -->
      <section class="card card-summary">
        <h2>🚍 Resumen de la flota</h2>
        <div class="summary-grid" v-if="resumen">
          <div class="summary-item summary-item--main">
            <span class="label">Total de buses</span>
            <span class="value big">{{ resumen.totalBuses }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Operativos</span>
            <span class="value">{{ resumen.busesOperativos }}</span>
          </div>
          <div class="summary-item">
            <span class="label">En taller</span>
            <span class="value warn">{{ resumen.busesEnTaller }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Fuera de servicio</span>
            <span class="value danger">{{ resumen.busesFueraServicio }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Km promedio</span>
            <span class="value">
              {{
                resumen.kmPromedio !== null
                  ? resumen.kmPromedio.toFixed(0) + ' km'
                  : '—'
              }}
            </span>
          </div>
          <div class="summary-item">
            <span class="label">Km máximo</span>
            <span class="value">
              {{
                resumen.kmMaximo !== null
                  ? resumen.kmMaximo.toFixed(0) + ' km'
                  : '—'
              }}
            </span>
          </div>
          <div class="summary-item">
            <span class="label">Buses sin rev. técnica vigente</span>
            <span class="value danger">{{ resumen.busesSinRevisionVigente }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Buses sin extintor vigente</span>
            <span class="value danger">{{ resumen.busesSinExtintorVigente }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Mantenciones este mes</span>
            <span class="value">{{ resumen.mantUltimoMes }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Incidentes últimos 30 días</span>
            <span class="value warn">{{ resumen.incidentesUltimos30 }}</span>
          </div>
        </div>
        <div v-else class="empty">No hay datos para mostrar.</div>
      </section>

      <!-- BUSES POR ESTADO -->
      <section class="card">
        <h2>🚌 Buses por estado</h2>
        <table v-if="busesPorEstado.length" class="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th class="th-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in busesPorEstado" :key="b.estado">
              <td><span class="tag">{{ b.estado }}</span></td>
              <td class="td-right">{{ b.cantidad }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">No hay buses registrados.</div>
      </section>

      <!--  MANTENCIONES POR ESTADO -->
      <section class="card">
        <h2>🛠️ Mantenciones por estado</h2>
        <table v-if="mantPorEstado.length" class="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th class="th-right">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mantPorEstado" :key="m.estado">
              <td><span class="tag tag--blue">{{ m.estado }}</span></td>
              <td class="td-right">{{ m.cantidad }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">No hay mantenciones registradas.</div>
      </section>

      <!--  TOP BUSES CON INCIDENTES  -->
      <section class="card">
        <h2>⚠️ Top buses con más incidentes (30 días)</h2>
        <table v-if="topBusesIncidentes.length" class="table">
          <thead>
            <tr>
              <th>Bus</th>
              <th class="th-right">Incidentes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in topBusesIncidentes" :key="b.id_bus">
              <td>{{ b.patente }}</td>
              <td class="td-right">{{ b.cantidad }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          No hay incidentes registrados en los últimos 30 días.
        </div>
      </section>

      <!--  INCIDENTES RECIENTES  -->
      <section class="card wide">
        <h2>🚨 Incidentes recientes (últimos 30 días)</h2>
        <table v-if="incidentesRecientes.length" class="table table--compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Bus</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in incidentesRecientes" :key="i.id">
              <td>{{ fmtDate(i.fecha) }}</td>
              <td>{{ i.bus }}</td>
              <td>{{ i.tipo }}</td>
              <td><span class="pill">{{ i.estado }}</span></td>
              <td>
                {{ i.descripcion?.slice(0, 80) }}
                <span v-if="i.descripcion && i.descripcion.length > 80">…</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          No se registran incidentes en los últimos 30 días.
        </div>
      </section>

      <!--  ALERTAS ACTIVAS  -->
      <section class="card wide">
        <h2>🔔 Alertas activas</h2>
        <table v-if="alertasActivas.length" class="table table--compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Asociado a</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Título</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in alertasActivas" :key="a.id">
              <td>{{ fmtDate(a.fecha) }}</td>
              <td>{{ a.bus }}</td>
              <td>{{ a.tipo }}</td>
              <td>{{ a.estado }}</td>
              <td>
                <span :class="prioridadClass(a.prioridad)">
                  {{ a.prioridad || '—' }}
                </span>
              </td>
              <td>{{ a.titulo }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">No hay alertas activas.</div>
      </section>

      <!--  DOCUMENTOS POR VENCER  -->
      <section class="card wide">
        <h2>📄 Documentos por vencer (próximos 30 días)</h2>
        <table v-if="docsPorVencer.length" class="table table--compact">
          <thead>
            <tr>
              <th>Vencimiento</th>
              <th>Asociado a</th>
              <th>Tipo documento</th>
              <th>Estado</th>
              <th>Archivo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in docsPorVencer" :key="d.id">
              <td>{{ fmtDate(d.vence) }}</td>
              <td>{{ d.bus }}</td>
              <td>{{ d.tipo }}</td>
              <td>{{ d.estado }}</td>
              <td>{{ d.nombre_archivo }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          No hay documentos próximos a vencer.
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  padding: 1.5rem;
  background: #f1f5f9;
  min-height: 100vh;
}


.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.1rem 1.4rem;
  border-radius: 18px;
  background: radial-gradient(circle at top left, #0ea5e9 0, #1d4ed8 38%, #020617 100%);
  color: #e5f2ff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.55);
}
.header-text {
  max-width: 580px;
}
.overline {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  opacity: 0.8;
  margin-bottom: 0.2rem;
}
.header h1 {
  font-size: 1.5rem;
  margin: 0;
}
.subtitle {
  color: #cbd5f5;
  margin-top: 0.3rem;
  font-size: 0.9rem;
}

.btn-download {
  background: #22c55e;
  color: #0f172a;
  border: none;
  border-radius: 999px;
  padding: 0.8rem 1.6rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 10px 25px rgba(22, 163, 74, 0.4);
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  white-space: nowrap;
}
.btn-download:hover {
  background: #16a34a;
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(22, 163, 74, 0.5);
}
.btn-icon {
  font-size: 1.1rem;
}

.error {
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  border: 1px solid #fecaca;
}

.loading {
  padding: 1rem;
  text-align: center;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
}
.loader {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid #cbd5f5;
  border-top-color: #1d4ed8;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.card {
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
  padding: 1rem;
  position: relative;
  overflow: hidden;
}
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(148, 163, 184, 0.25);
  pointer-events: none;
}
.card-summary {
  grid-column: 1 / -1;
}
.card h2 {
  margin-bottom: 0.7rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #0f172a;
}

/* RESUMEN */
.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
}
.summary-item {
  flex: 1 1 170px;
  background: #f8fafc;
  border-radius: 10px;
  padding: 0.6rem 0.8rem;
  border: 1px solid #e2e8f0;
}
.summary-item--main {
  background: radial-gradient(circle at top left, #eff6ff 0, #dbeafe 45%, #eff6ff 100%);
  border-color: #bfdbfe;
}
.summary-item .label {
  font-size: 0.8rem;
  color: #6b7280;
}
.summary-item .value {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}
.summary-item .value.big {
  font-size: 1.4rem;
}
.summary-item .value.warn {
  color: #ca8a04;
}
.summary-item .value.danger {
  color: #b91c1c;
}

/* TABLAS */
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.table th,
.table td {
  border-top: 1px solid #e5e7eb;
  padding: 0.45rem 0.5rem;
}
.table th {
  background: #f3f4f6;
  text-align: left;
  color: #374151;
  font-weight: 600;
}
.table tbody tr:nth-child(even) {
  background: #f9fafb;
}
.table tbody tr:hover {
  background: #e5f0ff;
}
.table--compact th,
.table--compact td {
  padding: 0.35rem 0.45rem;
}

.th-right {
  text-align: right;
}
.td-right {
  text-align: right;
}

/* CHIPS / TAGS */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.5rem;
  border-radius: 999px;
  background: #e0f2fe;
  color: #075985;
  font-size: 0.78rem;
  font-weight: 600;
}
.tag--blue {
  background: #e0f2fe;
  color: #1d4ed8;
}

.pill {
  display: inline-flex;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 0.78rem;
  font-weight: 600;
  color: #374151;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  padding: 0.12rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}
.badge--high {
  background: #fee2e2;
  color: #b91c1c;
}
.badge--medium {
  background: #fef9c3;
  color: #92400e;
}
.badge--low {
  background: #dcfce7;
  color: #166534;
}

/* OTROS */
.empty {
  color: #6b7280;
  text-align: center;
  padding: 0.7rem;
  font-size: 0.85rem;
}

.wide {
  grid-column: 1 / -1;
}
</style>
