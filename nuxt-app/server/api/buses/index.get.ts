// server/api/buses/index.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery } from 'h3'

type EstadoBus = 'OPERATIVO' | 'MANTENIMIENTO' | 'FUERA DE SERVICIO'

export default defineEventHandler(async (event) => {
  const { q = '', estado = '' } = getQuery(event) as {
    q?: string
    estado?: EstadoBus | string
  }

  const where: any = {}

  if (q) {
    where.OR = [
      { patente: { contains: q, mode: 'insensitive' } },
      { modelo: { contains: q, mode: 'insensitive' } },
      { marca: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (estado) {
    where.estado_bus = { nombre_estado: String(estado) }
  }

  const rows = await prisma.bus.findMany({
    where,
    include: { estado_bus: true },
    orderBy: { id_bus: 'asc' },
  })

  const todayYMD = new Date().toISOString().slice(0, 10)

  const items = rows.map((r) => {
    const fechaRev = r.fecha_revision_tecnica
      ? r.fecha_revision_tecnica.toISOString().slice(0, 10)
      : null

    const fechaExtintor = r.fecha_extintor
      ? r.fecha_extintor.toISOString().slice(0, 10)
      : null

    return {
      id: r.id_bus,
      plate: r.patente,
      model: r.modelo,
      brand: r.marca,
      fuel: r.combustible,
      year: r.anio,
      km: r.kilometraje ?? 0,
      capacidad: r.capacidad ?? 0,
      fechaRevisionTecnica: fechaRev,
      fechaExtintor,
      extintorVigente: !!fechaExtintor && fechaExtintor >= todayYMD,
      estado: r.estado_bus.nombre_estado as EstadoBus,
    }
  })

  return { items }
})
