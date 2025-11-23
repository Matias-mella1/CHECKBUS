// server/api/buses/[id].put.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { busSchema } from '../../schemas/bus'
import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { toDateOrNull } from '../../utils/date'

export default defineEventHandler(async (event) => {
  try {
    const id = Number(getRouterParam(event, 'id'))
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID inválido.' })
    }

    const body = await readBody(event)
    const result = safeParse(busSchema, body)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.issues[0].message,
      })
    }

    const data = result.output

    const estado = await prisma.estadoBus.findFirst({
      where: { nombre_estado: data.estado },
    })

    if (!estado) {
      throw createError({ statusCode: 400, message: 'Estado inválido.' })
    }

    const bus = await prisma.bus.update({
      where: { id_bus: id },
      data: {
        patente: data.patente.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        combustible: data.combustible,
        anio: data.anio, // ✅ Recibe 'anio'
        kilometraje: data.kilometraje, // ✅ Recibe 'kilometraje'
        capacidad: data.capacidad,
        fecha_revision_tecnica: toDateOrNull(data.fechaRevisionTecnica), // ✅ Maneja null
        fecha_extintor: toDateOrNull(data.fechaExtintor), // ✅ Maneja null
        id_estado_bus: estado.id_estado_bus,
      },
    })

    return { item: bus }
  } catch (err: any) {
    if (err?.code === 'P2025') {
      throw createError({ statusCode: 404, message: 'Bus no encontrado.' })
    }
    throw err
  }
})
