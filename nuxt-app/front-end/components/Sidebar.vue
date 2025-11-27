<template>
  <aside class="sidebar">
  
    <div class="logo-box">
      <img src="@/assets/fotos/logo.png" class="logo-img" alt="CheckBus Logo" />
    </div>


    <nav>
      <h3 class="menu-title">MENÚ</h3>

      <p v-if="user === undefined" class="no-role">Cargando menú…</p>
      <p v-else-if="!user" class="no-role">Inicie sesión</p>

      <ul v-else>
        <li v-for="item in menuItems" :key="item.label + (item.to || '')">
          <div v-if="item.section" class="menu-section">{{ item.label }}</div>
          <NuxtLink v-else :to="item.to" active-class="active">
            <span v-if="item.icon" class="icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>

        <li v-if="!menuItems.length" class="no-role">
          No hay opciones para tus roles.
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'

type Role = 'ADMINISTRADOR' | 'PROPIETARIO' | 'SUPERVISOR' | 'CONDUCTOR'
interface MenuItem { label: string; icon?: string; to?: string; section?: boolean }

const { user } = useAuth()

// Usuario
const userName = computed(() => user.value?.nombre || 'Usuario')
const initials = computed(() => {
  const parts = (userName.value || 'U').trim().split(' ')
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
})

const roles = computed<Role[]>(() => {
  const list = (user.value?.roles || []).map((r: string) => r.toUpperCase())
  const out: Role[] = []

  if (list.some((r: string) => r.includes('ADMIN')))  out.push('ADMINISTRADOR')
  if (list.some((r: string) => r.includes('PROP')))   out.push('PROPIETARIO')
  if (list.some((r: string) => r.includes('SUPERV'))) out.push('SUPERVISOR')
  if (list.some((r: string) => r.includes('COND')))   out.push('CONDUCTOR')

  return out
})



//  Menú por rol 
const menuByRole: Record<Role, MenuItem[]> = {
  ADMINISTRADOR: [
    { label: 'Inicio', icon: '🏠', to: '/roles/administrador/menu' },
    { label: 'Como Administrador', section: true },
    { label: 'Usuarios', icon: '👥', to: '/roles/administrador/usuarios' },
    { label: 'Turnos', icon: '📅', to: '/turnos/turnos' },
    { label: 'Buses', icon: '🚌', to: '/buses/buses' },
    { label: 'Mantenimientos', icon: '🛠️', to: '/mantenimientos/mantenimientos' },
    { label: 'Taller', icon: '🏗️', to: '/talleres/talleres' },
    { label: 'Mecánicos', icon: '🧑‍🔧', to: '/mecanicos/mecanicos' },
    { label: 'Incidentes', icon: '⚠️', to: '/incidentes/incidentes' },
    { label: 'Proveedor-Repuesto', icon: '🏢', to: '/proveedor/proveedor' },
    { label: 'Repuestos', icon: '🔩', to: '/repuestos/repuestos' },
    { label: 'Documentos', icon: '📂', to: '/documentos/documentos' },
    { label: 'Alertas', icon: '🚨', to: '/alertas/alertas' },
  ],

  PROPIETARIO: [
    { label: 'Inicio', icon: '🏠', to: '/roles/propietario/menu' },
    { label: 'Como Propietario', section: true },
    { label: 'Mi Flota', icon: '🚌', to: '/buses/buses' },
    { label: 'Incidentes', icon: '⚠️', to: '/incidentes/incidentes' },
    { label: 'Turnos', icon: '📅', to: '/turnos/turnos' },
    { label: 'Mantenimientos', icon: '🛠️', to: '/mantenimientos/mantenimientos' },
    { label: 'Documentos', icon: '📂', to: '/documentos/documentos' },
    { label: 'Reportes', icon: '📊', to: '/reportes/reportes' },
    { label: 'Alertas', icon: '🚨', to: '/alertas/alertas' },
    
  ],

  SUPERVISOR: [
    { label: 'Inicio', icon: '🏠', to: '/roles/supervisor/supervisor' },
    { label: 'Como Supervisor', section: true },
    { label: 'Buses', icon: '🚌', to: '/buses/buses' },
    { label: 'Turnos', icon: '📅', to: '/turnos/turnos' },
    { label: 'Incidentes', icon: '⚠️', to: '/incidentes/incidentes' },
    { label: 'Mantenimientos', icon: '🛠️', to: '/mantenimientos/mantenimientos' },
    { label: 'Documentos', icon: '📂', to: '/documentos/documentos' },
    { label: 'Alertas', icon: '🚨', to: '/alertas/alertas' },
     { label: 'Reportes', icon: '📊', to: '/reportes/reportes' },
  ],

  CONDUCTOR: [
    { label: 'Inicio', icon: '🏠', to: '/roles/conductor/menu' },
    { label: 'Como Conductor', section: true },
    { label: 'Mis Turnos', icon: '📅', to: '/roles/conductor/mis-turnos' },
    { label: 'Mis incidentes', icon: '⚠️', to: '/roles/conductor/mis-incidente' },
    { label: 'Mis Alertas', icon: '⚠️', to: '/roles/conductor/mis-alertas' },
    
  ],
}

//  Combina menús de todos los roles 
const menuItems = computed<MenuItem[]>(() => {
  if (!user.value) return []

  const combined: MenuItem[] = []
  const seen = new Set<string>()

  for (const r of roles.value) {
    for (const item of menuByRole[r] || []) {
      const key = `${item.section ? 'S' : 'I'}|${item.label}|${item.to || ''}`
      if (!seen.has(key)) {
        combined.push(item)
        seen.add(key)
      }
    }
  }

  let seenHome = false
  const filtered: MenuItem[] = []
  for (const it of combined) {
    if (!it.section && it.label === 'Inicio') {
      if (seenHome) continue
      seenHome = true
    }
    filtered.push(it)
  }
  return filtered
})
</script>

<style scoped>

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 260px;
  background: linear-gradient(180deg, #070F1A 0%, #0C1A2A 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
  box-shadow: 3px 0 14px rgba(0,0,0,.45);
  z-index: 50;
  overflow-y: auto;
}


.logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 1rem 0.8rem;
  margin: 0.4rem auto 1.2rem auto;
  width: 40%;
  background: rgba(255,255,255,0.06);
  border-radius: 16px;
  border: 1px solid rgba(0, 200, 255, 0.20);
  box-shadow: 0 0 14px rgba(0, 200, 255, 0.22);
  backdrop-filter: blur(6px);
}

.logo-img {
  height: 50px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.45));
}

.logo-title {
  display: none;
}

nav ul,
nav li {
  list-style: none !important;
  margin: 0;
  padding: 0;
}

.menu-title {
  font-size: .78rem;
  color: #8fb2d6;
  margin: .3rem 0 .8rem 1.5rem;
  letter-spacing: 1.2px;
  opacity: .9;
}

.menu-section {
  padding: .6rem 1.5rem .3rem;
  font-size: .74rem;
  color: #7e8fa5;
  text-transform: uppercase;
  letter-spacing: .07em;
  opacity: .85;
}

nav a {
  display: flex;
  align-items: center;
  gap: .8rem;

  padding: .7rem 1.6rem;
  color: #d7e1f0;
  text-decoration: none;

  border-radius: 10px;
  transition: background .25s, color .25s, transform .1s;
}

nav a:hover {
  background: rgba(0, 200, 255, 0.16);
  color: #f8fbff;
}

nav a.active {
  background: linear-gradient(92deg, #0ea5e9, #22c55e);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,.35);
  transform: translateY(-1px);
}

.no-role {
  color: #94a3b8;
  text-align: center;
  font-size: .85rem;
  margin-top: .6rem;
  opacity: .85;
}
</style>
