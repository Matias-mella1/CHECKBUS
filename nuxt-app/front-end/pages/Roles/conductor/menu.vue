<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: 'panel' })

//  Estado general 
const loading = ref(true)
const errorMsg = ref('')

//  Auth 
const { user, refresh } = useAuth()

// Roles del usuario 
const rolesUsuario = computed<string[]>(() => {
  const raw = (user.value as any)?.roles
  return Array.isArray(raw) ? raw : []
})

const isConductor = computed(() => rolesUsuario.value.includes('CONDUCTOR'))

// ID usuario logueado
const myUserId = computed(() => Number((user.value as any)?.id ?? 0))

//  Datos 
const turnos = ref<any[]>([])

//  Stats rápidas 
const totalTurnos = computed(() => turnos.value.length)

//  Helpers 
function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime())
    ? '—'
    : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
}

//  Carga Turnos 
async function loadTurnos() {
  loading.value = true
  errorMsg.value = ''
  turnos.value = []
  try {
    if (!myUserId.value) await refresh(true)

    const r = await $fetch<{ items?: any[] }>('/api/conductor/turnos', {
      query: { id_usuario: myUserId.value || undefined },
      credentials: 'include',
    })

    turnos.value = (r.items ?? []).map((t) => ({
      id: t.id,
      bus: t.bus ?? '—',
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: String(t.estado || '').toUpperCase(),
      titulo: t.titulo || '—',
      descripcion: t.descripcion || '—',
    }))
  } catch (e: any) {
    console.error('loadTurnos error →', e)
    errorMsg.value =
      e?.data?.message || e?.message || 'No se pudieron cargar los turnos.'
  } finally {
    loading.value = false
  }
}

//  Inicialización 
onMounted(async () => {
  await refresh(true)
  await loadTurnos()
})
</script>

<template>
  <div class="page">
    <!-- HEADER -->
    <section class="page-header-card">
      <div>
        <h2 class="page-title">Panel del Conductor</h2>
        <p class="page-subtitle">
          Aquí puedes ver tus turnos asignados y su estado.
        </p>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </div>

      <div class="header-stats">
        <div class="stat">
          <span class="stat-label">Total de turnos</span>
          <span class="stat-value">{{ totalTurnos }}</span>
        </div>
      </div>
    </section>

    <!-- LISTA DE TURNOS -->
    <section class="block-card">
      <h3 class="block-title" style="margin-bottom: .4rem;">Mis turnos</h3>
      <p class="block-subtitle">Turnos asignados como conductor.</p>

      <div v-if="loading" class="list-empty">Cargando…</div>
      <div v-else-if="!turnos.length" class="list-empty">
        🕒 No tienes turnos asignados.
      </div>

      <div v-else class="turn-list">
        <article
          v-for="t in turnos"
          :key="t.id"
          class="turn-card"
        >
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
              <span
                :class="[
                  'badge',
                  t.estado === 'PROGRAMADO'
                    ? 'badge-blue'
                    : t.estado === 'EN CURSO'
                      ? 'badge-yellow'
                      : t.estado === 'COMPLETADO'
                        ? 'badge-green'
                        : 'badge-red'
                ]"
              >
                {{ t.estado }}
              </span>
            </div>
          </header>

          <section class="turn-body">
            <div class="turn-grid">
              <div class="metric">
                <span class="metric-label">Inicio</span>
                <span class="metric-value">{{ fmtDate(t.hora_inicio) }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Fin</span>
                <span class="metric-value">{{ fmtDate(t.hora_fin) }}</span>
              </div>
              <div class="metric full">
                <span class="metric-label">Descripción</span>
                <span class="metric-value multiline">
                  {{ t.descripcion || '—' }}
                </span>
              </div>
            </div>
          </section>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page{
  padding:1.25rem;
  background:#e5f3ff;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  gap:1rem;
}

/* Header general */
.page-header-card{
  background:#ffffff;
  border-radius:16px;
  padding:1rem 1.25rem;
  box-shadow:0 1px 3px rgba(0,0,0,.08);
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:1rem;
}
.page-title{
  margin:0 0 .25rem;
  font-size:1.25rem;
  font-weight:700;
}
.page-subtitle{
  margin:0;
  font-size:.9rem;
  color:#6b7280;
}

/* Stats */
.header-stats{
  display:flex;
  gap:.75rem;
  flex-wrap:wrap;
}
.stat{
  background:#f3f4ff;
  border-radius:12px;
  padding:.45rem .9rem;
  min-width:130px;
}
.stat-label{
  font-size:.75rem;
  text-transform:uppercase;
  color:#6b7280;
}
.stat-value{
  display:block;
  font-size:1rem;
  font-weight:700;
  color:#111827;
}

/* Cards de bloque */
.block-card{
  background:#ffffff;
  border-radius:16px;
  padding:.9rem 1.1rem 1.1rem;
  box-shadow:0 1px 3px rgba(0,0,0,.07);
}
.block-title{
  margin:0;
  font-size:1rem;
  font-weight:700;
}
.block-subtitle{
  margin:.1rem 0 0;
  font-size:.82rem;
  color:#6b7280;
}

/* Turnos */
.list-empty{
  padding:2rem;
  text-align:center;
  color:#6b7280;
}
.turn-list{
  margin-top:.75rem;
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
  gap:.3rem;
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

.error{
  color:#dc2626;
  margin-top:.35rem;
  font-size:.9rem;
}


@media (max-width:900px){
  .page{
    padding:.75rem;
  }
  .page-header-card{
    flex-direction:column;
  }
  .header-stats{
    width:100%;
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
}
</style>
