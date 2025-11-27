<template>
  <div class="topbar-inner" ref="menuRef">
    <!-- Usuario + Rol (alineado a la derecha) -->
    <div class="user-info">
      <div class="name">{{ userName }}</div>
      <div class="role">{{ rolePretty }}</div>
    </div>

    <!-- Avatar -->
    <button
      class="avatar"
      :aria-expanded="openMenu ? 'true' : 'false'"
      aria-haspopup="menu"
      @click.stop="openMenu = !openMenu"
    >
      {{ initials }}
    </button>

    <!-- Menú desplegable -->
    <transition name="fade">
      <div
        v-if="openMenu"
        class="menu"
        role="menu"
      >
        <div class="menu-header">
          <div class="menu-name">{{ userName }}</div>
          <div class="menu-role">{{ rolePretty }}</div>
        </div>

        <button
          class="menu-item"
          role="menuitem"
          @click="openChangePassword"
        >
          🔑 Cambiar contraseña
        </button>

        <button
          class="menu-item danger"
          role="menuitem"
          @click="handleLogout"
        >
          🔒 Cerrar sesión
        </button>
      </div>
    </transition>

    <!-- Modal con formulario -->
    <Modal v-model="openPassword">
      <template #default="{ close }">
        <ChangePassword :close="close" />
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { navigateTo } from 'nuxt/app'
import { useAuth } from '../composables/useAuth'
import Modal from '../components/ui/Modal.vue'
import ChangePassword from '../components/Cambiar-Password.vue'

type Role = 'ADMINISTRADOR' | 'PROPIETARIO' | 'SUPERVISOR' | 'CONDUCTOR'

const { user, logout } = useAuth()

/* ---------- Nombre / iniciales ---------- */
const userName = computed(() => user.value?.nombre || 'Usuario')

const initials = computed(() => {
  const parts = userName.value.split(' ').filter(Boolean)
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase()
})

/* ---------- Normalización de roles ---------- */
const roles = computed<Role[]>(() => {
  const raw: string[] = (user.value?.roles || []).map((r: any) => String(r).toUpperCase())
  const out: Role[] = []

  if (raw.some(r => r.includes('ADMIN')))  out.push('ADMINISTRADOR')
  if (raw.some(r => r.includes('PROP')))   out.push('PROPIETARIO')
  if (raw.some(r => r.includes('SUPERV'))) out.push('SUPERVISOR')
  if (raw.some(r => r.includes('COND')))   out.push('CONDUCTOR')

  return out
})

/* ---------- Rol legible ---------- */
const rolePretty = computed(() => {
  const map: Record<Role, string> = {
    ADMINISTRADOR: '👑 Administrador',
    PROPIETARIO:   '🏠 Propietario',
    SUPERVISOR:    '🧭 Supervisor',
    CONDUCTOR:     '🚍 Conductor'
  }

  const priority: Role[] = ['ADMINISTRADOR', 'PROPIETARIO', 'SUPERVISOR', 'CONDUCTOR']
  const primary = priority.find(r => roles.value.includes(r))

  return primary ? map[primary] : 'Sin rol'
})

/* ---------- Estado UI ---------- */
const openMenu = ref(false)
const openPassword = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (!menuRef.value) return
  if (!menuRef.value.contains(e.target as Node)) {
    openMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

function openChangePassword() {
  openMenu.value = false
  openPassword.value = true
}

async function handleLogout() {
  await logout()
  openMenu.value = false
  await navigateTo('/')
}
</script>

<style scoped>
.topbar-inner {
  height: var(--header-h);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  padding: 0 1.4rem;

  background: linear-gradient(90deg, #07111f, #0c1a2d);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  position: relative;
  width: 100%;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.user-info .name {
  font-weight: 700;
  font-size: 0.95rem;
  color: #e4f4ff;
}
.user-info .role {
  font-size: 0.82rem;
  color: #9cc7ff;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 0, #38bdf8, #0077c2);
  border: 2px solid #b5e9ff;
  color: white;
  font-weight: 700;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 5px 12px rgba(0,0,0,0.45);
  transition: transform .15s ease, filter .15s ease;
}
.avatar:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}


.menu {
  position: absolute;
  right: 1.2rem;
  top: calc(100% + 0.6rem);
  width: 230px;
  background: linear-gradient(180deg, #0b1628, #08111d);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.07);
  box-shadow: 0 18px 40px rgba(0,0,0,0.55);
  overflow: hidden;
  z-index: 9999;
}

.menu-header {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(56,189,248,0.2), rgba(34,197,94,0.12));
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.menu-name {
  font-weight: 700;
  color: #eaf6ff;
}
.menu-role {
  font-size: 0.8rem;
  color: #9cb5c9;
}


.menu-item {
  width: 100%;
  text-align: left;
  padding: 0.65rem 1rem;
  background: transparent;
  border: none;
  color: #d9e4f2;
  cursor: pointer;
  transition: background .15s ease, padding-left .15s ease;
}
.menu-item:hover {
  background: rgba(56,189,248,0.15);
  padding-left: 1.15rem;
}

.menu-item.danger {
  color: #ffbaba;
}
.menu-item.danger:hover {
  background: rgba(255,90,90,0.18);
  color: #ffdede;
}


.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
