import { defineNuxtPlugin, useRequestHeaders, useState } from "nuxt/app"

export default defineNuxtPlugin(async () => {
  const user = useState<any>('user', () => undefined)

  // Si ya fue cargado antes, no repetir
  if (user.value !== undefined) return

  // En SSR mandamos cookies manualmente
  const headers = process.server ? useRequestHeaders(['cookie']) : undefined

  try {
    const res = await $fetch<{ user: any }>('/api/auth/me', {
      headers,
      credentials: 'include'
    })

    user.value = res.user ?? null
  } catch {
    user.value = null
  }
})
