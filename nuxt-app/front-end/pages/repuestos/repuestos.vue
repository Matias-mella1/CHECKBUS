<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import RepuestoForm from '~/components/RepuestoForm.vue'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type CatalogoOpt = { id:number; nombre:string }

type Repuesto = {
  id: number
  nombre: string
  descripcion?: string
  costo: number
  id_estado_repuesto: number
  estado: string
  id_tipo_repuesto: number
  tipo: string
  id_proveedor: number
  proveedor: string
}

const ROWS_PER_PAGE = 10

const search = reactive({
  q: '',
  id_estado_repuesto: '' as number | '',
  id_tipo_repuesto: '' as number | '',
  id_proveedor: '' as number | '',
  costoMin: '' as number | '',
  costoMax: '' as number | '',
  page: 1
})

const items = ref<Repuesto[]>([])
const loading = ref(false)
const errorMsg = ref('')

const showForm = ref(false)
const editing = ref<Repuesto|null>(null)

const showConfirmModal = ref(false)
const toDelete = ref<Repuesto|null>(null)

let abortCtrl: AbortController | null = null
let debounceId: number | null = null

const catalogos = reactive<{
  estados: CatalogoOpt[]
  tipos: CatalogoOpt[]
  proveedores: CatalogoOpt[]
}>({ estados: [], tipos: [], proveedores: [] })

async function loadCatalogos() {
  try {
    const res:any = await $fetch('/api/repuestos/catalogos')
    catalogos.estados = res.estados
    catalogos.tipos = res.tipos
    catalogos.proveedores = res.proveedores
  } catch {
    toast.error('Error cargando catálogos.')
  }
}

function normalize(r:any): Repuesto {
  return {
    id: Number(r.id ?? r.id_repuesto),
    nombre: String(r.nombre),
    descripcion: r.descripcion ?? '',
    costo: Number(r.costo),
    id_estado_repuesto: Number(r.id_estado_repuesto),
    estado: String(r.estado),
    id_tipo_repuesto: Number(r.id_tipo_repuesto),
    tipo: String(r.tipo),
    id_proveedor: Number(r.id_proveedor),
    proveedor: String(r.proveedor),
  }
}

async function load() {
  if (abortCtrl) abortCtrl.abort()
  abortCtrl = new AbortController()

  loading.value = true
  errorMsg.value = ''

  try {
    const res:any = await $fetch('/api/repuestos', {
      query: {
        q: search.q || undefined,
        id_estado_repuesto: search.id_estado_repuesto || undefined,
        id_tipo_repuesto: search.id_tipo_repuesto || undefined,
        id_proveedor: search.id_proveedor || undefined,
        costoMin: search.costoMin || undefined,
        costoMax: search.costoMax || undefined,
        pageSize: 100,
        sortBy: 'id_repuesto',
        sortOrder: 'desc'
      },
      signal: abortCtrl.signal as any
    })

    items.value = Array.isArray(res.items)
      ? res.items.map(normalize)
      : []
  } catch (e:any) {
    if (e?.name !== 'AbortError')
      errorMsg.value = e?.data?.message || 'Error cargando repuestos'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCatalogos()
  await load()
})

watch(
  () => ({
    q: search.q,
    id_estado_repuesto: search.id_estado_repuesto,
    id_tipo_repuesto: search.id_tipo_repuesto,
    id_proveedor: search.id_proveedor,
    costoMin: search.costoMin,
    costoMax: search.costoMax
  }),
  () => {
    search.page = 1
    if (debounceId !== null) window.clearTimeout(debounceId)
    debounceId = window.setTimeout(load, 300)
  },
  { deep: true }
)

const paged = computed(() => {
  const total = items.value.length
  const pages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE))

  let page = search.page
  if (page < 1) page = 1
  if (page > pages) page = pages

  const start = (page - 1) * ROWS_PER_PAGE
  return { items: items.value.slice(start, start + ROWS_PER_PAGE), page, pages, total }
})

function goPrev() {
  if (paged.value.page > 1) search.page--
}
function goNext() {
  if (paged.value.page < paged.value.pages) search.page++
}

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(row:Repuesto) {
  editing.value = { ...row }
  showForm.value = true
}

function askDelete(row:Repuesto) {
  toDelete.value = row
  showConfirmModal.value = true
}

function cancelDelete() {
  toDelete.value = null
  showConfirmModal.value = false
}

async function removeOne() {
  if (!toDelete.value) return
  try {
    await $fetch(`/api/repuestos/${toDelete.value.id}`, { method:'DELETE' })
    toast.success('Repuesto eliminado correctamente.')
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo eliminar.')
  } finally {
    cancelDelete()
    load()
  }
}

async function handleSave(payload:any) {
  try {
    if (payload.id) {
      await $fetch(`/api/repuestos/${payload.id}`, {
        method: 'PUT',
        body: payload
      })
      toast.success('Repuesto actualizado.')
    } else {
      await $fetch('/api/repuestos', { method:'POST', body:payload })
      toast.success('Repuesto creado.')
    }

    showForm.value = false
    await load()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo guardar.')
  }
}

const fmtMoney = (n:number) =>
  new Intl.NumberFormat('es-CL', {
    style:'currency',
    currency:'CLP',
    maximumFractionDigits:0
  }).format(n)
</script>

<template>
  <div class="grid">

    <!-- Filtros -->
    <div class="card">
      <h3>Repuestos</h3>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" v-model="search.q" placeholder="Nombre, descripción, proveedor…" />
        </div>

        <div>
          <label class="label">Estado</label>
          <select class="select" v-model.number="search.id_estado_repuesto">
            <option value="">Todos</option>
            <option v-for="e in catalogos.estados" :key="e.id" :value="e.id">
              {{ e.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select class="select" v-model.number="search.id_tipo_repuesto">
            <option value="">Todos</option>
            <option v-for="t in catalogos.tipos" :key="t.id" :value="t.id">
              {{ t.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Proveedor</label>
          <select class="select" v-model.number="search.id_proveedor">
            <option value="">Todos</option>
            <option v-for="p in catalogos.proveedores" :key="p.id" :value="p.id">
              {{ p.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Costo mín.</label>
          <input class="input" type="number" v-model.number="search.costoMin">
        </div>

        <div>
          <label class="label">Costo máx.</label>
          <input class="input" type="number" v-model.number="search.costoMax">
        </div>

        <div class="filters-action">
          <button class="btn" @click="openCreate">+ Nuevo Repuesto</button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- Lista en tarjetas -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="paged.total === 0" class="list-empty">Sin resultados</div>

      <div v-else class="rep-list">
        <article class="rep-card" v-for="row in paged.items" :key="row.id">

          <!-- Cabecera -->
          <header class="rep-card-header">
            <div class="rep-main-info">
              <div class="rep-icon">🔧</div>

              <div>
                <div class="rep-name">{{ row.nombre }}</div>
                <div class="rep-sub">
                  {{ row.tipo }} • {{ row.proveedor }}
                </div>
              </div>
            </div>

            <div class="rep-header-right">
              <span class="rep-id-pill">#{{ row.id }}</span>
             
            </div>
          </header>

          <!-- Datos detallados -->
          <section class="rep-card-body">

            <div class="rep-metric">
              <span class="metric-label">Costo</span>
              <span class="metric-value">{{ fmtMoney(row.costo) }}</span>
            </div>

            <div class="rep-metric">
              <span class="metric-label">Estado</span>
              <span class="metric-value">{{ row.estado }}</span>
            </div>

            <div class="rep-metric">
              <span class="metric-label">Tipo</span>
              <span class="metric-value">{{ row.tipo }}</span>
            </div>

            <div class="rep-metric full">
              <span class="metric-label">Proveedor</span>
              <span class="metric-value">{{ row.proveedor }}</span>
            </div>

            <div class="rep-metric full">
              <span class="metric-label">Descripción</span>
              <span class="metric-value ellipsis">{{ row.descripcion || '—' }}</span>
            </div>

          </section>

          <!-- Footer -->
          <footer class="rep-card-footer">
            <button class="btn-outline" @click="openEdit(row)">Ver detalles</button>

            <div class="footer-actions">
              <button class="btn-outline" @click="openEdit(row)">Editar</button>
              <button class="btn-outline danger-outline" @click="askDelete(row)">Eliminar</button>
            </div>
          </footer>

        </article>
      </div>

      <!-- Paginación -->
      <div class="pager" v-if="paged.pages > 1">
        <button class="pager-btn" :disabled="paged.page <= 1" @click="goPrev">◀ Anterior</button>
        <span class="pager-info">Página {{ paged.page }} de {{ paged.pages }}</span>
        <button class="pager-btn" :disabled="paged.page >= paged.pages" @click="goNext">Siguiente ▶</button>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="showForm" class="backdrop">
      <div class="card modal">
        <h3>{{ editing ? 'Editar Repuesto' : 'Nuevo Repuesto' }}</h3>

        <RepuestoForm
          :initial="editing || {}"
          :estados="catalogos.estados"
          :tipos="catalogos.tipos"
          :proveedores="catalogos.proveedores"
          @cancel="showForm=false"
          @save="handleSave"
        />
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div v-if="showConfirmModal" class="backdrop">
      <div class="confirm-card">
        <h3 class="confirm-title">Confirmar Eliminación</h3>
        <p v-if="toDelete" class="confirm-message">
          ¿Eliminar repuesto <strong>#{{ toDelete.id }}</strong> — <strong>{{ toDelete.nombre }}</strong>?
        </p>

        <div class="confirm-actions">
          <button class="confirm-btn cancel" @click="cancelDelete">Cancelar</button>
          <button class="confirm-btn danger" @click="removeOne">Eliminar</button>
        </div>
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
  padding:1rem;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
}


.filters {
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:1rem;
  align-items:end;
}
.filters-action {
  grid-column:-2 / -1;
  display:flex;
  justify-content:flex-end;
}
.label {
  font-size:.85rem;
  font-weight:600;
  margin-bottom:.35rem;
  color:#4b5563;
}
.input,
.select {
  width:100%;
  padding:.5rem .75rem;
  border-radius:10px;
  border:1px solid #e5e7eb;
}
.input:focus,
.select:focus {
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,.25);
}
.btn {
  background:#2563eb;
  color:white;
  border:none;
  border-radius:10px;
  padding:.55rem .9rem;
  cursor:pointer;
  font-weight:600;
}
.btn:hover { background:#1d4ed8; }

.error {
  color:#dc2626;
  margin-top:.75rem;
}

.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

.rep-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.rep-card {
  border-radius:20px;
  border:1px solid #e5e7eb;
  padding:1.3rem 1.6rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

/* Header */
.rep-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:.75rem;
}

.rep-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.rep-icon {
  width:55px;
  height:55px;
  background:#eef2ff;
  border-radius:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.7rem;
}

.rep-name {
  font-size:1.25rem;
  font-weight:700;
}

.rep-sub {
  color:#4b5563;
  font-size:.9rem;
}

.rep-header-right {
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:.35rem;
}

.rep-id-pill {
  border-radius:999px;
  padding:.2rem .6rem;
  font-size:.75rem;
  font-weight:600;
  border:1px solid #d1d5db;
  background:#f9fafb;
  color:#4b5563;
}

.rep-tag {
  background:#f3f4f6;
  padding:.3rem .7rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
}

.rep-card-body {
  margin-top:1.4rem;
  background:#ffffffa1;
  border-radius:15px;
  padding:1.3rem 1.4rem;

  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  column-gap:1.6rem; 
  row-gap:1.5rem;    
}

.rep-metric {
  background:#f9fafb;
  border-radius:12px;
  padding:1rem; 
}

.rep-metric.full {
  grid-column:1 / -1;
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

.ellipsis {
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}


.rep-card-footer {
  margin-top:1rem;
  padding-top:.75rem;
  border-top:1px solid #e5e7eb;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:.6rem;
}

.btn-outline {
  border:1px solid #d1d5db;
  background:white;
  padding:.5rem .9rem;
  border-radius:10px;
  font-weight:600;
  cursor:pointer;
}

.btn-outline:hover {
  background:#e8edff;
  border-color:#2563eb;
}

.danger-outline {
  background:#fef2f2;
  color:#b91c1c;
}

.danger-outline:hover {
  background:#fee2e2;
  border-color:#ef4444;
}

.footer-actions {
  display:flex;
  gap:.6rem;
}

.pager {
  margin-top:.75rem;
  display:flex;
  justify-content:center;
  gap:.75rem;
  font-size:.85rem;
}
.pager-btn {
  padding:.25rem .7rem;
  border-radius:999px;
  border:1px solid #d1d5db;
  background:#f9fafb;
  cursor:pointer;
}
.pager-btn:disabled {
  opacity:.5;
  cursor:default;
}
.pager-info { color:#4b5563; }

.backdrop {
  position:fixed;
  inset:0;
  display:grid;
  place-items:center;
  background:rgba(0,0,0,.35);
  z-index:50;
}

.modal {
  width:min(750px, 92vw);
}

/* Modal confirm */
.confirm-card {
  background:#ffffff;
  border-radius:12px;
  padding:1.5rem 2rem;
  min-width:320px;
  max-width:420px;
  box-shadow:0 10px 25px rgba(0,0,0,.18);
  text-align:center;
}
.confirm-title {
  margin:0 0 .75rem;
  color:#dc2626;
  font-weight:700;
  font-size:1.1rem;
}
.confirm-message {
  margin:0 0 1.5rem;
  color:#111827;
}
.confirm-actions {
  display:flex;
  justify-content:center;
  gap:.75rem;
}
.confirm-btn {
  border:none;
  border-radius:999px;
  padding:.4rem 1.3rem;
  font-weight:600;
  font-size:.9rem;
  cursor:pointer;
}
.confirm-btn.cancel {
  background:#6b7280;
  color:#ffffff;
}
.confirm-btn.danger {
  background:#ef4444;
  color:#ffffff;
}

@media (max-width:768px) {
  .filters {
    grid-template-columns:1fr 1fr;
  }
  .filters-action {
    grid-column:1 / -1;
  }
  .rep-card-body {
    grid-template-columns:1fr;
    row-gap:1.2rem;
  }
  .rep-card-footer {
    flex-direction:column;
    gap:.6rem;
  }
  .rep-header-right {
    align-items:flex-start;
  }
}
</style>
