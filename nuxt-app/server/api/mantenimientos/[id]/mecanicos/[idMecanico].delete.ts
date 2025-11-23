// server/api/mantenimientos/[id]/mecanicos/[idMecanico].delete.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const mantRaw = getRouterParam(event, 'id')
  const mecRaw = getRouterParam(event, 'idMecanico')

  const id_mantenimiento = Number(mantRaw)
  const id_mecanico = Number(mecRaw)

  if (!id_mantenimiento || Number.isNaN(id_mantenimiento)) {
    throw createError({ statusCode: 400, message: 'ID de mantenimiento inválido' })
  }
  if (!id_mecanico || Number.isNaN(id_mecanico)) {
    throw createError({ statusCode: 400, message: 'ID de mecánico inválido' })
  }

  try {
    await prisma.mecanicoMantenimiento.delete({
      where: {
        id_mecanico_id_mantenimiento: {
          id_mecanico,
          id_mantenimiento,
        },
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      throw createError({ statusCode: 404, message: 'Relación mantenimiento–mecánico no encontrada' })
    }
    throw createError({ statusCode: 500, message: 'Error eliminando mecánico del mantenimiento' })
  }

  return { ok: true }
})
