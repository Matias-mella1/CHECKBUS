import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getQuery, setHeader, createError } from 'h3'


function parseISODate(v?: string | string[]): Date | null {
  if (!v) return null
  const s = Array.isArray(v) ? v[0] : v
  const d = new Date(s)
  return Number.isFinite(+d) ? d : null
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event)

  // id de usuario
  let idUsuario =
    Number((event as any).context?.auth?.user?.id_usuario) ||
    Number((event as any).context?.auth?.user?.id) || 0
  if (!idUsuario && q.id_usuario) idUsuario = Number(q.id_usuario)
  if (!idUsuario) throw createError({ statusCode: 401, message: 'No autenticado: falta id_usuario' })

  const fechaInc = parseISODate(q.fecha as string) ?? new Date()
  const graceHours = Number(q.graceHours ?? 24)

  // 1) Turno que cubre la fecha
  const covering = await prisma.turnoConductor.findFirst({
    where: {
      id_usuario: idUsuario,
      hora_inicio: { lte: fechaInc },
      OR: [{ hora_fin: null }, { hora_fin: { gte: fechaInc } }],
    },
    orderBy: { hora_inicio: 'desc' },
    select: {
      id_turno: true,
      id_bus: true,
      bus: { select: { id_bus: true, patente: true, modelo: true } },
      hora_inicio: true,
      hora_fin: true,
    },
  })

  if (covering) {
    const busId = covering.id_bus ?? covering.bus?.id_bus ?? null
    if (busId) {
      return {
        suggested: {
          busId,
          busLabel: covering.bus
            ? `${covering.bus.patente}${covering.bus.modelo ? ' - ' + covering.bus.modelo : ''}`
            : '—',
          source: 'covering' as const,
          turnoId: covering.id_turno,
        },
      }
    }
  }

  // 2) Último turno previo dentro de la ventana
  const previous = await prisma.turnoConductor.findFirst({
    where: { id_usuario: idUsuario, hora_inicio: { lte: fechaInc } },
    orderBy: { hora_inicio: 'desc' },
    select: {
      id_turno: true,
      id_bus: true,
      bus: { select: { id_bus: true, patente: true, modelo: true } },
      hora_inicio: true,
      hora_fin: true,
    },
  })

  if (previous) {
    const endedAt = previous.hora_fin ?? previous.hora_inicio
    const diffMs = Math.abs(+fechaInc - +endedAt)
    if (diffMs <= graceHours * 60 * 60 * 1000) {
      const busId = previous.id_bus ?? previous.bus?.id_bus ?? null
      if (busId) {
        return {
          suggested: {
            busId,
            busLabel: previous.bus
              ? `${previous.bus.patente}${previous.bus.modelo ? ' - ' + previous.bus.modelo : ''}`
              : '—',
            source: 'previous' as const,
            turnoId: previous.id_turno,
          },
        }
      }
    }
  }

  return { suggested: null }
})
