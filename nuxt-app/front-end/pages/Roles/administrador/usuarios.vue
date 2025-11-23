<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import UserForm from '~/components/UsuarioForm.vue'
import { useToast } from 'vue-toastification'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type EstadoNombre = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'PENDIENTE'

type UsuarioRow = {
  id: number
  rut?: string
  nombre: string
  apellido: string
  email: string
  username: string
  telefono: string
  licencia: string
  estado: EstadoNombre
  roles: string[]
  turnosCount?: number
  documentosCount?: number
  alertasCount?: number
  incidentesCount?: number
}

const q = ref('')
const estado = ref<'' | EstadoNombre>('')
const rol = ref('')

// PAGINACIÓN
const page = ref(1)
const pageSize = 10
const total = ref(0)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize))
)

// Roles
const rolesCatalogo = ref<string[]>([])
const BASE_ROLES = ['ADMINISTRADOR', 'PROPIETARIO', 'CONDUCTOR', 'SUPERVISOR']

const rows = ref<UsuarioRow[]>([])
const loading = ref(false)

// Modal + form
const showForm = ref(false)
const editing = ref<any | null>(null)
const formServerError = ref('')

// 🔔 Modal de confirmación propio (reemplaza confirm())
const showConfirm = ref(false)
const confirmMessage = ref('')
let confirmCallback: (() => Promise<void> | void) | null = null

function openConfirm(message: string, cb: () => Promise<void> | void) {
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

async function loadRoles() {
  try {
    const r = await $fetch<{ items: { id: number; nombre: string }[] }>('/api/roles')
    const fromApi = (r.items || []).map(x => x.nombre)
    rolesCatalogo.value = Array.from(new Set([...BASE_ROLES, ...fromApi]))
  } catch (e) {
    console.warn('No se pudo cargar roles, usando base:', e)
    rolesCatalogo.value = BASE_ROLES
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const query: any = {
      page: page.value,
      pageSize,
    }
    if (q.value) query.q = q.value
    if (estado.value) query.estado = estado.value
    if (rol.value) query.rol = rol.value

    const r = await $fetch<{
      items: UsuarioRow[]
      page: number
      pageSize: number
      total: number
      totalPages?: number
    }>('/api/usuarios', { query })

    rows.value = r.items
    total.value = r.total ?? r.items.length
    if (r.page) page.value = r.page
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = {
    nombre: '',
    apellido: '',
    email: '',
    username: '',
    telefono: '',
    licencia: '',
    roles: [],
  }
  formServerError.value = ''
  showForm.value = true
}

function openEdit(u: UsuarioRow) {
  editing.value = {
    id: u.id,
    rut: u.rut,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    username: u.username,
    telefono: u.telefono,
    licencia: u.licencia,
    roles: [...u.roles],
  }
  formServerError.value = ''
  showForm.value = true
}

// cancelar modal de formulario
function handleCancel() {
  showForm.value = false
  formServerError.value = ''
}

// -------------------- GUARDAR USUARIO (CON TOASTS) --------------------
async function saveUser(payload: {
  rut: string
  nombre: string
  apellido: string
  email: string
  username: string
  telefono?: string
  licencia?: string
  roles: string[]
}) {
  try {
    formServerError.value = ''
    const isEditing = !!editing.value?.id
    const action = isEditing ? 'actualizado' : 'creado'
    const name = `${payload.nombre} ${payload.apellido}`

    if (isEditing) {
      await $fetch(`/api/usuarios/${editing.value.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/usuarios', { method: 'POST', body: payload })
    }

    showForm.value = false
    editing.value = null
    page.value = 1
    await loadUsers()

    toast.success(`✅ Usuario ${name} ${action} correctamente.`, { timeout: 3000 })
  } catch (e: any) {
    formServerError.value = e?.data?.message || e?.message || 'Error al guardar usuario.'
    toast.error(
      `🛑 Error al guardar usuario:\n${formServerError.value}`,
      { timeout: 8000 }
    )
  }
}

// -------------------- ELIMINAR USUARIO (CON TOASTS + MODAL) --------------------
async function removeUser(id: number) {
  openConfirm(
    '⚠️ ¿Eliminar este usuario? Esta acción es irreversible.',
    async () => {
      try {
        await $fetch(`/api/usuarios/${id}`, { method: 'DELETE' } as any)
        await loadUsers()
        toast.success('🗑️ Usuario eliminado correctamente.', { timeout: 3000 })
      } catch (e: any) {
        const msg = e?.data?.message || e?.message || 'Error desconocido al eliminar.'
        toast.error(`🛑 Error al eliminar: ${msg}`, { timeout: 8000 })
      }
    }
  )
}

/**
 * Cambiar estado rápido usando el endpoint /api/usuarios/:id/estado (CON TOASTS + MODAL)
 */
async function cambiarEstado(u: UsuarioRow, nuevoEstado: EstadoNombre) {
  const msgMap: Partial<Record<EstadoNombre, string>> = {
    INACTIVO: `¿Marcar al usuario "${u.nombre} ${u.apellido}" como INACTIVO?`,
    SUSPENDIDO: `¿Suspender al usuario "${u.nombre} ${u.apellido}"?`,
  }

  const doChange = async () => {
    try {
      await $fetch(`/api/usuarios/${u.id}/estado`, {
        method: 'PUT',
        body: { estado: nuevoEstado },
      })

      await loadUsers()
      toast.success(`✅ Estado de ${u.nombre} cambiado a ${nuevoEstado}.`, { timeout: 3000 })
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || 'Error desconocido al cambiar el estado.'
      toast.error(`🛑 Error al cambiar estado: ${msg}`, { timeout: 8000 })
    }
  }

  const msg = msgMap[nuevoEstado]

  if (msg) {
    openConfirm(msg, doChange)
  } else {
    await doChange()
  }
}

async function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  await loadUsers()
}

// 🔐 reenviar correo de restablecimiento
async function resetPassword(id: number) {
  if (!id) return

  const msg = '¿Enviar un nuevo correo de restablecimiento para este usuario?'
  openConfirm(msg, async () => {
    try {
      await $fetch(`/api/usuarios/${id}/reset-password-token-post`, {
        method: 'POST',
      })

      toast.success('🔐 Correo de restablecimiento enviado correctamente.', {
        timeout: 4000,
      })
    } catch (e: any) {
      const errMsg =
        e?.data?.message || e?.message || 'Error al enviar el correo de restablecimiento.'
      toast.error(`🛑 ${errMsg}`, { timeout: 8000 })
    }
  })
}

onMounted(async () => {
  await loadRoles()
  await loadUsers()
})

watch([q, estado, rol], () => {
  page.value = 1
  loadUsers()
})
</script>

<template>
  <div class="page">
    <!-- Filtros -->
    <div class="card">
      <h3>👥 Usuarios</h3>
      <div class="filters">
        <div>
          <label class="label">Buscar</label>
          <input
            class="input"
            placeholder="Nombre, email o usuario"
            v-model="q"
          />
        </div>

        <div>
          <label class="label">Estado</label>
          <select class="select" v-model="estado">
            <option value="">Todos</option>
            <option>ACTIVO</option>
            <option>INACTIVO</option>
            <option>SUSPENDIDO</option>
            <option>PENDIENTE</option>
          </select>
        </div>

        <div>
          <label class="label">Rol</label>
          <select class="select" v-model="rol">
            <option value="">Todos</option>
            <option v-for="r in rolesCatalogo" :key="r" :value="r">
              {{ r }}
            </option>
          </select>
        </div>

        <div class="btns">
          <button class="btn" @click="loadUsers">🔄</button>
          <button class="btn primary" @click="openCreate">+ Nuevo Usuario</button>
        </div>
      </div>
    </div>

    <!-- Lista -->
    <div class="card">
      <p v-if="loading" class="empty">Cargando usuarios...</p>
      <p v-else-if="!rows.length" class="empty">No hay usuarios registrados.</p>

      <div v-else class="user-list">
        <article v-for="u in rows" :key="u.id" class="user-card">
          <!-- Cabecera -->
          <header class="user-header">
            <div class="user-main">
              <div class="avatar">
                {{ (u.nombre?.[0] || '').toUpperCase() }}{{ (u.apellido?.[0] || '').toUpperCase() }}
              </div>
              <div class="user-text">
                <div class="user-name">{{ u.nombre }} {{ u.apellido }}</div>
                <div class="user-username">@{{ u.username }}</div>
                <div class="user-email">{{ u.email }}</div>
              </div>
            </div>

            <span
              class="chip"
              :class="{
                green: u.estado === 'ACTIVO',
                red: u.estado === 'INACTIVO',
                yellow: u.estado === 'PENDIENTE',
                gray: u.estado === 'SUSPENDIDO'
              }"
            >
              {{ u.estado }}
            </span>
          </header>

          <!-- Datos -->
          <section class="user-body">
            <div v-if="u.telefono" class="field">
              <span class="field-label">Teléfono</span>
              <span class="field-value">{{ u.telefono }}</span>
            </div>
            <div v-if="u.licencia" class="field">
              <span class="field-label">Licencia</span>
              <span class="field-value">{{ u.licencia }}</span>
            </div>
            <div class="field">
              <span class="field-label">Roles</span>
              <span class="field-value">
                <span v-for="r in u.roles" :key="r" class="role">
                  {{ r }}
                </span>
                <span v-if="!u.roles || !u.roles.length" class="role role-muted">—</span>
              </span>
            </div>
          </section>

          <!-- Acciones -->
          <footer class="user-footer">
            <div class="estado-actions">
              <button
                class="pill pill-green"
                @click="cambiarEstado(u, 'ACTIVO')"
                :disabled="u.estado === 'ACTIVO'"
              >
                Activo
              </button>
              <button
                class="pill pill-red"
                @click="cambiarEstado(u, 'INACTIVO')"
                :disabled="u.estado === 'INACTIVO'"
              >
                Inactivo
              </button>
              <button
                class="pill pill-gray"
                @click="cambiarEstado(u, 'SUSPENDIDO')"
                :disabled="u.estado === 'SUSPENDIDO'"
              >
                Suspender
              </button>
            </div>

            <div class="main-actions">
              <button class="btn-outline" @click="openEdit(u)">Editar</button>
              <button class="btn-outline danger" @click="removeUser(u.id)">Eliminar</button>
              <button class="btn-outline" @click="resetPassword(u.id)">Reenviar clave</button>
            </div>
          </footer>
        </article>

        <!-- Paginación -->
        <div class="pager" v-if="totalPages > 1">
          <button class="pager-btn" :disabled="page === 1" @click="goToPage(page - 1)">
            ◀ Anterior
          </button>
          <span class="pager-info">Página {{ page }} de {{ totalPages }}</span>
          <button class="pager-btn" :disabled="page === totalPages" @click="goToPage(page + 1)">
            Siguiente ▶
          </button>
        </div>
      </div>
    </div>

    <!-- Modal formulario -->
    <div v-if="showForm" class="modal">
      <div class="card modal-card">
        <h3>{{ editing?.id ? '✏️ Editar Usuario' : '➕ Nuevo Usuario' }}</h3>
        <UserForm
          :initial="editing || undefined"
          :all-roles="rolesCatalogo"
          :server-error="formServerError"
          @save="saveUser"
          @cancel="handleCancel"
          @resetPassword="resetPassword"
        />
      </div>
    </div>

    <!-- Modal confirmación -->
    <div v-if="showConfirm" class="modal">
      <div class="card modal-card confirm-card">
        <h3>Confirmar acción</h3>
        <p>{{ confirmMessage }}</p>
        <div class="confirm-actions">
          <button class="btn-outline" @click="confirmCancel">Cancelar</button>
          <button class="btn danger" @click="confirmOk">Aceptar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 6px rgba(0,0,0,.08);
}

/* Filtros */
.filters {
  display: grid;
  grid-template-columns: 1fr 150px 150px 150px;
  gap: .75rem;
  align-items: end;
}

.label {
  font-size: .85rem;
  font-weight: 600;
  margin-bottom: .25rem;
}

.input,
.select {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: .4rem .6rem;
}

.btns {
  display: flex;
  gap: .5rem;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: .45rem .8rem;
  font-weight: 600;
  cursor: pointer;
  background: #3b82f6;
  color: #fff;
}

.btn.primary { background: #16a34a; }

/* Lista vacía */
.empty {
  text-align: center;
  color: #6b7280;
  padding: 1rem 0;
}

/* Tarjetas */
.user-list {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}

.user-card {
  background:#d4e0f0;      /* azul clarito tipo buses */
  border-radius: 16px;
  padding: .8rem 1rem 1rem;
}

/* Cabecera */
.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: .75rem;
}

.user-main {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #92400e;
}

.user-name {
  font-weight: 700;
  font-size: 1rem;
}

.user-username {
  font-size: .8rem;
  color: #4b5563;
}

.user-email {
  font-size: .8rem;
  color: #6b7280;
}

/* Estado */
.chip {
  padding: .25rem .6rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
  color: #fff;
}
.chip.green  { background:#22c55e; }
.chip.red    { background:#ef4444; }
.chip.yellow { background:#facc15; color:#1f2937; }
.chip.gray   { background:#9ca3af; }

/* Cuerpo */
.user-body {
  margin-top: .8rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: .5rem;
}

.field {
  background: #fff;
  border-radius: 12px;
  padding: .45rem .6rem;
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.field-label {
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #9ca3af;
}

.field-value {
  font-size: .85rem;
  font-weight: 500;
}

.role {
  display: inline-flex;
  border-radius: 999px;
  padding: 0 .45rem;
  font-size: .75rem;
  background: #e0ebff;
  margin-right: .25rem;
}

.role-muted {
  background: #e5e7eb;
  color: #6b7280;
}

/* Footer */
.user-footer {
  margin-top: .75rem;
  padding-top: .5rem;
  border-top: 1px solid rgba(255,255,255,.8);
  display: flex;
  justify-content: space-between;
  gap: .5rem;
}

.estado-actions,
.main-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .25rem;
}

.pill {
  border: none;
  border-radius: 999px;
  padding: .2rem .6rem;
  font-size: .75rem;
  font-weight: 600;
  cursor: pointer;
}
.pill-green { background:#bbf7d0; color:#166534; }
.pill-red   { background:#fecaca; color:#7f1d1d; }
.pill-gray  { background:#e5e7eb; color:#374151; }
.pill:disabled { opacity:.5; cursor:default; }

.btn-outline {
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  padding: .25rem .7rem;
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-outline:hover { background:#e5edff; }
.btn-outline.danger { background:#fef2f2; border-color:#fecaca; color:#b91c1c; }

/* Paginación */
.pager {
  margin-top: .75rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: .5rem;
  font-size: .85rem;
}
.pager-btn {
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background:#f9fafb;
  padding:.2rem .6rem;
}
.pager-btn:disabled { opacity:.5; }

/* Modales */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,.55);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal-card {
  width: min(720px, 92vw);
}
.confirm-card {
  max-width: 380px;
  text-align: center;
}
.confirm-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .user-body {
    grid-template-columns: 1fr;
  }
  .user-footer {
    flex-direction: column;
  }
}
</style>

