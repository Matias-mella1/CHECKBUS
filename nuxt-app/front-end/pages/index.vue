<script setup lang="ts">
import { ref } from 'vue'
import { useState, useCookie, navigateTo } from 'nuxt/app'

// === Tipos del login ===
type LoginUser =
  | { id: number; nombre: string; rol: string }
  | { id: number; nombre: string; username?: string; roles: string[] }

interface LoginResponse {
  success: boolean
  user?: LoginUser
  token?: string
  message?: string
}

const user = ref('')
const pass = ref('')
const remember = ref(false)
const errMsg = ref('')
const loading = ref(false)

// Normaliza roles
function normalizeRole(r: string) {
  return r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

// Convierte al usuario en estándar
function toStandardUser(u: LoginUser) {
  const roles = 'roles' in u && Array.isArray(u.roles)
    ? u.roles.map(normalizeRole)
    : ('rol' in u ? [normalizeRole(u.rol)] : [])
  return { id: (u as any).id, nombre: (u as any).nombre, roles }
}

// Página según rol
function homeByRole(u: { roles: string[] }) {
  if (u.roles.includes('ADMINISTRADOR')) return '/admin'
  if (u.roles.includes('PROPIETARIO'))   return '/propietario'
  if (u.roles.includes('SUPERVISOR'))    return '/supervisor'
  if (u.roles.includes('CONDUCTOR'))     return '/conductor'
  return '/'
}

async function onSubmit() {
  if (loading.value) return
  errMsg.value = ''
  loading.value = true
  try {
    const payload = {
      username: user.value.trim(),
      password: pass.value.trim(),
    }

    const res = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: payload,
    })

    if (res.success && res.user) {
      const std = toStandardUser(res.user)
      const globalUser = useState<typeof std | null>('user', () => null)
      globalUser.value = std

      if (res.token) {
        const cookie = useCookie<string | null>('auth_token', {
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          ...(remember.value ? { maxAge: 60 * 60 * 24 * 7 } : {}),
        })
        cookie.value = res.token
      }

      return navigateTo(homeByRole(std))
    } else {
      errMsg.value = res.message || 'Usuario o contraseña incorrectos'
    }
  } catch (err: any) {
    errMsg.value = err?.data?.message || err?.message || 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg">
    <div class="card">
      <!-- PANEL IZQUIERDO -->
      <section class="left">
        <div class="brand">
          <div class="logo-wrapper">
            <img class="logo" src="@/assets/fotos/logo.png" alt="Logo CheckBus" />
          </div>
        </div>

        <div class="intro">
          <h2 class="title">Sistema de Gestión de Flota</h2>
          <p class="subtitle">
            Administra tu flota de buses de manera eficiente y profesional.
          </p>
        </div>

        <ul class="features">
          <li><span class="dot"></span> Control total de vehículos y conductores</li>
          <li><span class="dot"></span> Gestión de mantenciones programadas</li>
          <li><span class="dot"></span> Reportes y alertas en tiempo real</li>
          <li><span class="dot"></span> Control de documentación y repuestos</li>
        </ul>
      </section>

      <!-- PANEL DERECHO -->
      <section class="right">
        <h2 class="welcome">¡Bienvenido!</h2>
        <p class="hint">Ingresa tus credenciales para acceder al sistema</p>

        <div class="group">
          <label>Usuario</label>
          <input
            class="input"
            v-model="user"
            placeholder="usuario o email"
            @keydown.enter="onSubmit"
          />
        </div>

        <div class="group">
          <label>Contraseña</label>
          <input
            class="input"
            type="password"
            v-model="pass"
            placeholder="Ingresa tu contraseña"
            @keydown.enter="onSubmit"
          />
        </div>

        <div class="form-row">
          <label class="remember">
            <input type="checkbox" v-model="remember" />
            Recordar sesión
          </label>
          <NuxtLink to="/recuperar" class="link">¿Olvidaste tu contraseña?</NuxtLink>
        </div>

        <button class="btn" :disabled="loading" @click="onSubmit">
          {{ loading ? 'Ingresando…' : 'Iniciar Sesión' }}
        </button>

        <p v-if="errMsg" class="support">
          {{ errMsg }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ==============================
   FONDO GLOBAL
================================= */
.bg {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #ffffff 0%, var(--bg) 100%);
  font-family: 'Inter', sans-serif;
  padding: clamp(16px, 3vw, 48px);
}

/* ==============================
   CARD GENERAL
================================= */
.card {
  width: 100%;
  max-width: 1100px;
  background: #fff;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 35px 60px rgba(0, 0, 0, 0.18);
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(360px, 480px);
  animation: fadeIn 0.8s ease forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* PANEL IZQUIERDO — FONDO NUEVO Y MÁS PROFESIONAL */
.left {
  background: linear-gradient(
    180deg,
    #0a4a78 0%,      /* azul profundo elegante */
    #0f6e9f 45%,      /* azul intermedio */
    #139ac7 80%,      /* azul claro del logo */
    rgba(120, 200, 120, 0.15) 100% /* toque verde MUY suave */
  );
  color: white;
  padding: clamp(24px, 4vw, 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}

/* brillo sutil */
.left::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    600px 300px at 50% 25%,
    rgba(255,255,255,0.25),
    transparent 70%
  );
  pointer-events: none;
}


/* ==============================
   LOGO DESTACADO
================================= */
.brand {
  display: flex;
  justify-content: center;
  margin-bottom: 1.8rem;
}

/* caja blanca para que el logo se vea SIEMPRE */
.logo-wrapper {
  background: #ffffff;
  padding: 10px 18px;
  border-radius: 18px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255,255,255,0.9);
}

.logo {
  height: clamp(120px, 22vh, 210px);
  width: auto;
  object-fit: contain;
  display: block;
}

/* ==============================
   TEXTOS IZQUIERDOS
================================= */
.intro {
  text-align: center;
  margin-bottom: 1.4rem;
}

.title {
  font-size: clamp(1.4rem, 2.4vw, 2rem);
  font-weight: 800;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  font-size: clamp(0.9rem, 1.5vw, 1rem);
  opacity: 0.97;
  margin-bottom: 1.6rem;
  line-height: 1.5;
  text-align: center;
}

.features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.features li {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.8rem;
  font-size: 0.95rem;
}

.dot {
  width: 20px;
  height: 20px;
  background: rgba(138, 210, 106, 0.18);
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.dot::after {
  content: "";
  position: absolute;
  inset: 5px;
  background: var(--green);
  border-radius: 50%;
}

/* ==============================
   PANEL DERECHO
================================= */
/* PANEL DERECHO MEJORADO – MÁS CONTRASTE Y ELEGANCIA */
.right {
  padding: clamp(24px, 4vw, 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;

  /* Nuevo color suave */
  background: #e5ebe6; /* gris azulado suave */
  border-left: 1px solid #d6d9dd;

  /* borde y profundidad */
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.05);
}


.welcome {
  font-size: 1.7rem;
  font-weight: 800;
  margin-bottom: 0.3rem;
  color: #111827;
}

.hint {
  color: #6b7280;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.group {
  margin-bottom: 1rem;
}

.group label {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 0.5rem;
  display: block;
}

.input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(0, 119, 200, 0.25);
}

.form-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 1rem 0 1.5rem 0;
}

.link {
  color: var(--brand);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* Botón */
.btn {
  background: linear-gradient(180deg, var(--brand) 0%, var(--brand-hover) 100%);
  color: white;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  padding: 0.9rem;
  cursor: pointer;
  font-size: 1rem;
  box-shadow: 0 8px 18px rgba(0, 90, 140, 0.4);
  transition: filter 0.15s, transform 0.1s;
}

.btn:hover {
  filter: brightness(1.04);
}

.btn:active {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.support {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.95rem;
  color: #b91c1c;
  font-weight: 600;
}

/* ==============================
   RESPONSIVE (CELULAR)
================================= */
@media (max-width: 768px) {
  .card {
    grid-template-columns: 1fr;
    max-width: 95%;
    box-shadow: none;
  }

  .left {
    border-bottom: 1px solid #e5e7eb;
    text-align: center;
    padding: 2rem 1.5rem;
  }

  .right {
    padding: 2rem 1.5rem;
    border-left: none;
  }

  .btn {
    width: 100%;
  }

  .bg {
    padding: 1.5rem 0;
    background: linear-gradient(135deg, #ffffff 0%, var(--bg) 100%);
  }
}
</style>
