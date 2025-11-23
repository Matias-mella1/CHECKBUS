import { defineNuxtRouteMiddleware, navigateTo } from 'nuxt/app'
import { useAuth } from '../composables/useAuth'

type CanonRole = 'ADMINISTRADOR' | 'PROPIETARIO' | 'SUPERVISOR' | 'CONDUCTOR'

export default defineNuxtRouteMiddleware(async (to) => {
  // 0️⃣ No interceptar API ni assets
  if (to.path.startsWith('/api') || to.path.startsWith('/_nuxt')) return

  // 1️⃣ Rutas públicas
  const publicRoutes = new Set<string>([
    '/',              // Login
    '/set-password',  // Definir contraseña
    '/recuperar',     // Recuperar contraseña
  ])

  // Autenticación
  const { user, refresh } = useAuth()
  if (user.value === undefined) {
    try { await refresh(true) } catch (e) { console.warn('⚠️ Error cargando sesión:', e) }
  }

  // No logueado → solo públicas
  if (!user.value) {
    if (!publicRoutes.has(to.path)) {
      return navigateTo('/?next=' + encodeURIComponent(to.fullPath))
    }
    return
  }

  // Normalización de roles (multirol)
 
  const raw = (user.value.roles || []).map((r: any) => String(r).toUpperCase())

const roles: CanonRole[] = []

if (raw.some((r: string | string[]) => r.includes('ADMIN')))  roles.push('ADMINISTRADOR')
if (raw.some((r: string | string[]) => r.includes('PROP')))   roles.push('PROPIETARIO')
if (raw.some((r: string | string[]) => r.includes('SUPERV'))) roles.push('SUPERVISOR')
if (raw.some((r: string | string[]) => r.includes('COND')))   roles.push('CONDUCTOR')

  // Home por rol (corrige CONDUCTOR -> /conductor/menu)
  const homeByRole: Record<CanonRole, string> = {
    ADMINISTRADOR: '/admin',
    PROPIETARIO:   '/propietario/menu',
    SUPERVISOR:    '/supervisor',
    CONDUCTOR:     '/conductor/menu',
  }

  // 5️⃣ Si entra a una pública ya logueado → envía a la home del primer rol por prioridad
  if (publicRoutes.has(to.path)) {
    const priority: CanonRole[] = ['ADMINISTRADOR', 'PROPIETARIO', 'SUPERVISOR', 'CONDUCTOR']
    const primary = priority.find(r => roles.includes(r))
    const dest = (primary && homeByRole[primary]) || '/dashboard'
    if (to.path !== dest) return navigateTo(dest)
    return
  }

  // 6️⃣ Autorización por rol (UNIÓN de rutas permitidas)
  const allowedByRole: Record<CanonRole, string[]> = {

ADMINISTRADOR: [
  '/roles/administrador/menu',
  '/roles/administrador/usuarios',
  '/buses/buses',
  '/turnos/turnos',
  '/mantenimientos/mantenimientos',
  '/mecanicos/mecanicos',
  '/talleres/talleres',
  
  '/incidentes/incidentes',
  '/proveedor/proveedor',
  '/repuestos/repuestos',
  '/documentos/documentos',
  '/alertas/alertas',

  '/cambiar-password',
],

  
    PROPIETARIO: [
      '/roles/propietario/menu',
      '/buses/buses',
      '/turnos/turnos',
      '/mantenimientos/mantenimientos',
      '/incidentes/incidentes',
      '/documentos/documentos',
      '/reportes/reportes',
      '/alertas/alertas',
      '/cambiar-password',
    ],
    SUPERVISOR: [
      '/roles/supervisor/menu',
      '/reportes/reportes',
      '/alertas/alertas',
      '/documentos/documentos',
      '/incidentes/incidentes',
      '/buses/buses',
      '/turnos/turnos',
      '/mantenimientos/mantenimientos',
    ],
    CONDUCTOR: [
      '/roles/conductor/menu',
      '/roles/conductor/mis-turnos',
      '/roles/conductor/mis-incidente',
      '/roles/conductor/mis-alertas',
      '/conductor/alertas',
      '/cambiar-password',
    ],
  }

  const unionAllowed = Array.from(
    new Set(roles.flatMap(r => allowedByRole[r] || []))
  )

  // Si no hay reglas para sus roles, déjalo ir (o mándalo a /dashboard)
  if (!unionAllowed.length) return

  const ok = unionAllowed.some((base) =>
    to.path === base || to.path.startsWith(base + '/')
  )

  if (!ok) {
    // redirige a la primera ruta permitida para sus roles
    const dest = unionAllowed[0] 
    return navigateTo(dest)
  }
})
