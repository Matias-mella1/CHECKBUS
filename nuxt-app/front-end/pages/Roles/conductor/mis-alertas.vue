<!-- pages/mis-alertas.vue -->
<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })

const toast = useToast()

/*Auth*/
const { user } = useAuth()
const currentUserId = computed<number | null>(() =>
  (user.value?.id_usuario ?? user.value?.id ?? null) as number | null
)

/* Tipos */
type PickOpt = { id:number; nombre:string; categoria?:string | null }

type AlertaRow = {
  id_alerta:number
  titulo:string
  descripcion?:string|null
  prioridad?:string|null
  fecha_creacion:string
  estado?: {
    id_estado_alerta:number
    nombre_estado:string
  } | null
  tipo?: {
    id_tipo_alerta:number
    nombre_tipo:string
    categoria?:string | null
  } | null
  bus?: {
    id_bus:number
    patente?:string | null
  } | null
  usuario?: {
    id_usuario:number
    nombre?:string | null
    email?:string | null
    rut?:string | null
  } | null
  documento?: {
    id_documento:number
    nombre_archivo:string
  } | null
  incidente?: {
    id_incidente:number
  } | null
  mantenimiento?: {
    id_mantenimiento:number
  } | null
}

/* Estado principal */
const loading = ref(false)
const errorMsg = ref('')

const catalogo = reactive<{
  estados:PickOpt[]
  tipos:PickOpt[]
}>({
  estados: [],
  tipos: [],
})

const items = ref<AlertaRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const search = reactive({
  q: '',
  id_estado_alerta: '' as number | '',
  id_tipo_alerta: '' as number | '',
})

/* Paginación */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
)
const showPager = computed(() => total.value > pageSize.value)


function estadoClass(nombre?: string | null) {
  const s = (nombre || '').toUpperCase()
  if (s === 'ACTIVA')   return 'badge badge-blue'
  if (s === 'ATENDIDA') return 'badge badge-yellow'
  if (s === 'CERRADA')  return 'badge badge-green'
  return 'badge badge-gray'
}

function prioridadClass(p?: string | null) {
  const s = (p || '').toLowerCase()
  if (s.includes('alta'))  return 'badge badge-red'
  if (s.includes('media')) return 'badge badge-yellow'
  if (s.includes('baja'))  return 'badge badge-gray'
  return 'badge badge-gray'
}

/*  Catálogos */
async function loadCatalogos() {
  try {
    const res = await $fetch<{
      estados: { id:number; nombre:string }[]
      tipos: { id:number; nombre:string; categoria?:string | null }[]
    }>('/api/alertas/catalogos', {
      headers: { 'Cache-Control': 'no-store' },
    })

    catalogo.estados = (res?.estados || []).map(e => ({
      id: Number(e.id),
      nombre: String(e.nombre),
    }))

    catalogo.tipos = (res?.tipos || []).map(t => ({
      id: Number(t.id),
      nombre: String(t.nombre),
      categoria: t.categoria ?? null,
    }))
  } catch (e:any) {
    errorMsg.value = e?.data?.message || e?.message || 'Error cargando catálogos'
    toast.error(errorMsg.value)
  }
}

/* Esperar auth lista */
async function waitAuthReady(timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!currentUserId.value && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50))
  }
}

/* Cargar lista (solo lectura) */
async function load() {
  if (!currentUserId.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<{
      items:AlertaRow[]
      total:number
      page:number
      pageSize:number
    }>('/api/conductor/alertas', {
      query: {
        q: search.q || undefined,
        id_estado_alerta: search.id_estado_alerta || undefined,
        id_tipo_alerta: search.id_tipo_alerta || undefined,
        page: page.value,
        pageSize: pageSize.value,
        id_usuario: currentUserId.value || undefined,
      },
      headers: { 'Cache-Control': 'no-store' },
    })

    items.value = res.items || []
    total.value = res.total || 0
  } catch (e:any) {
    errorMsg.value = e?.data?.message || e?.message || 'Error cargando alertas'
    toast.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}

/* Debounce para búsqueda / filtros */
let filterTimer:any = null
watch(
  () => ({ ...search, pageSize: pageSize.value }),
  () => {
    clearTimeout(filterTimer)
    filterTimer = setTimeout(() => {
      page.value = 1
      load()
    }, 300)
  },
  { deep: true }
)
 
function prevPage() {
  if (page.value <= 1) return
  page.value--
  load()
}
function nextPage() {
  if (page.value >= totalPages.value) return
  page.value++
  load()
}


watch(() => user.value?.id_usuario ?? user.value?.id, async () => {
  await load()
})

onMounted(async () => {
  await waitAuthReady()
  await loadCatalogos()
  await load()
})
</script>

<template>
  <div class="grid">

    <!-- HEADER -->
    <div class="card">
      <h3 class="title">Mis alertas</h3>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" v-model="search.q" placeholder="Título o descripción…" />
        </div>

        <div>
          <label class="label">Estado</label>
          <select class="input" v-model.number="search.id_estado_alerta">
            <option :value="''">Todos</option>
            <option v-for="e in catalogo.estados" :key="e.id" :value="e.id">
              {{ e.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select class="input" v-model.number="search.id_tipo_alerta">
            <option :value="''">Todos</option>
            <option v-for="t in catalogo.tipos" :key="t.id" :value="t.id">
              {{ t.nombre }} <span v-if="t.categoria">— {{ t.categoria }}</span>
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tamaño página</label>
          <select class="input" v-model.number="pageSize">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>

        <!-- hueco para mantener el grid alineado -->
        <div></div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA EN CARDS (solo lectura) -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="items.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="alert-list">
        <article v-for="row in items" :key="row.id_alerta" class="alert-card">

          <!-- HEADER CARD -->
          <header class="alert-header">
            <div class="alert-main">
              <div class="alert-icon">⚠️</div>
              <div>
                <div class="alert-title">{{ row.titulo }}</div>
                <div class="alert-sub">
                  {{ row.tipo?.nombre_tipo || 'Sin tipo' }}
                  <span v-if="row.tipo?.categoria"> · {{ row.tipo.categoria }}</span>
                </div>
              </div>
            </div>

            <div class="alert-meta">
              <span :class="estadoClass(row.estado?.nombre_estado)">
                {{ row.estado?.nombre_estado || '—' }}
              </span>
              <span :class="prioridadClass(row.prioridad)" class="badge-prio">
                {{ row.prioridad || 'Sin prioridad' }}
              </span>
              <span class="alert-date">
                {{ new Date(row.fecha_creacion).toLocaleDateString() }}
              </span>
            </div>
          </header>

          <!-- BODY CARD -->
          <section class="alert-body">

            <!-- DESCRIPCIÓN -->
            <div class="alert-line full">
              <span class="field-label">Descripción</span>
              <p class="field-text">{{ row.descripcion || '—' }}</p>
            </div>

            <!-- CAMPOS DINÁMICOS -->
            <div class="alert-grid">

              <!-- BUS -->
              <div v-if="row.bus">
                <span class="field-label">Bus</span>
                <p class="field-text">
                  {{ row.bus.patente || row.bus.id_bus }}
                </p>
              </div>

              <!-- DOCUMENTO -->
              <div v-if="row.documento">
                <span class="field-label">Documento</span>
                <p class="field-text">
                  #{{ row.documento.id_documento }} · {{ row.documento.nombre_archivo }}
                </p>
              </div>

              <!-- INCIDENTE -->
              <div v-if="row.incidente">
                <span class="field-label">Incidente</span>
                <p class="field-text">#{{ row.incidente.id_incidente }}</p>
              </div>

              <!-- MANTENCIÓN -->
              <div v-if="row.mantenimiento">
                <span class="field-label">Mantención</span>
                <p class="field-text">#{{ row.mantenimiento.id_mantenimiento }}</p>
              </div>

            </div>
          </section>

          <!-- FOOTER SOLO LECTURA -->
          <footer class="alert-footer">
            <span class="id-pill">#{{ row.id_alerta }}</span>
          </footer>

        </article>
      </div>

      <!-- PAGINACIÓN -->
      <div class="pager" v-if="showPager">
        <button class="pager-btn" @click="prevPage" :disabled="page <= 1">
          ◀ Anterior
        </button>
        <span class="pager-info">Página {{ page }} de {{ totalPages }}</span>
        <button class="pager-btn" @click="nextPage" :disabled="page >= totalPages">
          Siguiente ▶
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.grid{
  display:grid;
  gap:1rem;
}

.card{
  background:#fff;
  border-radius:12px;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  padding:1rem;
}
.title{
  font-size:1.25rem;
  font-weight:700;
  margin-bottom:.75rem;
}


.filters{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:1rem;
  align-items:end;
}
.label{
  font-size:.85rem;
  font-weight:600;
  color:#4b5563;
  margin-bottom:.35rem;
}
.input,.select{
  width:100%;
  border:1px solid #e5e7eb;
  border-radius:10px;
  padding:.5rem .75rem;
}
.input:focus,.select:focus{
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,.25);
}

.error{color:#dc2626;margin-top:.5rem}


.list-empty{
  padding:2rem;
  text-align:center;
  color:#6b7280;
}
.alert-list{
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.alert-card{
  border-radius:20px;
  border:1px solid #e5e7eb;
  padding:1.25rem 1.4rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.alert-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}
.alert-main{
  display:flex;
  align-items:center;
  gap:1rem;
}
.alert-icon{
  width:48px;
  height:48px;
  border-radius:14px;
  background:#eef2ff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}
.alert-title{
  font-size:1.05rem;
  font-weight:700;
}
.alert-sub{
  font-size:.85rem;
  color:#4b5563;
  margin-top:.1rem;
}
.alert-meta{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:.25rem;
}
.alert-date{
  font-size:.8rem;
  color:#4b5563;
}

.alert-body{
  margin-top:1rem;
  background:#ffffffd9;
  border-radius:16px;
  padding:1rem 1.2rem;
  display:flex;
  flex-direction:column;
  gap:1rem;
}
.alert-line.full{
  width:100%;
}
.alert-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:1rem 1.5rem;
}
.field-label{
  font-size:.7rem;
  text-transform:uppercase;
  color:#9ca3af;
}
.field-text{
  font-size:.9rem;
  font-weight:500;
  margin-top:.15rem;
}


.alert-footer{
  margin-top:.9rem;
  padding-top:.75rem;
  border-top:1px solid #bfdbfe;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:.75rem;
}
.id-pill{
  border-radius:999px;
  padding:.2rem .6rem;
  font-size:.75rem;
  font-weight:600;
  border:1px solid #bfdbfe;
  background:#eff6ff;
  color:#1e3a8a;
}

.badge{
  display:inline-block;
  padding:.2rem .55rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
}
.badge-blue{background:#dbeafe;color:#1d4ed8}
.badge-yellow{background:#fef9c3;color:#92400e}
.badge-green{background:#dcfce7;color:#166534}
.badge-red{background:#fee2e2;color:#991b1b}
.badge-gray{background:#e5e7eb;color:#374151}

.badge-prio{
  margin-top:.1rem;
}

.pager{
  margin-top:.75rem;
  display:flex;
  justify-content:center;
  align-items:center;
  gap:.75rem;
  font-size:.85rem;
}
.pager-btn{
  padding:.25rem .65rem;
  border-radius:999px;
  border:1px solid #d1d5db;
  background:#f9fafb;
  cursor:pointer;
}
.pager-btn:disabled{
  opacity:.5;
  cursor:default;
}
.pager-info{color:#4b5563}


@media (max-width:900px){
  .filters{
    grid-template-columns:repeat(2,1fr);
  }
}
@media (max-width:768px){
  .alert-card{
    padding:1rem;
  }
  .alert-header{
    flex-direction:column;
    align-items:flex-start;
  }
  .alert-meta{
    flex-direction:row;
    align-items:center;
    flex-wrap:wrap;
    gap:.35rem;
  }
  .alert-grid{
    grid-template-columns:1fr;
  }
}
</style>
