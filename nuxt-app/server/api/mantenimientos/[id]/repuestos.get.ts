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
      repuestos: {
        include: {
          repuesto: {
            include: {
              estado: true,
              tipo: true,
              proveedor: true,
            },
          },
        },
      },
    },
  })

  if (!mant) {
    throw createError({ statusCode: 404, message: 'Mantenimiento no encontrado' })
  }

  const items = mant.repuestos.map((rm) => ({
    id_repuesto: rm.id_repuesto,
    id_mantenimiento: rm.id_mantenimiento,
    cantidad: rm.cantidad,
    repuesto: {
      id_repuesto: rm.repuesto.id_repuesto,
      nombre: rm.repuesto.nombre,
      descripcion: rm.repuesto.descripcion ?? '',
      costo: Number(rm.repuesto.costo),
      estado: rm.repuesto.estado?.nombre_estado ?? '',
      tipo: rm.repuesto.tipo?.nombre_tipo ?? '',
      proveedor: rm.repuesto.proveedor?.nombre ?? '',
    },
  }))

  return { items }
})
