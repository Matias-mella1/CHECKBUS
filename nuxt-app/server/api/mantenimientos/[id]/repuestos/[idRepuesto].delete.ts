import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'

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
  const mantRaw = getRouterParam(event, 'id')
  const repRaw = getRouterParam(event, 'idRepuesto')

  const id_mantenimiento = Number(mantRaw)
  const id_repuesto = Number(repRaw)

  if (!id_mantenimiento || Number.isNaN(id_mantenimiento)) {
    throw createError({ statusCode: 400, message: 'ID de mantenimiento inválido' })
  }
  if (!id_repuesto || Number.isNaN(id_repuesto)) {
    throw createError({ statusCode: 400, message: 'ID de repuesto inválido' })
  }

  try {
    await prisma.repuestoMantenimiento.delete({
      where: {
        id_repuesto_id_mantenimiento: {
          id_repuesto,
          id_mantenimiento,
        },
      },
    })

    await recomputeCostosMantenimiento(id_mantenimiento)
  } catch (e: any) {
    if (e?.code === 'P2025') {
      throw createError({ statusCode: 404, message: 'Relación mantenimiento–repuesto no encontrada' })
    }
    throw createError({ statusCode: 500, message: 'Error eliminando repuesto del mantenimiento' })
  }

  return { ok: true }
})
