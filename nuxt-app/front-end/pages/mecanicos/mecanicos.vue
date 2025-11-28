<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import MecanicoForm from '~/components/MecanicoForm.vue'

definePageMeta({ layout: 'panel' })

type Taller = { id_taller:number; nombre:string }
type Row = {
  id_mecanico:number
  id_taller:number
  nombre:string
  apellido:string
  taller?: Taller | null
}

const ROWS_PER_PAGE = 10
const page = ref(1)

const filtros = reactive<{ q:string; id_taller:number|'' }>({ q:'', id_taller:'' })
const talleres = ref<Taller[]>([])
const items = ref<Row[]>([])
const loading = ref(false)
const err = ref('')

// cargar talleres una vez
async function loadTalleres() {
  try {
    const res = await $fetch<{ items:Taller[] }>('/api/talleres')
    talleres.value = res.items.map(t => ({ id_taller:t.id_taller, nombre:t.nombre }))
  } catch (e:any) {
    console.error(e)
    err.value = e?.data?.message || 'Error cargando talleres'
  }
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    const res = await $fetch<{items:Row[]}>('/api/mecanicos', {
      query: {
        q: filtros.q || undefined,
        id_taller: filtros.id_taller || undefined,
      },
    })

    items.value = res.items

    // Ajustar página si quedó fuera de rango
    if (page.value > totalPages.value) page.value = totalPages.value
    if (page.value < 1) page.value = 1
  } catch (e:any) {
    err.value = e?.data?.message || 'Error cargando mecánicos'
  } finally {
    loading.value = false
  }
}

let t: any
watch(
  () => ({...filtros}),
  () => {
    page.value = 1
    clearTimeout(t)
    t = setTimeout(load, 250)
  },
  { deep:true }
)

onMounted(async () => {
  await loadTalleres()
  await load()
})

const orderedItems = computed(() =>
  [...items.value].sort((a, b) => a.id_mecanico - b.id_mecanico)
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(orderedItems.value.length / ROWS_PER_PAGE))
)

const pagedItems = computed(() => {
  const start = (page.value - 1) * ROWS_PER_PAGE
  const end   = start + ROWS_PER_PAGE
  return orderedItems.value.slice(start, end)
})

function goToPage(newPage:number) {
  if (newPage < 1 || newPage > totalPages.value) return
  page.value = newPage
}

// Form
const showForm = ref(false)
const editing = ref<Row|null>(null)

function openCreate(){ editing.value = null; showForm.value = true }
function openEdit(r:Row){ editing.value = { ...r }; showForm.value = true }

// Modal de confirmación 
const showConfirm = ref(false)
const confirmMessage = ref('')
let confirmCallback: (() => Promise<void> | void) | null = null

function openConfirm(message:string, cb: () => Promise<void> | void) {
  confirmMessage.value = message
  confirmCallback = cb
  showConfirm.value = true
}

async function confirmOk() {
  if (confirmCallback) {
    const cb = confirmCallback
    confirmCallback = null
    showConfirm.value = false
    await cb()
  } else {
    showConfirm.value = false
  }
}

function confirmCancel() {
  confirmCallback = null
  showConfirm.value = false
}

// eliminar con modal
async function removeRow(id:number){
  openConfirm(
    `¿Eliminar mecánico #${id}? Esta acción es irreversible.`,
    async () => {
      try {
        await $fetch(`/api/mecanicos/${id}`, { method:'DELETE' } as any)
        await load()
      } catch (e:any) {
        err.value = e?.data?.message || 'No se pudo eliminar'
      }
    }
  )
}

async function save(data:{ id_mecanico?:number; id_taller:number; nombre:string; apellido:string }){
  try {
    if (data.id_mecanico){
      const { id_mecanico, ...body } = data
      await $fetch(`/api/mecanicos/${id_mecanico}`, { method:'PUT', body } as any)
    } else {
      await $fetch('/api/mecanicos', { method:'POST', body:data } as any)
    }
    showForm.value = false
    await load()
  } catch (e:any) {
    err.value = e?.data?.message || 'No se pudo guardar'
  }
}
</script>

<template>
  <div class="grid">
    <!-- Filtros -->
    <div class="card">
      <h3>Mecánicos</h3>
      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input
            class="input"
            v-model="filtros.q"
            placeholder="Nombre, apellido o taller"
          />
        </div>
        <div>
          <label class="label">Taller</label>
          <select class="select" v-model.number="filtros.id_taller">
            <option :value="''">Todos los talleres</option>
            <option v-for="t in talleres" :key="t.id_taller" :value="t.id_taller">
              {{ t.nombre }}
            </option>
          </select>
        </div>
        <div style="display:flex;align-items:end;justify-content:end">
          <button class="btn" @click="openCreate">+ Nuevo Mecánico</button>
        </div>
      </div>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <!-- LISTA DE TARJETAS -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando...</div>
      <div v-else-if="!pagedItems.length" class="list-empty">Sin resultados</div>

      <div v-else class="mec-list">
        <article
          v-for="r in pagedItems"
          :key="r.id_mecanico"
          class="mec-card"
        >
          <!-- Cabecera -->
          <header class="mec-card-header">
            <div class="mec-main-info">
              <div class="mec-icon">👨‍🔧</div>
              <div>
                <div class="mec-name">
                  {{ r.nombre }} {{ r.apellido }}
                </div>
                <div class="mec-sub">
                  Taller: {{ r.taller?.nombre ?? 'Sin taller asignado' }}
                </div>
              </div>
            </div>
            <div class="mec-meta">
              <span class="mec-tag">ID #{{ r.id_mecanico }}</span>
            </div>
          </header>

          <!-- (Opcional) bloque extra para métricas futuras -->
          <!--
          <section class="mec-card-body">
            <div class="mec-metric">
              <span class="metric-label">Algo</span>
              <span class="metric-value">Valor</span>
            </div>
          </section>
          -->

          <!-- Footer -->
          <footer class="mec-card-footer">
            <button class="btn-outline">
              Ver detalles
            </button>

            <div class="footer-actions">
              <button class="btn-outline" @click="openEdit(r)">Editar</button>
              <button class="btn-outline danger-outline" @click="removeRow(r.id_mecanico)">
                Eliminar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- Paginador -->
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

    <!-- Modal formulario -->
    <div v-if="showForm" class="backdrop">
      <div class="card modal">
        <h3 style="margin-top:0">
          {{ editing ? 'Editar mecánico' : 'Nuevo mecánico' }}
        </h3>
        <MecanicoForm
          :initial="editing ? {
            id_mecanico:editing.id_mecanico,
            id_taller:editing.id_taller,
            nombre:editing.nombre,
            apellido:editing.apellido
          } : undefined"
          :talleres="talleres"
          @cancel="showForm=false"
          @save="save"
        />
      </div>
    </div>

    <!-- Modal de confirmación -->
    <div v-if="showConfirm" class="backdrop">
      <div class="confirm-card">
        <h3 class="confirm-title">Confirmar Eliminación</h3>
        <p class="confirm-message">{{ confirmMessage }}</p>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" @click="confirmCancel">
            Cancelar
          </button>
          <button class="confirm-btn danger" @click="confirmOk">
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
  box-shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.06);
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
  padding:.5rem .75rem;
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
  cursor:pointer;
  font-weight:600;
}

.btn:hover {
  background:#1d4ed8;
}

.error {
  color:#dc2626;
}

.list-empty {
  padding:2rem;
  text-align:center;
  color:#6b7280;
}

.mec-list {
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.mec-card {
  border-radius:16px;
  border:1px solid #e5e7eb;
  padding:1rem 1.25rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.05);
}

.mec-card-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.mec-main-info {
  display:flex;
  align-items:center;
  gap:1rem;
}

.mec-icon {
  width:50px;
  height:50px;
  background:#eef2ff;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}

.mec-name {
  font-size:1.2rem;
  font-weight:700;
}

.mec-sub {
  color:#6b7280;
  font-size:.85rem;
}

.mec-meta {
  display:flex;
  align-items:center;
}

.mec-tag {
  font-size:.75rem;
  padding:.15rem .5rem;
  border-radius:999px;
  background:#f3f4f6;
  color:#4b5563;
}

.mec-card-footer {
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


.backdrop {
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.4);
  display:grid;
  place-items:center;
  z-index:50;
}

.modal {
  width:min(520px,92vw);
}

.confirm-card {
  background:#ffffff;
  border-radius:12px;
  padding:1.5rem 2rem;
  min-width:320px;
  max-width:480px;
  box-shadow:0 10px 25px rgba(0,0,0,.18);
  text-align:center;
}

.confirm-title {
  margin:0 0 .75rem;
  color:#b91c1c;
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
    grid-template-columns:1fr;
  }
  .mec-card-footer {
    flex-direction:column;
    gap:.6rem;
  }
}
</style>
