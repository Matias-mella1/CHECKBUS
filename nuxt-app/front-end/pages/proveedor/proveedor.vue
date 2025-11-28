<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import ProveedorForm from '~/components/ProveedorForm.vue'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type Proveedor = {
  id: number
  nombre: string
  direccion: string
  telefono: string
  email: string
}

type Paged<T> = {
  meta?: { page: number; pageSize: number; total: number; pages: number }
  items: T[]
}

// paginacion
const ROWS_PER_PAGE = 10

const search = reactive({
  q: '',
  page: 1,
  pageSize: ROWS_PER_PAGE,
})

const items = ref<Proveedor[]>([])
const meta = ref<Paged<Proveedor>['meta']>()
const loading = ref(false)
const errorMsg = ref('')

const showForm = ref(false)
const editing = ref<Proveedor | null>(null)

const showConfirmModal = ref(false)
const toDelete = ref<Proveedor | null>(null)

let debounceId: number | null = null

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await $fetch<Paged<Proveedor> | any>('/api/proveedores', {
      query: {
        q: search.q || undefined,
        page: search.page,
        pageSize: search.pageSize,
      },
      headers: { 'Cache-Control': 'no-store' },
    })

    const list = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : [])
    items.value = (list || []).map((r: any) => ({
      id: Number(r.id ?? r.id_proveedor ?? 0),
      nombre: String(r.nombre ?? ''),
      direccion: String(r.direccion ?? ''),
      telefono: String(r.telefono ?? ''),
      email: String(r.email ?? ''),
    }))

    meta.value = res?.meta || {
      page: search.page,
      pageSize: search.pageSize,
      total: items.value.length,
      pages: 1,
    }
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error cargando proveedores'
    errorMsg.value = msg
    toast.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => items.value)

watch(
  () => search.q,
  () => {
    search.page = 1
    if (debounceId) window.clearTimeout(debounceId)
    debounceId = window.setTimeout(load, 300)
  }
)

// Navegación de páginas
function canPrev() {
  return (meta.value?.page ?? 1) > 1
}
function canNext() {
  return (meta.value?.page ?? 1) < (meta.value?.pages ?? 1)
}
function goPrev() {
  if (!canPrev()) return
  search.page--
  load()
}
function goNext() {
  if (!canNext()) return
  search.page++
  load()
}

function openCreate() {
  editing.value = null
  showForm.value = true
}
function openEdit(row: Proveedor) {
  editing.value = { ...row }
  showForm.value = true
}

function askDelete(row: Proveedor) {
  toDelete.value = row
  showConfirmModal.value = true
}
function cancelDelete() {
  toDelete.value = null
  showConfirmModal.value = false
}

async function handleSave(payload: {
  id?: number
  nombre: string
  direccion?: string
  telefono?: string
  email?: string
}) {
  try {
    if (payload.id) {
      await $fetch(`/api/proveedores/${payload.id}`, {
        method: 'PUT',
        body: payload,
      } as any)
      toast.success('Proveedor actualizado correctamente.')
    } else {
      await $fetch('/api/proveedores', {
        method: 'POST',
        body: payload,
      } as any)
      toast.success('Proveedor creado correctamente.')
    }
    showForm.value = false
    await load()
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'No se pudo guardar el proveedor'
    toast.error(msg)
  }
}

async function removeOne() {
  if (!toDelete.value) return
  try {
    await $fetch(`/api/proveedores/${toDelete.value.id}`, {
      method: 'DELETE',
    } as any)
    toast.success('Proveedor eliminado correctamente.')
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'No se pudo eliminar el proveedor'
    toast.error(msg)
  } finally {
    cancelDelete()
    load()
  }
}
</script>

<template>
  <div class="grid">
    <!-- Filtros / Toolbar -->
    <div class="card">
      <h3>Proveedores</h3>
      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input
            class="input"
            v-model="search.q"
            placeholder="Nombre, email, teléfono, dirección…"
          />
        </div>

        <div class="toolbar-right">
          <button class="btn" @click="openCreate">+ Nuevo Proveedor</button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA EN TARJETAS -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando...</div>
      <div v-else-if="filtered.length === 0" class="list-empty">Sin resultados</div>

      <div v-else class="prov-list">
        <article
          v-for="row in filtered"
          :key="row.id"
          class="prov-card"
        >
          <!-- Cabecera -->
          <header class="prov-card-header">
            <div class="prov-main-info">
              <div class="prov-icon">🏢</div>
              <div>
                <div class="prov-name">{{ row.nombre }}</div>
                <div class="prov-sub">
                  {{ row.email || 'Sin email' }}
                </div>
              </div>
            </div>

            <div class="prov-meta">
              <span class="prov-tag">ID #{{ row.id }}</span>
            </div>
          </header>

          <!-- Métricas -->
          <section class="prov-card-body">
            <div class="prov-metric">
              <span class="metric-label">Teléfono</span>
              <span class="metric-value">
                {{ row.telefono || '—' }}
              </span>
            </div>
            <div class="prov-metric">
              <span class="metric-label">Dirección</span>
              <span class="metric-value ellipsis">
                {{ row.direccion || '—' }}
              </span>
            </div>
          </section>

          <!-- Footer -->
          <footer class="prov-card-footer">
            <button class="btn-outline">
              Ver detalles
            </button>

            <div class="footer-actions">
              <button class="btn-outline" @click="openEdit(row)">Editar</button>
              <button class="btn-outline danger-outline" @click="askDelete(row)">
                Eliminar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- Paginación -->
      <div
        v-if="meta && meta.pages && meta.pages > 1"
        class="pager"
      >
        <button
          class="pager-btn"
          :disabled="!canPrev()"
          @click="goPrev"
        >
          ◀ Anterior
        </button>
        <span class="pager-info">
          Página {{ meta.page }} de {{ meta.pages }}
        </span>
        <button
          class="pager-btn"
          :disabled="!canNext()"
          @click="goNext"
        >
          Siguiente ▶
        </button>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="showForm" class="backdrop">
      <div class="card modal">
        <h3 style="margin-top:0">
          {{ editing ? 'Editar proveedor' : 'Nuevo proveedor' }}
        </h3>

        <ProveedorForm
          :initial="editing || {}"
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
          ¿Eliminar proveedor
          <strong class="code">{{ toDelete.nombre }}</strong>?
        </p>
        <div class="confirm-actions">
          <button
            class="confirm-btn cancel"
            @click="cancelDelete"
          >
            Cancelar
          </button>
          <button class="confirm-btn danger" @click="removeOne">
            Eliminar
          </button>
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
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  padding:1rem;
}

.filters {
  display:grid;
  grid-template-columns:1fr auto;
  gap:1rem;
  align-items:end;
}
.toolbar-right {
  display:flex;
  gap:.5rem;
  justify-content:flex-end;
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
}

.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

.prov-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.prov-card {
  border-radius:16px;
  border:1px solid #e5e7eb;
  padding:1rem 1.25rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.prov-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.prov-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.prov-icon {
  width:50px;
  height:50px;
  background:#eef2ff;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}

.prov-name {
  font-size:1.2rem;
  font-weight:700;
}

.prov-sub {
  color:#6b7280;
  font-size:.85rem;
}

.prov-meta {
  display:flex;
  align-items:center;
}

.prov-tag {
  font-size:.75rem;
  padding:.15rem .5rem;
  border-radius:999px;
  background:#f3f4f6;
  color:#4b5563;
}

/* Métricas */
.prov-card-body {
  margin-top:1rem;
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:.8rem;
}

.prov-metric {
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

.ellipsis {
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* Footer */
.prov-card-footer {
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

.footer-actions {
  display:flex;
  gap:.5rem;
}

/* Paginación */
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
  width:min(680px, 92vw);
}
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

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Courier New", monospace;
}

@media (max-width:768px) {
  .filters {
    grid-template-columns:1fr;
  }
  .prov-card-body {
    grid-template-columns:1fr;
  }
  .prov-card-footer {
    flex-direction:column;
    gap:.6rem;
  }
}
</style>
