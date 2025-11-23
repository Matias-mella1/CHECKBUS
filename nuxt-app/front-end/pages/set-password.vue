<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// El token sigue viniendo por query: ?token=xxxxx
const token = route.query.token as string | undefined

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const ok = ref('')
const done = ref(false)

async function onSubmit() {
  error.value = ''
  ok.value = ''

  if (!token) {
    error.value = 'Token inválido o ausente.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  loading.value = true
  try {
    // 👇 AHORA usamos la ruta /api/auth/password-tokens/[codigo].post.ts
    const res = await $fetch(`/api/auth/password-tokens/${token}`, {
      method: 'POST',
      body: { password: password.value },  // lo que espera [codigo].post.ts
    })

    ok.value = (res as any).message || 'Contraseña actualizada y cuenta activada.'
    done.value = true
  } catch (e: any) {
    error.value = e?.data?.message || 'Error al actualizar la contraseña.'
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/?reset=ok')
}
</script>


<template>
  <div class="bg">
    <div class="card">
      <!-- PANEL IZQUIERDO -->
      <section class="left">
        <div class="brand">
          <div class="logo">🔐</div>
          <h1>CheckBus</h1>
        </div>
        <h2 class="title">Restablecer contraseña</h2>
        <p class="subtitle">
          Protege tu cuenta estableciendo una nueva contraseña segura.
        </p>

        <ul class="features">
          <li><span class="dot"></span> Contraseñas cifradas de forma segura</li>
          <li><span class="dot"></span> Verificación del token de recuperación</li>
          <li><span class="dot"></span> Cumplimiento de políticas de seguridad</li>
        </ul>
      </section>

      <!-- PANEL DERECHO -->
      <section class="right">
        <h2 class="welcome">Definir nueva contraseña</h2>
        <p class="hint">Ingresa y confirma tu nueva contraseña</p>

        <template v-if="error && !done && !token">
          <p class="support" style="color:#b91c1c;font-weight:600;">
            {{ error }}
          </p>
        </template>

        <template v-else>
          <div class="group">
            <label>Nueva contraseña</label>
            <input
              class="input"
              type="password"
              v-model="password"
              placeholder="Mínimo 8 caracteres"
              minlength="8"
            />
          </div>

          <div class="group">
            <label>Confirmar contraseña</label>
            <input
              class="input"
              type="password"
              v-model="confirm"
              placeholder="Repite tu contraseña"
            />
          </div>

          <p v-if="error" class="support" style="color:#b91c1c;font-weight:600;margin-top:8px">
            {{ error }}
          </p>
          <p v-if="ok" class="support" style="color:#059669;font-weight:600;margin-top:8px">
            {{ ok }}
          </p>

          <button class="btn" :disabled="loading || !!ok" @click="onSubmit">
            {{ loading ? 'Guardando…' : 'Guardar contraseña' }}
          </button>

          <div v-if="done" class="text-center mt-4">
            <button @click="goLogin" class="link">Ir a iniciar sesión</button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Mismos estilos que ya tenías */
.bg {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #e0f2fe 0%, #93c5fd 100%);
  font-family: 'Inter', sans-serif;
  padding: clamp(16px, 3vw, 48px);
}
.card {
  width: 100%;
  max-width: 1100px;
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 35px 60px rgba(23, 23, 23, 0.2), 0 8px 18px rgba(23, 23, 23, 0.08);
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(360px, 480px);
}
.left {
  background: linear-gradient(160deg, #2563eb 0%, #1d4ed8 55%, #316bff 100%);
  color: white;
  padding: clamp(24px, 4vw, 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}
.left::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(600px 300px at 20% 15%, rgba(255,255,255,0.2), transparent 55%);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 2rem;
}
.logo {
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 28px;
}
.brand h1 {
  font-size: 1.9rem;
  font-weight: 800;
}
.title {
  font-size: clamp(1.4rem, 2.2vw, 1.8rem);
  font-weight: 700;
  margin-bottom: 0.5rem;
}
.subtitle {
  font-size: clamp(0.9rem, 1.5vw, 1rem);
  opacity: 0.95;
  margin-bottom: 1.5rem;
}
.features {
  list-style: none;
  padding: 0;
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
  background: #d1fae5;
  border-radius: 50%;
  position: relative;
}
.dot::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: #10b981;
}
.right {
  padding: clamp(24px, 4vw, 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid #e5e7eb;
}
.welcome {
  font-size: 1.7rem;
  font-weight: 800;
  margin-bottom: 0.3rem;
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
  display: block;
  margin-bottom: 0.5rem;
}
.input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: 0.2s;
}
.input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.link {
  color: #2563eb;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
.btn {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  padding: 0.9rem;
  cursor: pointer;
  font-size: 1rem;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25), inset 0 2px 0 rgba(255, 255, 255, 0.15);
}
.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.support {
  text-align: center;
  font-size: 0.95rem;
  margin-top: 1rem;
}
@media (max-width: 768px) {
  .card { grid-template-columns: 1fr; max-width: 95%; }
  .left { text-align: center; border-bottom: 1px solid #e5e7eb; }
  .right { padding: 2rem 1.5rem; }
}
</style>
