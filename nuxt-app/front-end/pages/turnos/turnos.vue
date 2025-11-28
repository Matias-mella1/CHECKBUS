<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import TurnoForm from '~/components/TurnoForm.vue'
import { useAuth } from '~/composables/useAuth' 

definePageMeta({ layout: 'panel' })

const toast = useToast()

/*  Tipos  */
type EstadoNombre = 'PROGRAMADO' | 'EN CURSO' | 'COMPLETADO' | 'CANCELADO'

type Turno = {
  id: number
  usuarioId: number
  usuarioNombre: string
  busId: number
  busLabel: string
  inicio: string
  fin: string
  estadoId: number
  estadoLabel: EstadoNombre | string
  titulo?: string
  descripcion?: string
  ruta_origen?: string | null
  ruta_fin?: string | null
}

type EstadoItem = { id:number; nombre:string }
type Option     = { id:number; label:string }
type EditMode   = 'FULL' | 'PARTIAL' | 'DESC_ONLY'

/*Auth / Roles  */
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

const isSupervisor = computed(() => rolesUsuario.value.includes('SUPERVISOR'))
const isPropietario = computed(() => rolesUsuario.value.includes('PROPIETARIO'))

// Permisos
const canAddTurno   = computed(() => isAdmin.value || isPropietario.value)
const canEditTurno  = computed(() => isAdmin.value || isPropietario.value)
const canCancelTurno = computed(() => isAdmin.value) // solo admin cancela
const isReadOnly    = computed(() => !canAddTurno.value && !canEditTurno.value && !canCancelTurno.value)

/*  Filtros  */
const qUsuario     = ref('')
const from         = ref('')
const to           = ref('')
const estadoFilter = ref<'' | number>('')

/* Datos  */
const loading = ref(false)
const items   = ref<Turno[]>([])

const estados = ref<EstadoItem[]>([
  { id: 1, nombre: 'PROGRAMADO' },
  { id: 2, nombre: 'EN CURSO' },
  { id: 3, nombre: 'COMPLETADO' },
  { id: 4, nombre: 'CANCELADO' },
])

/* catálogos para TurnoForm */
const conductoresRaw = ref<Option[]>([])
const busesRaw       = ref<Option[]>([])

const formConductores = computed(() => conductoresRaw.value)
const formBuses = computed<Option[]>(() => {
  const base = [...busesRaw.value]
  if (editing.value && editing.value.busId) {
    const exists = base.some(b => b.id === editing.value!.busId)
    if (!exists) {
      base.push({ id: editing.value.busId, label: editing.value.busLabel })
    }
  }
  return base
})

function idByName(name: string): number | null {
  const s = name.toUpperCase()
  return estados.value.find(e => e.nombre.toUpperCase() === s)?.id ?? null
}
function nameById(id: number | null | undefined): string | null {
  if (id == null) return null
  return estados.value.find(e => e.id === id)?.nombre ?? null
}

function fmtDT(v: string) {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function estadoChipClass(label: string) {
  const s = (label || '').toUpperCase()
  if (s === 'PROGRAMADO') return 'estado-chip estado-programado'
  if (s === 'EN CURSO')   return 'estado-chip estado-curso'
  if (s === 'COMPLETADO') return 'estado-chip estado-completado'
  if (s === 'CANCELADO')  return 'estado-chip estado-cancelado'
  return 'estado-chip'
}

/* Cargar catálogos */
async function loadEstados() {
  try {
    const r = await $fetch<{items:EstadoItem[]}>('/api/turnos/estados')
    if (Array.isArray(r.items) && r.items.length) {
      estados.value = r.items.map(e => ({
        id: Number(e.id),
        nombre: String(e.nombre).toUpperCase(),
      }))
    }
  } catch (e) {
    console.warn('No se pudieron cargar estados de turno:', e)
  }
}

async function loadConductoresActivos() {
  try {
    const r = await $fetch<{items:any[]}>('/api/conductor', {
      query: { estado: 'ACTIVO', incluirPropietario: 'false' },
    } as any)
    conductoresRaw.value = (r.items || []).map(x => ({
      id: Number(x.id),
      label: String(x.nombre),
    }))
  } catch (e) {
    conductoresRaw.value = []
    console.warn('No se pudieron cargar conductores:', e)
  }
}

async function loadBusesOperativos() {
  try {
    const r = await $fetch<{items:any[]}>('/api/buses', {
      query: { estado: 'OPERATIVO' },
    } as any)
    busesRaw.value = (r.items || []).map(x => ({
      id: Number(x.id),
      label: `${x.patente ?? x.plate ?? ''} (${x.modelo ?? x.model ?? ''})`,
    }))
  } catch (e) {
    busesRaw.value = []
    console.warn('No se pudieron cargar buses:', e)
  }
}

/* Cargar turnos */
async function loadTurnos() {
  loading.value = true
  try {
    const query: any = {}
    if (from.value) query.from = from.value
    if (to.value)   query.to   = to.value
    if (estadoFilter.value !== '' && estadoFilter.value != null) {
      query.id_estado_turno = Number(estadoFilter.value)
    }

    const r = await $fetch<{items:any[]}>('/api/turnos', { query })

    items.value = (r.items || []).map((t:any) => {
      const rawEstadoId = t.id_estado_turno
      const nombreRaw   = String(t.estado ?? '').toUpperCase()

      let estadoId: number =
        typeof rawEstadoId === 'number' && !Number.isNaN(rawEstadoId)
          ? rawEstadoId
          : (idByName(nombreRaw) || idByName('PROGRAMADO') || 1)

      const label =
        nameById(estadoId) ||
        nombreRaw ||
        'PROGRAMADO'

      return {
        id: Number(t.id),
        usuarioId: Number(t.usuarioId ?? t.id_usuario),
        usuarioNombre: String(t.usuarioNombre ?? t.usuario_nombre ?? ''),
        busId: Number(t.busId ?? t.id_bus),
        busLabel: String(
          t.busLabel ??
          `${t.bus?.patente ?? t.bus?.plate ?? ''} ${t.bus?.modelo ?? t.bus?.model ?? ''}`.trim()
        ),
        inicio: String(t.inicio),
        fin: String(t.fin),
        estadoId,
        estadoLabel: label,
        titulo: t.titulo || '',
        descripcion: t.descripcion || '',
        ruta_origen: t.ruta_origen ?? null,
        ruta_fin: t.ruta_fin ?? null,
      } as Turno
    })
  } catch (e:any) {
    const msg = e?.data?.message || e?.message || 'No se pudieron cargar los turnos.'
    toast.error(`🛑 ${msg}`, { timeout: 8000 })
    items.value = []
  } finally {
    loading.value = false
  }
}

/* Agrupar por conductor  */
type GrupoTurnos = {
  usuarioId: number
  usuarioNombre: string
  turnos: Turno[]
}

const grupos = computed<GrupoTurnos[]>(() => {
  let rows = items.value

  if (qUsuario.value.trim()) {
    const q = qUsuario.value.trim().toLowerCase()
    rows = rows.filter(t =>
      (t.usuarioNombre || '').toLowerCase().includes(q),
    )
  }

  const map = new Map<number, GrupoTurnos>()

  for (const t of rows) {
    if (!map.has(t.usuarioId)) {
      map.set(t.usuarioId, {
        usuarioId: t.usuarioId,
        usuarioNombre: t.usuarioNombre,
        turnos: [],
      })
    }
    map.get(t.usuarioId)!.turnos.push(t)
  }

  const list = Array.from(map.values()).sort(
    (a, b) => a.usuarioNombre.localeCompare(b.usuarioNombre, 'es'),
  )

  for (const g of list) {
    g.turnos.sort(
      (a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime(),
    )
  }

  return list
})

/* Turno se ve como  Acordeón  */
const open = ref<Record<number, boolean>>({})
function toggle(id:number){ open.value[id] = !open.value[id] }
function isOpen(id:number){ return open.value[id] !== false }

/* Crear / Editar  */
const showAdd  = ref(false)
const showEdit = ref(false)
const savingAdd  = ref(false)
const savingEdit = ref(false)
const editing = ref<Turno | null>(null)

const editMode = computed<EditMode | undefined>(() => {
  const t = editing.value
  if (!t) return undefined
  const s = (t.estadoLabel || '').toUpperCase()
  if (s === 'PROGRAMADO') return 'FULL'
  if (s === 'COMPLETADO') return 'DESC_ONLY'
  return 'PARTIAL'
})

function openAddTurno() {
  if (!canAddTurno.value) return  //solo admin / propietario
  editing.value = null
  showAdd.value = true
  Promise.all([loadConductoresActivos(), loadBusesOperativos()]).catch(() => {})
}

function openEditTurno(t:Turno) {
  if (!canEditTurno.value) return //solo admin / propietario
  editing.value = t
  showEdit.value = true
  Promise.all([loadConductoresActivos(), loadBusesOperativos()]).catch(() => {})
}

/* guardar nuevo */
async function handleSaveAdd(payload: {
  usuarioId: number
  busId: number
  inicio: string
  fin: string
  titulo?: string
  descripcion?: string
  ruta_origen?: string
  ruta_fin?: string
}) {
  if (!canAddTurno.value) {
    toast.error('No tienes permisos para crear turnos.')
    return
  }

  savingAdd.value = true
  try {
    await $fetch('/api/turnos', {
      method: 'POST',
      body: {
        id_usuario:  payload.usuarioId,
        id_bus:      payload.busId,
        inicio:      payload.inicio,
        fin:         payload.fin,
        titulo:      payload.titulo,
        descripcion: payload.descripcion,
        ruta_origen: payload.ruta_origen,
        ruta_fin:    payload.ruta_fin,
      } as any,
    })
    showAdd.value = false
    await loadTurnos()
    toast.success('✅ Turno agregado correctamente.', { timeout: 3000 })
  } catch (e:any) {
    const msg = e?.data?.message || e?.message || 'No se pudo agregar el turno.'
    toast.error(`🛑 ${msg}`, { timeout: 8000 })
  } finally {
    savingAdd.value = false
  }
}

/* guardar edición */
async function handleSaveEdit(payload: {
  usuarioId: number
  busId: number
  inicio: string
  fin: string
  titulo?: string
  descripcion?: string
  ruta_origen?: string
  ruta_fin?: string
}) {
  if (!canEditTurno.value) {
    toast.error('No tienes permisos para editar turnos.')
    return
  }

  if (!editing.value) return
  savingEdit.value = true
  try {
    await $fetch(`/api/turnos/${editing.value.id}`, {
      method: 'PUT',
      body: {
        id_usuario:  payload.usuarioId,
        id_bus:      payload.busId,
        inicio:      payload.inicio,
        fin:         payload.fin,
        titulo:      payload.titulo,
        descripcion: payload.descripcion,
        ruta_origen: payload.ruta_origen,
        ruta_fin:    payload.ruta_fin,
      } as any,
    })
    showEdit.value = false
    editing.value = null
    await loadTurnos()
    toast.success('✅ Turno actualizado correctamente.', { timeout: 3000 })
  } catch (e:any) {
    const msg = e?.data?.message || e?.message || 'No se pudo actualizar el turno.'
    toast.error(`🛑 ${msg}`, { timeout: 8000 })
  } finally {
    savingEdit.value = false
  }
}

/*  Cancelar turno  */
async function cancelarTurno(t:Turno) {
  if (!canCancelTurno.value) { // 🔐 solo admin
    toast.error('No tienes permisos para cancelar turnos.')
    return
  }

  const enCursoId    = idByName('EN CURSO')    || 2
  const completadoId = idByName('COMPLETADO') || 3
  const canceladoId  = idByName('CANCELADO')  || 4

  if (t.estadoId === enCursoId || t.estadoId === completadoId) {
    toast.error('⚠️ No se puede cancelar un turno en curso o completado.', { timeout: 5000 })
    return
  }

  if (!confirm(`¿Cancelar el turno #${t.id} de "${t.usuarioNombre}"?`)) return

  try {
    await $fetch(`/api/turnos/${t.id}`, {
      method: 'PUT',
      body: { id_estado_turno: canceladoId } as any,
    })
    await loadTurnos()
    toast.success('✅ Turno cancelado correctamente.', { timeout: 3000 })
  } catch (e:any) {
    const msg = e?.data?.message || e?.message || 'No se pudo cancelar el turno.'
    toast.error(`🛑 ${msg}`, { timeout: 8000 })
  }
}

watch(
  [from, to, estadoFilter],
  () => {
    loadTurnos()
  }
)
onMounted(async () => {
  await loadEstados()
  await loadTurnos()
})
</script>

<template>
  <div class="grid">
    <!-- Filtros -->
    <div class="card">
      <h3 class="title">
        Turnos por Conductor
        <span v-if="isAdmin" class="role-chip admin">Admin</span>
        <span v-else-if="isPropietario" class="role-chip prop">Propietario</span>
        <span v-else-if="isSupervisor" class="role-chip sup">Supervisor (solo lectura)</span>
      </h3>

      <div class="filters">
        <div>
          <label class="label">Conductor</label>
          <input
            class="input"
            placeholder="Nombre del conductor"
            v-model="qUsuario"
          />
        </div>
        <div>
          <label class="label">Desde</label>
          <input class="input" type="datetime-local" v-model="from" />
        </div>
        <div>
          <label class="label">Hasta</label>
          <input class="input" type="datetime-local" v-model="to" />
        </div>
        <div>
          <label class="label">Estado</label>
          <select class="select" v-model="estadoFilter">
            <option :value="''">Todos</option>
            <option v-for="e in estados" :key="e.id" :value="e.id">
              {{ e.nombre }}
            </option>
          </select>
        </div>
        <div class="filters-actions">
          <!--  solo admin + propietario -->
          <button
            v-if="canAddTurno"
            class="btn"
            @click="openAddTurno"
          >
            + Agregar turno
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div class="card" v-if="loading">
      <div class="skeleton" style="height:38px"></div>
    </div>

    <!-- Lista agrupada -->
    <div class="card" v-else>
      <div v-if="!grupos.length" class="empty">
        No hay turnos para mostrar.
      </div>

      <div v-else class="group-list">
        <section
          v-for="g in grupos"
          :key="g.usuarioId"
          class="group-card"
        >
          <header class="group-header" @click="toggle(g.usuarioId)">
            <div class="group-main">
              <div class="avatar">
                {{ (g.usuarioNombre?.[0] || '').toUpperCase() }}
              </div>
              <div>
                <div class="group-name">
                  {{ g.usuarioNombre }}
                </div>
              </div>
            </div>

            <div class="group-right">
              <span class="count-chip">
                {{ g.turnos.length }} turno(s)
              </span>
              <span class="group-arrow">
                {{ isOpen(g.usuarioId) ? '▼' : '►' }}
              </span>
            </div>
          </header>

          <div v-show="isOpen(g.usuarioId)" class="group-body">
            <div class="turno-list">
              <article
                v-for="t in g.turnos"
                :key="t.id"
                class="turno-card"
              >
                <header class="turno-header">
                  <div class="turno-bus">
                    <span class="turno-id">#{{ t.id }}</span>
                    <span class="turno-bus-label">{{ t.busLabel }}</span>
                  </div>
                  <span :class="estadoChipClass(t.estadoLabel)">
                    {{ t.estadoLabel }}
                  </span>
                </header>

                <section class="turno-body">
                  <div class="turno-row">
                    <span class="turno-label">Inicio</span>
                    <span class="turno-value">{{ fmtDT(t.inicio) }}</span>
                  </div>
                  <div class="turno-row">
                    <span class="turno-label">Fin</span>
                    <span class="turno-value">{{ fmtDT(t.fin) }}</span>
                  </div>
                  <div class="turno-row">
                    <span class="turno-label">Ruta</span>
                    <span class="turno-value">
                      {{
                        t.ruta_origen || t.ruta_fin
                          ? (t.ruta_origen || '—') + ' → ' + (t.ruta_fin || '—')
                          : '—'
                      }}
                    </span>
                  </div>
                  <div class="turno-row">
                    <span class="turno-label">Título</span>
                    <span class="turno-value">{{ t.titulo || '—' }}</span>
                  </div>
                </section>

                <footer class="turno-footer">
                  <!--  acciones solo si NO es solo lectura -->
                  <div class="turno-actions" v-if="!isReadOnly">
                    <button
                      v-if="canEditTurno"
                      class="row-btn"
                      title="Editar"
                      @click.stop="openEditTurno(t)"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      v-if="canCancelTurno"
                      class="row-btn danger"
                      title="Cancelar"
                      @click.stop="cancelarTurno(t)"
                    >
                      🚫 Cancelar
                    </button>
                  </div>
                </footer>
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Modal Agregar -->
    <div v-if="showAdd && canAddTurno" class="backdrop">
      <div class="card modal-card">
        <h3 style="margin-top:0">Agregar turno</h3>
        <TurnoForm
          :all-conductores="formConductores"
          :all-buses="formBuses"
          @save="handleSaveAdd"
          @cancel="() => { showAdd = false }"
          @validationError="msg => toast.error(`⚠ ${msg}`, { timeout:5000 })"
        />
        <div class="saving-hint">
          <span v-if="savingAdd">Guardando...</span>
        </div>
      </div>
    </div>

    <!-- Modal Editar -->
    <div v-if="showEdit && editing && canEditTurno" class="backdrop">
      <div class="card modal-card">
        <h3 style="margin-top:0">
          Editar turno — {{ editing.usuarioNombre }}
        </h3>
        <TurnoForm
          :initial="{
            usuarioId: editing.usuarioId,
            busId: editing.busId,
            inicio: String(editing.inicio),
            fin: String(editing.fin),
            titulo: editing.titulo,
            descripcion: editing.descripcion,
            ruta_origen: editing.ruta_origen || undefined,
            ruta_fin: editing.ruta_fin || undefined
          }"
          :mode="editMode"
          :all-conductores="formConductores"
          :all-buses="formBuses"
          @save="handleSaveEdit"
          @cancel="() => { showEdit = false; editing = null }"
          @validationError="msg => toast.error(`⚠ ${msg}`, { timeout:5000 })"
        />
        <div class="saving-hint">
          <span v-if="savingEdit">Guardando...</span>
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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
  padding: 1rem;
}

.title {
  margin: 0 0 .75rem 0;
  display:flex;
  align-items:center;
  gap:.5rem;
}

.role-chip{
  padding:.1rem .6rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
  border:1px solid #d1d5db;
}
.role-chip.admin{
  background:#dcfce7;
  color:#166534;
}
.role-chip.prop{
  background:#e0f2fe;
  color:#0369a1;
}
.role-chip.sup{
  background:#f3f4f6;
  color:#4b5563;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) 160px;
  gap: 1rem;
  align-items: end;
}
.label {
  font-size: .85rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: .35rem;
}
.input,
.select {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: .5rem .75rem;
}
.input:focus,
.select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}
.filters-actions {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
.btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: .55rem .9rem;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover { background:#1d4ed8; }

.empty {
  text-align: center;
  color: #6b7280;
  padding: 1rem 0;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
.group-card {
  background: #bfdbfe;
  border-radius: 18px;
  padding: .75rem 1rem 1rem;
  box-shadow: 0 8px 18px rgba(15,23,42,.12);
}
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  cursor: pointer;
}
.group-main {
  display: flex;
  align-items: center;
  gap: .75rem;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: #92400e;
}
.group-name {
  font-weight: 700;
  font-size: 1rem;
  text-transform: capitalize;
}
.group-right {
  display: flex;
  align-items: center;
  gap: .5rem;
}
.group-arrow {
  font-size: .9rem;
}
.count-chip {
  padding: .2rem .6rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
  background: #e0e7ff;
  color: #312e81;
}
.group-body {
  margin-top: .6rem;
  background: #ffffff;
  border-radius: 14px;
  padding: .6rem .75rem .8rem;
}
.turno-list {
  display: flex;
  flex-direction: column;
  gap: .6rem;
}
.turno-card {
  background: #f9fafb;
  border-radius: 14px;
  padding: .7rem .9rem;
  box-shadow: 0 1px 3px rgba(15,23,42,.08);
}
.turno-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .4rem;
}
.turno-bus {
  display: flex;
  align-items: center;
  gap: .4rem;
}
.turno-id {
  font-size: .75rem;
  font-weight: 700;
  color: #6b7280;
  padding: .1rem .4rem;
  border-radius: 999px;
  background: #e5e7eb;
}
.turno-bus-label {
  font-weight: 600;
  color: #111827;
}
.turno-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .35rem .75rem;
  margin-top: .3rem;
}
.turno-row {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}
.turno-label {
  font-size: .7rem;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #9ca3af;
}
.turno-value {
  font-size: .85rem;
  color: #111827;
}
.turno-footer {
  margin-top: .5rem;
  display: flex;
  justify-content: flex-end;
}
.turno-actions {
  display: flex;
  gap: .35rem;
}
.row-btn {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: .25rem .7rem;
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
}
.row-btn:hover {
  background:#e5edff;
  border-color:#2563eb;
}
.row-btn.danger {
  background:#fef2f2;
  border-color:#fecaca;
  color:#b91c1c;
}
.row-btn.danger:hover {
  background:#fee2e2;
}
.estado-chip {
  padding: .25rem .7rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 700;
}
.estado-programado { background:#dbeafe; color:#1e40af; }
.estado-curso      { background:#fef9c3; color:#92400e; }
.estado-completado { background:#dcfce7; color:#166534; }
.estado-cancelado  { background:#fee2e2; color:#991b1b; }

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal-card {
  width: min(640px,94vw);
}
.saving-hint {
  text-align:right;
  font-size:.8rem;
  color:#6b7280;
  margin-top:.25rem;
}
.skeleton {
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
@media (max-width: 900px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .turno-body {
    grid-template-columns: 1fr;
  }
}
</style>
