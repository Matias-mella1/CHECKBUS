import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const tipos = await prisma.tipoTaller.findMany({
    orderBy: { nombre_tipo:'asc' }
  })
  return { tipos }
})
