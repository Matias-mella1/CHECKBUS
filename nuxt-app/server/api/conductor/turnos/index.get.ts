// server/api/conductor/turnos.get.ts
import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getQuery, createError, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event)

  const id_usuario = q.id_usuario ? Number(q.id_usuario) : undefined
  const from = q.from as string | undefined
  const to   = q.to   as string | undefined

  if (!id_usuario) {
    throw createError({ statusCode: 400, message: 'Falta id_usuario' })
  }

  const where: any = { id_usuario }

  if (from || to) {
    where.hora_inicio = {}
    if (from) where.hora_inicio.gte = new Date(from)
    if (to)   where.hora_inicio.lte = new Date(to)
  }

  const rows = await prisma.turnoConductor.findMany({
    where,
    include: { bus: true, estado: true },
    orderBy: { hora_inicio: 'desc' },
  })

  const items = rows.map(t => ({
    id: t.id_turno,
    id_usuario: t.id_usuario,
    fecha: t.fecha,
    hora_inicio: t.hora_inicio,
    hora_fin: t.hora_fin,
    bus: t.bus ? t.bus.patente : null,
    estado: t.estado?.nombre_estado ?? null,
    titulo: t.titulo,
    descripcion: t.descripcion,
    ruta_origen: t.ruta_origen,
    ruta_fin: t.ruta_fin,
  }))

  return { items }
})
