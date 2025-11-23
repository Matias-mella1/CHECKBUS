import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const q = getQuery(event)

  let idUsuario =
    Number((event as any).context?.auth?.user?.id_usuario) ||
    Number((event as any).context?.auth?.user?.id) || 0
  if (!idUsuario && q.id_usuario) idUsuario = Number(q.id_usuario)
  if (!idUsuario) {
    throw createError({ statusCode: 401, message: 'No autenticado: falta id_usuario' })
  }

  // Filtros
  const where: any = { id_usuario: idUsuario }
  if (q.id_bus) where.id_bus = Number(q.id_bus)
  if (q.id_estado_incidente) where.id_estado_incidente = Number(q.id_estado_incidente)
  if (q.id_tipo_incidente) where.id_tipo_incidente = Number(q.id_tipo_incidente)
  if (q.from) where.fecha = { gte: new Date(String(q.from)) }
  if (q.to) {
    where.fecha = { ...(where.fecha || {}), lte: new Date(String(q.to)) }
  }

  // Paginación
  const take = Math.min(Number(q.limit ?? 50), 100)
  const page = Math.max(Number(q.page ?? 1), 1)
  const skip = (page - 1) * take

  const rows = await prisma.incidente.findMany({
    where,
    include: {
      bus: { select: { id_bus: true, patente: true, modelo: true } },
      tipo: { select: { nombre_tipo: true } },
      estado: { select: { nombre_estado: true } },
    },
    orderBy: { fecha: 'desc' },
    skip,
    take,
  })

  return {
    items: rows.map((r) => ({
      id: r.id_incidente,
      id_usuario: r.id_usuario,
      id_bus: r.id_bus ?? r.bus?.id_bus ?? null,
      fecha: r.fecha ? new Date(r.fecha).toISOString().slice(0, 10) : null,
      urgencia: r.urgencia ?? null,
      ubicacion: r.ubicacion ?? null,
      descripcion: r.descripcion ?? null,
      bus: r.bus
        ? `${r.bus.patente}${r.bus.modelo ? ' - ' + r.bus.modelo : ''}`
        : '—',
      tipo: r.tipo?.nombre_tipo ?? null,
      estado: r.estado?.nombre_estado ?? null,
    })),
    page,
    limit: take,
  }
})
