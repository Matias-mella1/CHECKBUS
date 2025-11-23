// server/utils/documentoRules.ts
const N = (s: string) => (s || '').trim().toLowerCase()

export const TIPOS_CON_CADUCIDAD = new Set<string>([
  'permiso de circulación',
  'revisión técnica',
  'póliza soap',
  'licencia de conducir',
  'certificado médico',
])

// Acepta string | null | undefined
export const categoriaRequiere = (categoria?: string | null) => {
  const c = N(categoria ?? '')
  return {
    requiereBus:           c === 'vehículo',
    requiereUsuario:       c === 'conductor',
    requiereMantenimiento: c === 'mantenimiento',
    requiereIncidente:     c === 'incidente',
  }
}

export const requiereCaducidadPorNombre = (nombreTipo?: string | null) => {
  return TIPOS_CON_CADUCIDAD.has(N(nombreTipo ?? ''))
}
export function estadoSegunFechaCaducidad(
  fechaCaducidad?: Date | string | null
): 'VIGENTE' | 'POR VENCER' | 'VENCIDO' {
  if (!fechaCaducidad) return 'VIGENTE'

  const fc = new Date(fechaCaducidad)
  if (isNaN(fc.getTime())) return 'VIGENTE'

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fc.setHours(0, 0, 0, 0)

  const diffMs = fc.getTime() - hoy.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'VENCIDO'       // ya venció
  if (diffDays <= 30) return 'POR VENCER'  // vence en 30 días o menos
  return 'VIGENTE'
}