<script setup lang="ts">
import { ref } from 'vue'
import { $fetch } from 'ofetch'

const props = defineProps<{
  close?: () => void
}>()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const loading = ref(false)
const error = ref('')
const success = ref('')

async function onSubmit () {
  error.value = ''
  success.value = ''

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    error.value = 'Completa todos los campos.'
    return
  }

  if (newPassword.value.length < 8) {
    error.value = 'La nueva contraseña debe tener al menos 8 caracteres.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'La nueva contraseña y la confirmación no coinciden.'
    return
  }

  loading.value = true
  try {
    const res = await $fetch('/api/auth/cambiar-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    })

    success.value = (res as any).message || 'Contraseña actualizada correctamente.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    error.value = e?.data?.message || 'No se pudo actualizar la contraseña.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card-change">
    <!-- Botón X para cerrar -->
    <button class="close-btn" type="button" @click="props.close?.()">
      ✕
    </button>

    <header class="header">
      <div class="icon-circle">🔑</div>
      <div>
        <h1>Cambiar contraseña</h1>
        <p>Por seguridad, utiliza una contraseña única y difícil de adivinar.</p>
      </div>
    </header>

    <form class="form" @submit.prevent="onSubmit">
      <div class="group">
        <label>Contraseña actual</label>
        <input
          v-model="currentPassword"
          type="password"
          class="input"
          placeholder="Ingresa tu contraseña actual"
        />
      </div>

      <div class="group inline">
        <div>
          <label>Nueva contraseña</label>
          <input
            v-model="newPassword"
            type="password"
            class="input"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div>
          <label>Confirmar nueva contraseña</label>
          <input
            v-model="confirmPassword"
            type="password"
            class="input"
            placeholder="Repite la nueva contraseña"
          />
        </div>
      </div>

      <ul class="hints">
        <li>• Al menos 8 caracteres.</li>
        <li>• Evita usar la misma contraseña de otros sistemas.</li>
        <li>• No compartas tu contraseña con nadie.</li>
      </ul>

      <p v-if="error" class="msg error">
        {{ error }}
      </p>
      <p v-if="success" class="msg success">
        {{ success }}
      </p>

      <div class="actions">
        <button type="submit" class="btn" :disabled="loading">
          {{ loading ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.card-change {
  position: relative;
  width: 100%;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 2rem 2rem 2.2rem;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  animation: fadeIn .3s ease;
}

/* Botón X */
.close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color .15s ease, transform .15s ease;
}
.close-btn:hover {
  color: #0f172a;
  transform: scale(1.08);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* HEADER */
.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.7rem;
}

.icon-circle {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2db4e8, #6fc163);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 4px 14px rgba(0, 119, 200, 0.3);
}

.header h1 {
  font-size: 1.45rem;
  font-weight: 800;
  margin: 0;
  color: #0f172a;
}
.header p {
  margin: 2px 0 0;
  font-size: 0.92rem;
  color: #64748b;
}

/* FORM */
.form {
  margin-top: 0.5rem;
}

.group {
  margin-bottom: 1rem;
}

.group.inline {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  display: block;
  margin-bottom: 0.35rem;
}

.input {
  width: 100%;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 0.95rem;
  outline: none;
  transition: all .18s ease;
}

.input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(0, 119, 200, 0.18);
}

/* Hints */
.hints {
  list-style: none;
  padding: 0;
  margin: 0.4rem 0 1.1rem;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.4;
}

/* Mensajes */
.msg {
  font-size: 0.9rem;
  margin-bottom: 0.8rem;
  text-align: left;
}
.msg.error {
  color: #e11d48;
  font-weight: 600;
}
.msg.success {
  color: #059669;
  font-weight: 600;
}

/* Botón */
.actions {
  display: flex;
  justify-content: flex-end;
}

.btn {
  background: linear-gradient(135deg, #0077c8, #005a8c);
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  padding: 0.75rem 1.7rem;
  cursor: pointer;
  font-size: 0.95rem;
  box-shadow: 0 6px 14px rgba(0, 119, 200, 0.4);
  transition: transform .1s ease, filter .18s ease;
}

.btn:hover {
  filter: brightness(1.06);
}
.btn:active {
  transform: translateY(1px);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .card-change {
    padding: 1.4rem 1.2rem;
  }
  .group.inline {
    grid-template-columns: 1fr;
  }
}
</style>
