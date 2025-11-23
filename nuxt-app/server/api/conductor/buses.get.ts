// server/api/conductor/buses.get.ts
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event)

  // 1) id_usuario desde auth o query (fallback dev)
  let idUsuario =
    Number((event as any).context?.auth?.user?.id_usuario) ||
    Number((event as any).context?.auth?.user?.id) || 0
  if (!idUsuario && q.id_usuario) idUsuario = Number(q.id_usuario)
  if (!idUsuario) throw createError({ statusCode: 401, message: 'No autenticado: falta id_usuario' })

  // 2) Ventana de tiempo opcional (from/to o 'days' hacia atrás). Default 90 días.
  let fromDate: Date | undefined
  let toDate: Date | undefined
  if (q.from) fromDate = new Date(String(q.from))
  if (q.to)   toDate   = new Date(String(q.to))
  if (!fromDate && !toDate) {
    const days = Math.max(1, Math.min(365, Number(q.days ?? 90)))
    toDate = new Date()
    fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000)
  }

  // 3) Buscar turnos del usuario dentro de la ventana
  const turnos = await prisma.turnoConductor.findMany({
    where: {
      id_usuario: idUsuario,
      ...(fromDate || toDate
        ? {
            // incluye si el turno se solapa con la ventana
            OR: [
              { hora_inicio: { gte: fromDate, lte: toDate } },
              { hora_fin:    { gte: fromDate, lte: toDate } },
              { AND: [{ hora_inicio: { lte: fromDate } }, { hora_fin: { gte: toDate } }] },
            ]
          }
        : {}
      )
    },
    select: {
      id_bus: true,
      bus: { select: { id_bus: true, patente: true, modelo: true } },
    },
    orderBy: { hora_inicio: 'desc' },
  })

  // 4) Distintos buses
  const map = new Map<number, { id:number; label:string }>()
  for (const t of turnos) {
    const id = t.id_bus ?? t.bus?.id_bus
    if (!id) continue
    if (!map.has(id)) {
      const label = t.bus
        ? `${t.bus.patente}${t.bus.modelo ? ' - ' + t.bus.modelo : ''}`
        : String(id)
      map.set(id, { id, label })
    }
  }

  return { items: Array.from(map.values()) }
})
