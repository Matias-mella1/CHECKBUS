import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import {  MecanicoCreateSchema } from '../../schemas/mecanico'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const parsed = safeParse(MecanicoCreateSchema, body)
    if (!parsed.success) {
      const msg = parsed.issues.map(i => i.message).join(', ')
      throw createError({ statusCode: 400, message: msg })
    }
    const data = parsed.output

    const taller = await prisma.taller.findUnique({
      where: { id_taller: data.id_taller },
    })
    if (!taller) {
      throw createError({ statusCode: 400, message: 'Taller no existe' })
    }

    const m = await prisma.mecanico.create({
      data: {
        id_taller: data.id_taller,
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
      },
    })

    return { id_mecanico: m.id_mecanico }
  } catch (err: any) {
    if (err?.code === 'P2003') {
      throw createError({ statusCode: 400, message: 'Taller inválido' })
    }
    if (err?.statusCode) throw err
    console.error('POST /api/mecanicos error:', err)
    throw createError({ statusCode: 500, message: 'Error creando mecánico' })
  }
})
