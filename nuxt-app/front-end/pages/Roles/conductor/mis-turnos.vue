<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from 'vue-toastification'

definePageMeta({ layout: 'panel' })

const toast = useToast()

type APITurno = {
  id: number
  id_usuario: number
  fecha: string | null
  hora_inicio: string
  hora_fin: string
  bus: string | null
  estado: string | null
  titulo: string | null
  descripcion: string | null
  ruta_origen?: string | null
  ruta_fin?: string | null
}

type Row = {
  id: number
  bus: string
  inicio: string
  fin: string
  estado: string
  estadoDesc: string
  titulo: string
  descripcion: string
  ruta: string
}

const { user, refresh } = useAuth()

const from = ref('')
const to   = ref('')
const estadoFilter = ref<string>('')

const loading = ref(false)
const items = ref<Row[]>([])
const errorMsg = ref('')

const editingId = ref<number|null>(null)
const editDescripcion = ref('')
const savingEdit = ref(false)

function fmtDT(v: string) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`
}

function badgeClass(e:string){
  e = (e || '').toUpperCase()
  if (e === 'PROGRAMADO') return 'badge badge-blue'
  if (e === 'EN CURSO')   return 'badge badge-yellow'
  if (e === 'COMPLETADO') return 'badge badge-green'
  if (e === 'CANCELADO')  return 'badge badge-red'
  return 'badge'
}
function estadoHelp(e:string){
  e = (e || '').toUpperCase()
  if (e === 'PROGRAMADO') return 'Turno creado'
  if (e === 'EN CURSO')   return 'Turno activo'
  if (e === 'COMPLETADO') return 'Turno finalizado'
  if (e === 'CANCELADO')  return 'No se ejecuta'
  return ''
}

async function loadTurnos () {
  loading.value = true
  errorMsg.value = ''
  try {
    if (user.value === undefined) await refresh(true)

    const query:any = {
      from: from.value || undefined,
      to:   to.value   || undefined,
    }

    if (estadoFilter.value) {
      query.estado = estadoFilter.value
    }

    if (user.value?.id) query.id_usuario = user.value.id

    const r = await $fetch<{items: APITurno[]}>('/api/conductor/turnos', {
      query,
      credentials: 'include',
    })

    const list = (r.items || []).map(t => {
      const estadoRaw = (t.estado || '—').toUpperCase()

      const origen = t.ruta_origen ?? null
      const fin    = t.ruta_fin ?? null

      const ruta =
        origen || fin
          ? `${origen || '—'} → ${fin || '—'}`
          : '—'

      return {
        id: t.id,
        bus: t.bus || '—',
        inicio: t.hora_inicio,
        fin: t.hora_fin,
        estado: estadoRaw,
        estadoDesc: estadoHelp(t.estado || ''),
        titulo: t.titulo || '—',
        descripcion: t.descripcion || '',
        ruta,
      } as Row
    })

    list.sort(
      (a,b)=> new Date(b.inicio).getTime() - new Date(a.inicio).getTime()
    )
    items.value = list
  } catch (e:any) {
    console.error('Mis turnos error:', e?.data || e)
    items.value = []
    errorMsg.value = e?.data?.message || 'No se pudieron cargar tus turnos (¿sesión iniciada?)'
    toast.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}

const filteredItems = computed(() => {
  let rows = items.value
  if (estadoFilter.value) {
    const target = estadoFilter.value.toUpperCase()
    rows = rows.filter(r => (r.estado || '').toUpperCase() === target)
  }
  return rows
})

function startEditDescripcion(r:Row){
  editingId.value = r.id
  editDescripcion.value = r.descripcion || ''
}
function cancelEdit(){
  editingId.value = null
  editDescripcion.value = ''
}

async function saveDescripcion(){
  if (!editingId.value) return
  savingEdit.value = true
  try {
    await $fetch(`/api/turnos/${editingId.value}`, {
      method:'PUT',
      body:{ descripcion: editDescripcion.value || null } as any,
      credentials:'include',
    })
    await loadTurnos()
    cancelEdit()
    toast.success('Descripción actualizada.')
  } catch(e:any){
    const msg = e?.data?.message || 'No se pudo actualizar la descripción'
    toast.error(msg)
  } finally {
    savingEdit.value = false
  }
}

onMounted(loadTurnos)
</script>

<template>
  <div class="grid">
    <!-- HEADER / FILTROS -->
    <div class="card">
      <h3 class="title">
        Mis Turnos
        <span class="chip">Conductor</span>
      </h3>

      <div class="filters">
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
          <select class="input" v-model="estadoFilter">
            <option value="">Todos</option>
            <option value="PROGRAMADO">Programado</option>
            <option value="EN CURSO">En curso</option>
            <option value="COMPLETADO">Completado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <div class="filters-actions">
          <button class="btn" @click="loadTurnos">
            Filtrar
          </button>
        </div>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <p class="hint">
        🔒 Solo puedes modificar la <strong>descripción</strong> de tus turnos.
      </p>
    </div>

    <!-- LISTA EN CARDS -->
    <div class="card">
      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="!filteredItems.length" class="list-empty">No tienes turnos</div>

      <div v-else class="turn-list">
        <article
          v-for="t in filteredItems"
          :key="t.id"
          class="turn-card"
        >
          <!-- Header -->
          <header class="turn-header">
            <div class="turn-main">
              <div class="turn-icon">🚌</div>
              <div>
                <div class="turn-title">
                  Turno #{{ t.id }} — {{ t.bus }}
                </div>
                <div class="turn-sub">
                  {{ t.titulo || 'Sin título' }}
                </div>
              </div>
            </div>

            <div class="turn-meta">
              <span :class="badgeClass(t.estado)" :title="t.estadoDesc">
                {{ t.estado }}
              </span>
              <span class="turn-help">{{ t.estadoDesc }}</span>
            </div>
          </header>

          <!-- Body -->
          <section class="turn-body">
            <div class="turn-grid">
              <div class="metric">
                <span class="metric-label">Inicio</span>
                <span class="metric-value">{{ fmtDT(t.inicio) }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Fin</span>
                <span class="metric-value">{{ fmtDT(t.fin) }}</span>
              </div>

              <!-- RUTA EN TARJETA SEPARADA -->
              <div class="metric">
                <span class="metric-label">Ruta</span>
                <span class="metric-value route-value">
                  {{ t.ruta }}
                </span>
              </div>

              <div class="metric full">
                <span class="metric-label">Descripción</span>

                <!-- modo lectura -->
                <span
                  v-if="editingId !== t.id"
                  class="metric-value multiline"
                >
                  {{ t.descripcion || '—' }}
                </span>

                <!-- modo edición -->
                <div v-else class="edit-box">
                  <textarea
                    class="textarea"
                    rows="5"
                    v-model="editDescripcion"
                    placeholder="Describe qué pasó en el turno…"
                  ></textarea>
                  <div class="hint small">
                    Solo se actualiza el campo <strong>descripción</strong>.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Footer -->
          <footer class="turn-footer">
            <div class="footer-left">
              <span class="id-pill">ID {{ t.id }}</span>
            </div>

            <div class="footer-actions">
              <template v-if="editingId !== t.id">
                <button class="btn-outline" @click="startEditDescripcion(t)">
                  ✏️ Editar descripción
                </button>
              </template>
              <template v-else>
                <button
                  class="btn small"
                  :disabled="savingEdit"
                  @click="saveDescripcion"
                >
                  {{ savingEdit ? 'Guardando…' : 'Guardar' }}
                </button>
                <button class="btn-outline" @click="cancelEdit">
                  Cancelar
                </button>
              </template>
            </div>
          </footer>
        </article>
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
.chip{
  margin-left:.5rem;
  background:#eef;
  border:1px solid #d1d5db;
  color:#111827;
  padding:.1rem .5rem;
  border-radius:999px;
  font-size:.75rem;
  font-weight:600;
}

.filters{
  display:grid;
  grid-template-columns:1.2fr 1fr 1fr 150px;
  gap:1rem;
  align-items:end;
}
.filters-actions{
  display:flex;
  justify-content:flex-end;
  align-items:flex-end;
}
.label{
  font-weight:600;
  color:#374151;
  font-size:.9rem;
  margin-bottom:.3rem;
}
.input{
  width:100%;
  border:1px solid #d1d5db;
  border-radius:10px;
  padding:.5rem .75rem;
  font-size:.9rem;
}
.input:focus{
  border-color:#2563eb;
  box-shadow:0 0 0 2px rgba(37,99,235,.2);
  outline:none;
}

.error{
  color:#dc2626;
  margin-top:.4rem;
  font-size:.9rem;
  text-align:right;
}
.hint{
  margin-top:.4rem;
  color:#6b7280;
  font-size:.85rem;
}
.hint.small{
  font-size:.78rem;
}

.btn{
  background:#2563eb;
  color:#fff;
  border:none;
  border-radius:10px;
  padding:.55rem .9rem;
  font-weight:600;
  cursor:pointer;
}
.btn:hover{ background:#1d4ed8; }
.btn.small{
  padding:.4rem .8rem;
  font-size:.85rem;
}
.btn-outline{
  border:1px solid #d1d5db;
  background:#fff;
  padding:.45rem .8rem;
  border-radius:10px;
  font-weight:600;
  cursor:pointer;
  font-size:.85rem;
}
.btn-outline:hover{
  background:#e5edff;
  border-color:#2563eb;
}

/* Lista / tarjetas de turnos */
.list-empty{
  padding:2rem;
  text-align:center;
  color:#6b7280;
}
.turn-list{
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.turn-card{
  border-radius:18px;
  border:1px solid #e5e7eb;
  padding:1.1rem 1.4rem;
  background:#d4e0f0;
  box-shadow:0 8px 20px rgba(0,0,0,.04);
}

/* Header */
.turn-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}
.turn-main{
  display:flex;
  align-items:center;
  gap:.9rem;
}
.turn-icon{
  width:48px;
  height:48px;
  border-radius:14px;
  background:#dbeafe;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:1.6rem;
}
.turn-title{
  font-size:1.05rem;
  font-weight:700;
}
.turn-sub{
  font-size:.85rem;
  color:#4b5563;
}
.turn-meta{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:.25rem;
}
.turn-help{
  font-size:.78rem;
  color:#6b7280;
}

.turn-body{
  margin-top:.9rem;
  background:#ffffffde;
  border-radius:14px;
  padding:.9rem 1rem;
}
.turn-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.8rem 1.2rem;
}
.metric{
  background:#f9fafb;
  border-radius:10px;
  padding:.55rem .7rem;
}
.metric.full{
  grid-column:1 / -1;
}
.metric-label{
  font-size:.7rem;
  text-transform:uppercase;
  color:#9ca3af;
}
.metric-value{
  font-size:.9rem;
  font-weight:600;
}
.metric-value.multiline{
  white-space:pre-wrap;
  word-break:break-word;
}

/* Ruta bien visible */
.route-value{
  white-space:pre-wrap;
  word-break:break-word;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* Edición descripción */
.edit-box{
  display:flex;
  flex-direction:column;
  gap:.25rem;
}
.textarea{
  width:100%;
  border:1px solid #d1d5db;
  border-radius:10px;
  padding:.5rem .75rem;
  font-size:.9rem;
  resize:vertical;
  min-height:110px;
}
.textarea:focus{
  border-color:#2563eb;
  box-shadow:0 0 0 2px rgba(37,99,235,.2);
  outline:none;
}


.turn-footer{
  margin-top:.8rem;
  padding-top:.7rem;
  border-top:1px solid #bfdbfe;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:.75rem;
}
.footer-left{
  display:flex;
  align-items:center;
  gap:.4rem;
}
.id-pill{
  border-radius:999px;
  padding:.2rem .65rem;
  font-size:.75rem;
  font-weight:600;
  border:1px solid #bfdbfe;
  background:#e0f2fe;
  color:#1d4ed8;
}
.footer-actions{
  display:flex;
  flex-wrap:wrap;
  gap:.5rem;
}

.badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:96px;
  padding:.2rem .6rem;
  border-radius:999px;
  font-size:.78rem;
  font-weight:700;
}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-yellow{background:#fef9c3;color:#92400e}
.badge-green{background:#dcfce7;color:#166534}
.badge-red{background:#fee2e2;color:#991b1b}


@media (max-width:900px){
  .filters{
    grid-template-columns:1fr 1fr;
  }
}
@media (max-width:768px){
  .turn-card{
    padding:1rem;
  }
  .turn-header{
    flex-direction:column;
    align-items:flex-start;
  }
  .turn-meta{
    flex-direction:row;
    align-items:center;
    gap:.4rem;
  }
  .turn-grid{
    grid-template-columns:1fr;
  }
  .turn-footer{
    flex-direction:column;
    align-items:flex-start;
  }
}
</style>
