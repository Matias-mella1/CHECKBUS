<!-- pages/documentos.vue -->
<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import DocumentoForm from '~/components/DocumentoForm.vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })
const toast = useToast()

const { user } = useAuth()

const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})

const isAdmin = computed(() =>
  rolesUsuario.value.includes('ADMINISTRADOR') ||
  rolesUsuario.value.includes('ADMIN') ||
  rolesUsuario.value.includes('Administrador')
)

type DocRow = {
  id_documento: number
  nombre_archivo: string
  ruta: string
  fecha_caducidad?: string | null
  tamano?: number | null

  id_tipo_documento?: number | null
  id_estado_documento?: number | null

  id_bus?: number | null
  id_usuario?: number | null
  id_mantenimiento?: number | null
  id_incidente?: number | null

  tipo?: {
    nombre_tipo: string
    categoria: string | null
  }
  estado?: {
    nombre_estado: string
  }
}

type TipoOpt   = { id:number; nombre:string; categoria?:string }
type EstadoOpt = { id:number; nombre:string }
type SimpleOpt = { id:number; label:string }

type SavePayload = {
  id_documento?: number
  file?: File | null  
  nombre_archivo: string
  id_tipo_documento: number
  id_estado_documento: number
  fecha_caducidad?: string
  id_bus?: number | null
  id_usuario?: number | null
  id_mantenimiento?: number | null
  id_incidente?: number | null
}

const items     = ref<DocRow[]>([])
const loading   = ref(false)
const errorMsg  = ref('')

const catalogos = reactive<{
  tipos: TipoOpt[]
  estados: EstadoOpt[]
  buses: SimpleOpt[]
  usuarios: SimpleOpt[]
}>({
  tipos: [],
  estados: [],
  buses: [],
  usuarios: [],
})

const search          = ref('')
const filterTipo      = ref<number | ''>('')       // id tipo
const filterEstado    = ref<number | ''>('')       // id estado
const filterCategoria = ref<string | ''>('')       // texto categoría

const page     = ref(1)
const pageSize = ref(15)
const total    = ref(0)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value))
)
const displayTotalPages = computed(() => totalPages.value)
const showPager = computed(() => total.value > pageSize.value)

/* ===== Categorías y tipos ===== */
const categoriasSelect = computed(() => {
  const set = new Set<string>()
  for (const t of catalogos.tipos) {
    if (t.categoria) set.add(String(t.categoria))
  }
  return Array.from(set).sort()
})

const tiposFiltradosHeader = computed(() => {
  if (!filterCategoria.value) return catalogos.tipos
  return catalogos.tipos.filter(
    (t) => t.categoria === filterCategoria.value
  )
})

function normalizeDoc(r: any): DocRow {
  return {
    id_documento: Number(r.id_documento),
    nombre_archivo: String(r.nombre_archivo),
    ruta: String(r.ruta),
    fecha_caducidad: r.fecha_caducidad ?? null,
    tamano: r.tamano == null ? null : Number(r.tamano),

    id_tipo_documento:
      r.id_tipo_documento != null ? Number(r.id_tipo_documento) : null,
    id_estado_documento:
      r.id_estado_documento != null ? Number(r.id_estado_documento) : null,

    id_bus: r.id_bus != null ? Number(r.id_bus) : null,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    id_mantenimiento:
      r.id_mantenimiento != null ? Number(r.id_mantenimiento) : null,
    id_incidente:
      r.id_incidente != null ? Number(r.id_incidente) : null,

    tipo: r.tipo
      ? {
          nombre_tipo: String(r.tipo.nombre_tipo),
          categoria: r.tipo.categoria ?? null,
        }
      : undefined,
    estado: r.estado
      ? {
          nombre_estado: String(r.estado.nombre_estado),
        }
      : undefined,
  }
}

  //catalogos
async function loadCatalogos() {
  try {
    const res = await $fetch<any>('/api/documentos/catalogos', {
      headers: { 'Cache-Control': 'no-store' },
    })

    catalogos.tipos = (res.tipos || []).map((t: any): TipoOpt => ({
      id: Number(t.id_tipo_documento),
      nombre: String(t.nombre_tipo),
      categoria: t.categoria ? String(t.categoria) : '',
    }))

    catalogos.estados = (res.estados || []).map((e:any):EstadoOpt => ({
      id: Number(e.id_estado_documento),
      nombre: String(e.nombre_estado),
    }))

    catalogos.buses = (res.buses || []).map((b:any):SimpleOpt => ({
      id: Number(b.id),
      label: String(b.label),
    }))

    catalogos.usuarios = (res.usuarios || []).map((u:any):SimpleOpt => ({
      id: Number(u.id),
      label: String(u.label),
    }))
  } catch {
    toast.error('Error cargando catálogos.')
  }
}

async function load() {
  loading.value = true
  errorMsg.value = ''

  try {
    const res = await $fetch<{
      items: any[]
      total: number
      page: number
      pageSize: number
    }>('/api/documentos', {
      query: {
        q: search.value || undefined,
        id_tipo_documento: filterTipo.value || undefined,
        id_estado_documento: filterEstado.value || undefined,
        categoria: filterCategoria.value || undefined,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: 'fecha_creacion',
        sortOrder: 'desc',
      },
      headers: { 'Cache-Control': 'no-store' },
    })

    items.value = (res.items || []).map(normalizeDoc)
    total.value = res.total ?? 0
  } catch (e: any) {
    errorMsg.value = e?.message || 'Error cargando documentos'
    toast.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadCatalogos()
  await load()
})

watch([search, filterTipo, filterEstado, pageSize], () => {
  page.value = 1
  load()
})

watch(filterCategoria, () => {
  filterTipo.value = ''
  page.value = 1
  load()
})


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

//ver documento
async function verDoc(key: string, inline = true) {
  try {
    const { url } = await $fetch<{ url: string }>('/api/documentos/doc-url', {
      method: 'POST',
      body: { key, inline },
    })
    window.open(url, '_blank')
  } catch (e: any) {
    toast.error(e?.data?.message || 'No se pudo abrir el documento')
  }
}

//cargar s3
const saving   = ref(false)
const progress = ref(0)

async function createPresigned(f: File) {
  return await $fetch<{ uploadUrl: string; key: string }>(
    '/api/documentos/upload-url',
    {
      method: 'POST',
      body: { filename: f.name },
    }
  )
}

async function putWithProgress(url: string, f: File) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progress.value = Math.round((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('Error al subir a S3'))
    }
    xhr.onerror = () => reject(new Error('Error de red subiendo a S3'))
    xhr.send(f)
  })
}

const showForm = ref(false)
const editing  = ref<DocRow | null>(null)

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(d: DocRow) {
  if (!isAdmin.value) return
  editing.value = d
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
}

function toFormInitial(d: DocRow | null) {
  if (!d) return undefined
  return {
    id_documento: d.id_documento,
    nombre_archivo: d.nombre_archivo,
    id_tipo_documento: d.id_tipo_documento ?? undefined,
    id_estado_documento: d.id_estado_documento ?? undefined,
    fecha_caducidad: d.fecha_caducidad ?? undefined,
    ruta: d.ruta,
    tamano: d.tamano ?? undefined,
    id_bus: d.id_bus ?? undefined,
    id_usuario: d.id_usuario ?? undefined,
    id_mantenimiento: d.id_mantenimiento ?? undefined,
    id_incidente: d.id_incidente ?? undefined,
  }
}

// Guardar (crear / editar) 
async function handleSave(payload: SavePayload) {
  try {
    saving.value = true
    progress.value = 0

    //  MODO EDICIÓN 
    if (payload.id_documento) {
      const current = items.value.find(
        d => d.id_documento === payload.id_documento
      )

      let key = current?.ruta || ''
      let tamanoMb: number | null = current?.tamano ?? null

      // si viene archivo nuevo => subir a S3
      if (payload.file instanceof File) {
        const { uploadUrl, key: newKey } = await createPresigned(payload.file)
        await putWithProgress(uploadUrl, payload.file)
        key = newKey
        tamanoMb = Number((payload.file.size / 1024 / 1024).toFixed(2))
      }

      const body: any = {
        nombre_archivo: payload.nombre_archivo.trim(),
        id_tipo_documento: payload.id_tipo_documento,
        id_estado_documento: payload.id_estado_documento,
        fecha_caducidad: payload.fecha_caducidad || null,
        ruta: key,
        tamano: tamanoMb,
        id_bus: payload.id_bus ?? null,
        id_usuario: payload.id_usuario ?? null,
        id_mantenimiento: payload.id_mantenimiento ?? null,
        id_incidente: payload.id_incidente ?? null,
      }

      await $fetch(`/api/documentos/${payload.id_documento}`, {
        method: 'PUT',
        body,
      })

      toast.success(`Documento #${payload.id_documento} actualizado correctamente.`)
      closeForm()
      await load()
      return
    }

    // ===== MODO CREACIÓN =====
    if (!payload.file) {
      toast.error('No se recibió archivo para este documento.')
      return
    }

    const { uploadUrl, key } = await createPresigned(payload.file)
    await putWithProgress(uploadUrl, payload.file)

    const tamanoMb = Number((payload.file.size / 1024 / 1024).toFixed(2))

    const body: any = {
      nombre_archivo: payload.nombre_archivo.trim(),
      ruta: key,
      id_tipo_documento: payload.id_tipo_documento,
      id_estado_documento: payload.id_estado_documento,
      tamano: tamanoMb,
      fecha_caducidad: payload.fecha_caducidad || null,
      id_bus: payload.id_bus ?? null,
      id_usuario: payload.id_usuario ?? null,
      id_mantenimiento: payload.id_mantenimiento ?? null,
      id_incidente: payload.id_incidente ?? null,
    }

    const res = await $fetch<{ documento: { id_documento: number } }>(
      '/api/documentos',
      {
        method: 'POST',
        body,
      }
    )

    toast.success(`Documento creado (ID ${res.documento.id_documento})`)
    closeForm()
    page.value = 1
    await load()
  } catch (e: any) {
    toast.error(e?.data?.message || e?.message || 'Error guardando documento')
  } finally {
    saving.value = false
    progress.value = 0
  }
}

function fmtFecha(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString()
}

function fmtSizeMb(n?: number | null) {
  if (n == null) return '—'
  return `${n.toFixed(2)} MB`
}

const estadoKey = (d: DocRow) =>
  (d.estado?.nombre_estado ?? '').toUpperCase()

const estadoConfig: Record<string, { class: string; icon: string }> = {
  VIGENTE:      { class: 'badge badge-green', icon: '✅' },
  EXPIRADO:     { class: 'badge badge-red',   icon: '⚠️' },
  'POR VENCER': { class: 'badge badge-yellow',icon: '⏳' },
  ARCHIVADO:    { class: 'badge badge-gray',  icon: '📁' },
}

const badgeClass = (d: DocRow) =>
  estadoConfig[estadoKey(d)]?.class ?? 'badge'
const badgeIcon = (d: DocRow) =>
  estadoConfig[estadoKey(d)]?.icon ?? '📄'
</script>

<template>
  <div class="grid gap-4">
    <!-- HEADER -->
    <div class="card">
      <h2 class="title">Documentos</h2>

      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input class="input" v-model="search" placeholder="Nombre o ruta…" />
        </div>

        <div>
          <label class="label">Categoría</label>
          <select class="input" v-model="filterCategoria">
            <option value="">Todas</option>
            <option
              v-for="c in categoriasSelect"
              :key="c"
              :value="c"
            >
              {{ c }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Tipo</label>
          <select class="input" v-model.number="filterTipo">
            <option value="">Todos</option>
            <option
              v-for="t in tiposFiltradosHeader"
              :key="t.id"
              :value="t.id"
            >
              {{ t.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="label">Estado</label>
          <select class="input" v-model.number="filterEstado">
            <option value="">Todos</option>
            <option
              v-for="e in catalogos.estados"
              :key="e.id"
              :value="e.id"
            >
              {{ e.nombre }}
            </option>
          </select>
        </div>

        <div class="filters-actions">
          <button class="btn" @click="openCreate">
            + Nuevo Documento
          </button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <!-- LISTA -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="!items.length" class="list-empty muted">Sin documentos</div>

      <div v-else class="doc-list">
        <article
          v-for="d in items"
          :key="d.id_documento"
          class="doc-card"
        >
          <header class="doc-card-header">
            <div class="doc-main">
              <div class="doc-icon">📄</div>
              <div>
                <div class="doc-title">
                  {{ d.nombre_archivo }}
                </div>
                <div class="doc-subtitle">
                  #{{ d.id_documento }}
                  <span v-if="d.tipo"> · {{ d.tipo.nombre_tipo }}</span>
                </div>
                <div v-if="d.tipo?.categoria" class="pill pill-blue">
                  {{ d.tipo.categoria }}
                </div>
              </div>
            </div>

            <span :class="badgeClass(d)">
              <span class="badge-icon">{{ badgeIcon(d) }}</span>
              <span>{{ d.estado?.nombre_estado || 'Sin estado' }}</span>
            </span>
          </header>

          <section class="doc-card-body">
            <div class="doc-metric">
              <span class="metric-label">Caducidad</span>
              <span class="metric-value">{{ fmtFecha(d.fecha_caducidad) }}</span>
            </div>
            <div class="doc-metric">
              <span class="metric-label">Tamaño</span>
              <span class="metric-value">{{ fmtSizeMb(d.tamano) }}</span>
            </div>
            <div class="doc-metric doc-metric-wide">
              <span class="metric-label">Ruta</span>
              <span class="metric-value truncate">
                {{ d.ruta }}
              </span>
            </div>
          </section>

          <footer class="doc-card-footer">
            <div class="doc-footer-left" />

            <div class="doc-footer-actions">
              <button
                class="btn-outline"
                type="button"
                title="Ver"
                @click="verDoc(d.ruta, true)"
              >
                👁 Ver
              </button>
              <button
                class="btn-outline"
                type="button"
                title="Descargar"
                @click="verDoc(d.ruta, false)"
              >
                ⬇️ Descargar
              </button>

              <!-- SOLO ADMIN EDITA -->
              <button
                v-if="isAdmin"
                class="btn-outline"
                type="button"
                title="Editar documento"
                @click="openEdit(d)"
              >
                ✏️ Editar
              </button>
            </div>
          </footer>
        </article>
      </div>

      <!-- PAGINACIÓN -->
      <div class="pager" v-if="showPager">
        <button
          class="pager-btn"
          @click="prevPage"
          :disabled="page <= 1"
        >
          ◀ Anterior
        </button>

        <span class="pager-info">
          Página {{ page }} de {{ displayTotalPages }}
        </span>

        <button
          class="pager-btn"
          @click="nextPage"
          :disabled="page >= totalPages"
        >
          Siguiente ▶
        </button>
      </div>
    </div>

    <!-- MODAL -->
    <div v-if="showForm" class="backdrop">
      <div class="card modal">
        <DocumentoForm
          :tipos="catalogos.tipos"
          :estados="catalogos.estados"
          :buses="catalogos.buses"
          :usuarios="catalogos.usuarios"
          :mode="editing ? 'edit' : 'create'"
          :initial="toFormInitial(editing)"
          @cancel="closeForm"
          @save="handleSave"
        />

        <div v-if="saving" class="upload-progress">
          <div class="bar-outer">
            <div class="bar-inner" :style="{ width: progress + '%' }"></div>
          </div>
          <p class="hint">Subiendo archivo… {{ progress }}%</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:1rem}
.title{font-size:1.35rem;font-weight:700;margin-bottom:.75rem}

/* Filtros */
.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:1rem;align-items:end}
.filters-actions{display:flex;justify-content:flex-end;align-items:flex-end}
.label{font-size:.85rem;font-weight:600;margin-bottom:.25rem;color:#374151}
.input{border:1px solid #e5e7eb;padding:.5rem .75rem;border-radius:10px;width:100%}
.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25)}

/* Botones */
.btn{background:#2563eb;color:#fff;padding:.55rem .9rem;border-radius:10px;font-weight:600;cursor:pointer;border:none}
.btn:hover{background:#1d4ed8}
.btn-outline{border:1px solid #d1d5db;background:#f9fafb;padding:.45rem .9rem;border-radius:10px;font-weight:600;cursor:pointer}
.btn-outline:hover{border-color:#2563eb;background:#e8edff}

/* Lista tipo card */
.list-empty{padding:2rem;text-align:center}
.muted{color:#6b7280}

.doc-list{display:flex;flex-direction:column;gap:1rem}
.doc-card{border-radius:16px;border:1px solid #e5e7eb;padding:1rem 1.25rem;background:rgba(239,246,255,0.7);box-shadow:0 8px 20px rgba(0,0,0,.05);}
.doc-card-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;}
.doc-main{display:flex;align-items:center;gap:1rem;}
.doc-icon{width:46px;height:46px;background:#eef2ff;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;}
.doc-title{font-size:1.05rem;font-weight:700;}
.doc-subtitle{color:#6b7280;font-size:.85rem;margin-bottom:.2rem;}

.doc-card-body{margin-top:.75rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;}
.doc-metric{background:#f9fafb;border-radius:12px;padding:.7rem;}
.doc-metric-wide{grid-column:1/-1;}
.metric-label{font-size:.7rem;color:#9ca3af;text-transform:uppercase;}
.metric-value{font-size:.95rem;font-weight:600;word-break:break-word;}
.truncate{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

/* Footer card */
.doc-card-footer{margin-top:.85rem;padding-top:.75rem;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:.75rem;}
.doc-footer-actions{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:.25rem;padding:.2rem .55rem;border-radius:999px;font-size:.75rem;font-weight:600;}
.badge-icon{font-size:.8rem;}
.badge-green{background:#dcfce7;color:#166534;}
.badge-red{background:#fee2e2;color:#991b1b;}
.badge-yellow{background:#fef9c3;color:#92400e;}
.badge-gray{background:#e5e7eb;color:#374151;}

.pill{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:999px;font-size:.7rem;font-weight:600;text-transform:uppercase;margin-top:.15rem;}
.pill-blue{background:#e0f2fe;color:#0369a1;}
.pager{display:flex;justify-content:center;gap:.75rem;margin-top:.75rem;font-size:.85rem}
.pager-btn{padding:.25rem .65rem;border:1px solid #ccc;border-radius:999px;background:#f9fafb;cursor:pointer}
.pager-btn:disabled{opacity:.5;cursor:default}
.pager-info{color:#4b5563}

.backdrop{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4);z-index:50}
.modal{width:min(720px,92vw);max-height:90vh;overflow:auto}
.upload-progress{margin-top:.75rem}
.bar-outer{
  width:100%;
  height:6px;
  border-radius:999px;
  background:#e5e7eb;
  overflow:hidden;
}
.bar-inner{
  height:100%;
  border-radius:999px;
  background:#2563eb;
  transition:width .2s ease;
}
.hint{font-size:.8rem;color:#6b7280;margin-top:.25rem}
.error{color:#dc2626;margin-top:.5rem}

@media (max-width:1024px){
  .doc-card-body{grid-template-columns:1fr;}
}
@media (max-width:768px){
  .filters{grid-template-columns:1fr 1fr;grid-auto-rows:auto;}
  .doc-card-footer{flex-direction:column;align-items:flex-start;}
  .doc-footer-actions{width:100%;justify-content:space-between;}
}
@media (max-width:640px){
  .filters{grid-template-columns:1fr;}
}
</style>
