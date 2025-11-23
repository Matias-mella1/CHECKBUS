import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'

type Body = {
  id_repuesto: number
  cantidad?: number
}

async function recomputeCostosMantenimiento (id_mantenimiento: number) {
  const [mant, lineas] = await Promise.all([
    prisma.mantenimiento.findUnique({ where: { id_mantenimiento } }),
    prisma.repuestoMantenimiento.findMany({
      where: { id_mantenimiento },
      include: { repuesto: true },
    })
  ])

  if (!mant) return

  const totalRepuestos = lineas.reduce((acc, rm) => {
    const costoUnit = Number(rm.repuesto.costo ?? 0)
    return acc + costoUnit * rm.cantidad
  }, 0)

  const manoObra = Number(mant.costo_mano_obra ?? 0)

  await prisma.mantenimiento.update({
    where: { id_mantenimiento },
    data: {
      costo_repuestos: totalRepuestos,
      costo_total: manoObra + totalRepuestos,
    },
  })
}

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const id_mantenimiento = Number(idRaw)

  if (!id_mantenimiento || Number.isNaN(id_mantenimiento)) {
    throw createError({ statusCode: 400, message: 'ID de mantenimiento inválido' })
  }

  const body = (await readBody(event)) as Body

  const id_repuesto = Number(body.id_repuesto)
  const cantidad = body.cantidad != null ? Number(body.cantidad) : 1

  if (!id_repuesto || Number.isNaN(id_repuesto)) {
    throw createError({ statusCode: 400, message: 'ID de repuesto inválido' })
  }
  if (cantidad <= 0) {
    throw createError({ statusCode: 400, message: 'La cantidad debe ser mayor a 0' })
  }

  const [mant, rep] = await Promise.all([
    prisma.mantenimiento.findUnique({ where: { id_mantenimiento } }),
    prisma.repuesto.findUnique({ where: { id_repuesto } }),
  ])

  if (!mant) throw createError({ statusCode: 404, message: 'Mantenimiento no encontrado' })
  if (!rep)  throw createError({ statusCode: 400, message: 'Repuesto no existe' })

  const link = await prisma.repuestoMantenimiento.upsert({
    where: {
      id_repuesto_id_mantenimiento: {
        id_repuesto,
        id_mantenimiento,
      },
    },
    update: { cantidad },
    create: {
      id_repuesto,
      id_mantenimiento,
      cantidad,
    },
    include: {
      repuesto: {
        include: {
          estado: true,
          tipo: true,
          proveedor: true,
        },
      },
    },
  })

  // recalcular costos
  await recomputeCostosMantenimiento(id_mantenimiento)

  return {
    item: {
      id_repuesto: link.id_repuesto,
      id_mantenimiento: link.id_mantenimiento,
      cantidad: link.cantidad,
      repuesto: {
        id_repuesto: link.repuesto.id_repuesto,
        nombre: link.repuesto.nombre,
        descripcion: link.repuesto.descripcion ?? '',
        costo: Number(link.repuesto.costo),
        estado: link.repuesto.estado?.nombre_estado ?? '',
        tipo: link.repuesto.tipo?.nombre_tipo ?? '',
        proveedor: link.repuesto.proveedor?.nombre ?? '',
      },
    },
  }
})
