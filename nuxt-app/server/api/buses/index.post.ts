// server/api/buses/index.post.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { busSchema } from '../../schemas/bus'
import { defineEventHandler, readBody, createError } from 'h3'
import { toDateOrNull } from '../../utils/date'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const result = safeParse(busSchema, body)

    if (!result.success) {
      throw createError({ statusCode: 400, message: result.issues[0].message })
    }

    const data = result.output

    const estado = await prisma.estadoBus.findFirst({
      where: { nombre_estado: data.estado },
    })

    if (!estado) {
      throw createError({ statusCode: 400, message: 'Estado inválido.' })
    }

    const bus = await prisma.bus.create({
      data: {
        patente: data.patente.toUpperCase(),
        marca: data.marca ?? null,
        modelo: data.modelo ?? null,
        combustible: data.combustible ?? null,
        anio: data.anio ?? null, 
        kilometraje: data.kilometraje ?? 0, 
        capacidad: data.capacidad ?? null,
        fecha_revision_tecnica: toDateOrNull(data.fechaRevisionTecnica), 
        fecha_extintor: toDateOrNull(data.fechaExtintor),
        id_estado_bus: estado.id_estado_bus,
      },
    })

    return { item: bus }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({
        statusCode: 409,
        message: '🛑 Error: Ya existe un bus registrado con esa patente.',
      })
    }
    throw err
  }
})
