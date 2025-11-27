// composables/useAuth.ts
import { navigateTo } from '#app'

type ServerUser = {
  id_usuario?: number
  id?: number
  userId?: number
  nombre?: string
  roles?: string[]
  username?: string
}

export interface User {
  id_usuario?: number   
  id?: number
  userId?: number
  nombre?: string
  roles?: string[]
  username?: string
}

const stateUser = () => useState<User | null | undefined>('user', () => undefined)

export function useAuth() {
  const user = stateUser()

  const refresh = async (force = false): Promise<User | null> => {
    if (!force && user.value !== undefined) return user.value ?? null
    try {
      const res = await $fetch<{ user: ServerUser }>('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      })
      const su = res.user || {}
      const normalized: User = {
        id_usuario: su.id_usuario ?? su.id ?? su.userId,
        id:        su.id ?? su.id_usuario ?? su.userId,
        userId:    su.userId ?? su.id ?? su.id_usuario,
        nombre:    su.nombre,
        roles:     su.roles ?? [],
        username:  su.username,
      }

      user.value = normalized
      return normalized
    } catch {
      user.value = null
      return null
    }
  }

  const login = async (credentials: { username: string; password: string; remember?: boolean }) => {
    await $fetch('/api/auth/login', { method: 'POST', body: credentials, credentials: 'include' })
    return await refresh(true)
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    user.value = null
    await navigateTo('/')
  }

  return { user, refresh, login, logout }
}
