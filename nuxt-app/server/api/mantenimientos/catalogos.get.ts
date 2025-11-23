import { prisma } from '../../utils/prisma'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  const [buses, talleres, tipos, estados] = await Promise.all([
    prisma.bus.findMany({
      where: {
        NOT: {
          OR: [
            {
              estado_bus: {
                nombre_estado: { equals: 'MANTENIMIENTO', mode: 'insensitive' },
              },
            },
            {
              estado_bus: {
                nombre_estado: { equals: 'EN MANTENCIÓN', mode: 'insensitive' },
              },
            },
          ],
        },
      },
      select: { id_bus: true, patente: true },
      orderBy: { id_bus: 'asc' },
    }),

    prisma.taller.findMany({
      select: { id_taller: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),

    prisma.tipoMantenimiento.findMany({
      select: { id_tipo_mantenimiento: true, nombre_tipo: true },
      orderBy: { nombre_tipo: 'asc' },
    }),

    prisma.estadoMantenimiento.findMany({
      select: { id_estado_mantenimiento: true, nombre_estado: true },
      orderBy: { nombre_estado: 'asc' },
    }),
  ])

  return { buses, talleres, tipos, estados }
})
