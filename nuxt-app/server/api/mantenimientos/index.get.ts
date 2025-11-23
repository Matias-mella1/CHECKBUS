import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery } from 'h3'
import { toDateOrNull } from '../../utils/date'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  const where: any = {}

  if (q.q) {
    where.OR = [
      { observaciones: { contains: q.q as string, mode: 'insensitive' } },
      { tipo:   { nombre_tipo: { contains: q.q as string, mode: 'insensitive' } } },
      { estado: { nombre_estado: { contains: q.q as string, mode: 'insensitive' } } },
      { taller: { nombre: { contains: q.q as string, mode: 'insensitive' } } },
    ]
  }

  if (q.id_bus)                 where.id_bus = Number(q.id_bus)
  if (q.id_taller)              where.id_taller = Number(q.id_taller)
  if (q.id_tipo_mantenimiento)  where.id_tipo_mantenimiento = Number(q.id_tipo_mantenimiento)
  if (q.id_estado_mantenimiento) where.id_estado_mantenimiento = Number(q.id_estado_mantenimiento)

  if (q.from || q.to) {
    where.fecha = {}
    if (q.from) where.fecha.gte = toDateOrNull(q.from as string)
    if (q.to)   where.fecha.lte = toDateOrNull(q.to as string)
  }

  const rows = await prisma.mantenimiento.findMany({
    where,
    include: {
      bus:    { select: { id_bus: true, patente: true } },
      taller: { select: { id_taller: true, nombre: true } },
      tipo:   { select: { id_tipo_mantenimiento: true, nombre_tipo: true } },
      estado: { select: { id_estado_mantenimiento: true, nombre_estado: true } },
    },
    orderBy: { id_mantenimiento: 'desc' },
  })

  const items = rows.map((r) => {
    const costoManoObra  = Number(r.costo_mano_obra ?? 0)
    const costoRepuestos = Number(r.costo_repuestos ?? 0)
    const costoTotal     = Number(r.costo_total ?? (costoManoObra + costoRepuestos))

    return {
      ...r,
      // para la tabla:
      costo: costoTotal,
      // desglose para el front:
      costo_mano_obra: costoManoObra,
      costo_repuestos: costoRepuestos,
      costo_total: costoTotal,
    }
  })

  return { items }
})
