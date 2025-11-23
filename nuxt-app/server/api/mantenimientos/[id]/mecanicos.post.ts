// server/api/mantenimientos/[id]/mecanicos.post.ts
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'

type Body = {
  id_mecanico: number
  actividad?: string | null
}

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const id_mantenimiento = Number(idRaw)

  if (!id_mantenimiento || Number.isNaN(id_mantenimiento)) {
    throw createError({ statusCode: 400, message: 'ID de mantenimiento inválido' })
  }

  const body = (await readBody(event)) as Body

  const id_mecanico = Number(body.id_mecanico)
  const actividad = body.actividad?.toString().trim() || null

  if (!id_mecanico || Number.isNaN(id_mecanico)) {
    throw createError({ statusCode: 400, message: 'ID de mecánico inválido' })
  }

  const [mant, mec] = await Promise.all([
    prisma.mantenimiento.findUnique({ where: { id_mantenimiento } }),
    prisma.mecanico.findUnique({ where: { id_mecanico } }),
  ])

  if (!mant) throw createError({ statusCode: 404, message: 'Mantenimiento no encontrado' })
  if (!mec) throw createError({ statusCode: 400, message: 'Mecánico no existe' })

  const link = await prisma.mecanicoMantenimiento.upsert({
    where: {
      id_mecanico_id_mantenimiento: {
        id_mecanico,
        id_mantenimiento,
      },
    },
    update: { actividad },
    create: {
      id_mecanico,
      id_mantenimiento,
      actividad,
    },
    include: {
      mecanico: {
        include: {
          taller: {
            select: { id_taller: true, nombre: true },
          },
        },
      },
    },
  })

  return {
    item: {
      id_mecanico: link.id_mecanico,
      id_mantenimiento: link.id_mantenimiento,
      actividad: link.actividad ?? '',
      mecanico: {
        id_mecanico: link.mecanico.id_mecanico,
        nombre: link.mecanico.nombre,
        apellido: link.mecanico.apellido,
        id_taller: link.mecanico.id_taller,
        taller: link.mecanico.taller
          ? { id_taller: link.mecanico.taller.id_taller, nombre: link.mecanico.taller.nombre }
          : null,
      },
    },
  }
})
