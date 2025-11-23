<script setup lang="ts">
import { ref, reactive, watchEffect, computed } from 'vue'
import { useToast } from 'vue-toastification'
import TallerForm from '../../components/TallerForm.vue'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type Row = {
  id_taller:number
  nombre:string
  contacto?:string|null
  direccion?:string|null
  email?:string|null
  id_tipo_taller:number
  tipo_taller?: { id_tipo_taller:number; nombre_tipo:string } | null
  _count?: { mecanicos:number; mantenimientos:number }
}

/**
 * 🔹 Importante:
 * - `id_tipo_taller` empieza en '' (string vacío) para que coincida con
 *   la opción "Todos los tipos" del select.
 */
const filtros = reactive({
  q: '',
  id_tipo_taller: '' as string, // ← arranca mostrando "Todos los tipos"
})

const tiposCat = (await $fetch<{tipos:{id_tipo_taller:number; nombre_tipo:string}[]}>(
  '/api/talleres/catalogos'
)).tipos

const items = ref<Row[]>([])
const loading = ref(false)
const err = ref('')

// --- paginación ---
const ROWS_PER_PAGE = 10
const page = ref(1)
const total = computed(() => items.value.length)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / ROWS_PER_PAGE))
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * ROWS_PER_PAGE
  const end   = start + ROWS_PER_PAGE
  return items.value.slice(start, end)
})

function goToPage(newPage:number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
}

// --- carga ---
async function load(){
  loading.value = true
  err.value = ''

  // Convertimos el filtro (string) a número SOLO si tiene valor
  let idTipoParam: number | undefined
  if (filtros.id_tipo_taller !== '') {
    const parsed = Number(filtros.id_tipo_taller)
    if (!Number.isNaN(parsed)) {
      idTipoParam = parsed
    }
  }

  try{
    const res = await $fetch<{items:Row[]}>('/api/talleres', {
      query:{
        q: filtros.q || undefined,
        id_tipo_taller: idTipoParam, // siempre number o undefined
      }
    })
    items.value = res.items

    if (page.value > totalPages.value) page.value = totalPages.value
    if (page.value < 1) page.value = 1
  }catch(e:any){
    const msg = e?.data?.message || 'Error cargando talleres'
    err.value = msg
    toast.error(msg)
  }finally{
    loading.value = false
  }
}

// Se recarga al cambiar filtros
watchEffect(load)

// --- modal crear / editar ---
const showForm = ref(false)
const editing = ref<Row|null>(null)

function openCreate(){
  editing.value = null
  showForm.value = true
}

function openEdit(r:Row){
  editing.value = { ...r }
  showForm.value = true
}

// --- modal de confirmación de borrado ---
const showDeleteConfirm = ref(false)
const deleteTarget = ref<Row | null>(null)

function askRemoveRow(r: Row) {
  deleteTarget.value = r
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id_taller
  try {
    await $fetch(`/api/talleres/${id}`, { method:'DELETE' } as any)
    toast.success('Taller eliminado correctamente.')
    showDeleteConfirm.value = false
    deleteTarget.value = null
    await load()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo eliminar el taller')
  }
}

// --- guardar ---
type SavePayload = {
  id_taller?: number
  nombre: string
  id_tipo_taller: number
  contacto?: string
  direccion?: string
  email?: string
}

async function save(data: SavePayload){
  try {
    if (data.id_taller){
      const { id_taller, ...body } = data
      await $fetch(`/api/talleres/${id_taller}`, {
        method:'PUT',
        body,
      } as any)
      toast.success('Taller actualizado correctamente.')
    } else {
      await $fetch('/api/talleres', {
        method:'POST',
        body: data,
      } as any)
      toast.success('Taller creado correctamente.')
    }
    showForm.value = false
    await load()
  } catch (e:any) {
    toast.error(e?.data?.message || 'No se pudo guardar el taller')
  }
}
</script>

<template>
  <div class="grid">
    <!-- Filtros -->
    <div class="card">
      <h3>Talleres</h3>
      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input
            class="input"
            v-model="filtros.q"
            placeholder="Nombre, contacto o email"
          />
        </div>
        <div>
          <label class="label">Tipo de taller</label>
          <!-- sin .number, usamos string y luego convertimos en load() -->
          <select class="select" v-model="filtros.id_tipo_taller">
            <option value="">Todos los tipos</option>
            <option
              v-for="t in tiposCat"
              :key="t.id_tipo_taller"
              :value="String(t.id_tipo_taller)"
            >
              {{ t.nombre_tipo }}
            </option>
          </select>
        </div>
        <div style="display:flex;align-items:end;justify-content:end">
          <button class="btn" @click="openCreate">+ Nuevo Taller</button>
        </div>
      </div>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <!-- LISTA DE TARJETAS -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando...</div>
      <div v-else-if="total === 0" class="list-empty">Sin resultados</div>

      <div v-else class="taller-list">
        <article
          v-for="r in pagedItems"
          :key="r.id_taller"
          class="taller-card"
        >
          <!-- Cabecera -->
          <header class="taller-card-header">
            <div class="taller-main-info">
              <div class="taller-icon">🛠️</div>
              <div>
                <div class="taller-name">{{ r.nombre }}</div>
                <div class="taller-type">
                  {{ r.tipo_taller?.nombre_tipo ?? 'Sin tipo' }}
                </div>
              </div>
            </div>

            <div class="taller-meta">
              <span class="taller-tag">ID #{{ r.id_taller }}</span>
            </div>
          </header>

          <!-- Métricas -->
          <section class="taller-card-body">
            <div class="taller-metric">
              <span class="metric-label">Contacto</span>
              <span class="metric-value">
                {{ r.contacto || '—' }}
              </span>
            </div>
            <div class="taller-metric">
              <span class="metric-label">Email</span>
              <span class="metric-value">
                {{ r.email || '—' }}
              </span>
            </div>
            <div class="taller-metric">
              <span class="metric-label">Mecánicos / Mants.</span>
              <span class="metric-value">
                {{ r._count?.mecanicos ?? 0 }} / {{ r._count?.mantenimientos ?? 0 }}
              </span>
            </div>
          </section>

          <!-- Footer -->
          <footer class="taller-card-footer">
            <button class="btn-outline">
              Ver detalles
            </button>

            <div class="footer-actions">
              <button class="btn-outline" @click="openEdit(r)">Editar</button>
              <button
                class="btn-outline danger-outline"
                @click="askRemoveRow(r)"
              >
                Eliminar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- Paginación -->
      <div class="pager" v-if="totalPages > 1">
        <button
          class="pager-btn"
          :disabled="page === 1"
          @click="goToPage(page - 1)"
        >
          ◀ Anterior
        </button>
        <span class="pager-info">
          Página {{ page }} de {{ totalPages }}
        </span>
        <button
          class="pager-btn"
          :disabled="page === totalPages"
          @click="goToPage(page + 1)"
        >
          Siguiente ▶
        </button>
      </div>
    </div>

    <!-- Modal crear/editar -->
    <div v-if="showForm" class="backdrop">
      <div class="card" style="width:min(600px,92vw)">
        <h3 style="margin-top:0">
          {{ editing ? 'Editar taller' : 'Nuevo taller' }}
        </h3>
        <TallerForm
          :initial="editing ? {
            id_taller: editing.id_taller,
            nombre: editing.nombre,
            id_tipo_taller: editing.id_tipo_taller,
            contacto: editing.contacto ?? '',
            direccion: editing.direccion ?? '',
            email: editing.email ?? ''
          } : undefined"
          :tipos="tiposCat"
          @cancel="showForm = false"
          @save="save"
        />
      </div>
    </div>

    <!-- Modal confirmación eliminar -->
    <div v-if="showDeleteConfirm && deleteTarget" class="backdrop">
      <div class="card confirm-card">
        <h3 style="margin-top:0">Eliminar taller</h3>
        <p>
          ¿Seguro que quieres eliminar el taller<br>
          <strong>#{{ deleteTarget.id_taller }} — {{ deleteTarget.nombre }}</strong>?
        </p>
        <div class="confirm-actions">
          <button class="btn ghost" type="button" @click="cancelDelete">
            Cancelar
          </button>
          <button class="btn danger" type="button" @click="confirmDelete">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 1rem;
}

.card {
  background:#fff;
  border-radius:12px;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  padding:1rem;
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

.input,
.select {
  width:100%;
  border:1px solid #e5e7eb;
  border-radius:10px;
  padding:.55rem .75rem;
}

.input:focus,
.select:focus {
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

.btn.danger {
  background:#dc2626;
}

.btn.danger:hover {
  background:#b91c1c;
}

.btn.ghost {
  background:#f3f4f6;
  color:#111827;
}

.btn.ghost:hover {
  background:#e5e7eb;
}

.error{
  color:#dc2626;
}

/* LISTA / TARJETAS */
.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

.taller-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.taller-card {
  border-radius:16px;
  border:1px solid #e5e7eb;
  padding:1rem 1.25rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.taller-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.taller-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.taller-icon {
  width:50px;
  height:50px;
  background:#eef2ff;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}

.taller-name {
  font-size:1.2rem;
  font-weight:700;
}

.taller-type {
  color:#6b7280;
  font-size:.85rem;
}

.taller-meta {
  display:flex;
  align-items:center;
}

.taller-tag {
  font-size:.75rem;
  padding:.15rem .5rem;
  border-radius:999px;
  background:#f3f4f6;
  color:#4b5563;
}

/* Métricas */
.taller-card-body {
  margin-top:1rem;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:.8rem;
}

.taller-metric {
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
.taller-card-footer {
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

.pager-info {
  color:#4b5563;
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
  width:min(420px,90vw);
}

.confirm-actions {
  display:flex;
  justify-content:flex-end;
  gap:.5rem;
  margin-top:1rem;
}

@media (max-width:768px) {
  .filters {
    grid-template-columns:1fr;
  }
  .taller-card-body {
    grid-template-columns:1fr;
  }
  .taller-card-footer {
    flex-direction:column;
    gap:.6rem;
  }
}
</style>
