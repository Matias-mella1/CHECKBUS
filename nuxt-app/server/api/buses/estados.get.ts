import { prisma } from '../../utils/prisma'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  const rows = await prisma.estadoBus.findMany({
    orderBy: { nombre_estado: 'asc' },
  })
  return { items: rows.map(r => r.nombre_estado) }
})
