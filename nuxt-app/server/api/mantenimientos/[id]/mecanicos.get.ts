// server/api/mantenimientos/[id]/mecanicos.get.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const id_mantenimiento = Number(idRaw)

  if (!id_mantenimiento || Number.isNaN(id_mantenimiento)) {
    throw createError({ statusCode: 400, message: 'ID de mantenimiento inválido' })
  }

  const mant = await prisma.mantenimiento.findUnique({
    where: { id_mantenimiento },
    include: {
      mecanicos: {
        include: {
          mecanico: {
            include: {
              taller: {
                select: { id_taller: true, nombre: true },
              },
            },
          },
        },
      },
    },
  })

  if (!mant) {
    throw createError({ statusCode: 404, message: 'Mantenimiento no encontrado' })
  }

  const items = mant.mecanicos.map((mm) => ({
    id_mecanico: mm.id_mecanico,
    id_mantenimiento: mm.id_mantenimiento,
    actividad: mm.actividad ?? '',
    mecanico: {
      id_mecanico: mm.mecanico.id_mecanico,
      nombre: mm.mecanico.nombre,
      apellido: mm.mecanico.apellido,
      id_taller: mm.mecanico.id_taller,
      taller: mm.mecanico.taller ? {
        id_taller: mm.mecanico.taller.id_taller,
        nombre: mm.mecanico.taller.nombre,
      } : null,
    },
  }))

  return { items }
})
