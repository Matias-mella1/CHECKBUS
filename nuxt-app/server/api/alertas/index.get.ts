// server/api/alertas/index.get.ts
import { prisma } from '../../utils/prisma'
import { getQuery, createError, defineEventHandler } from 'h3'
import { safeParse } from 'valibot'
import { ListaAlertaQueryDto } from '../../schemas/alerta'

export default defineEventHandler(async (event) => {
  const raw = getQuery(event)
  const parsed = safeParse(ListaAlertaQueryDto, raw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Parámetros inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const q = parsed.output

  const page = Number(q.page ?? 1)
  const pageSize = Number(q.pageSize ?? 30)
  const skip = (page - 1) * pageSize

  const where: any = {}

  if (q.q) {
    where.OR = [
      { titulo:      { contains: q.q, mode: 'insensitive' } },
      { descripcion: { contains: q.q, mode: 'insensitive' } },
    ]
  }

  if (q.id_estado_alerta) {
    where.id_estado_alerta = Number(q.id_estado_alerta)
  }

  if (q.id_tipo_alerta) {
    where.id_tipo_alerta = Number(q.id_tipo_alerta)
  }

  const [items, total] = await Promise.all([
    prisma.alerta.findMany({
      where,
      include: {
        estado: true,
        tipo: true,
        bus: true,
        usuario: true,
        documento: true,
        incidente: true,
        mantenimiento: true,
      },
      orderBy: { fecha_creacion: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.alerta.count({ where }),
  ])

  return { items, total, page, pageSize }
})
