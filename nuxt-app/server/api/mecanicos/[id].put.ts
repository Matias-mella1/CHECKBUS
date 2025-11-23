import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import {  MecanicoUpdateSchema } from '../../schemas/mecanico'

export default defineEventHandler(async (event) => {
  try {
    const id = Number(getRouterParam(event, 'id'))
    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID inválido' })
    }

    const parsed = safeParse(MecanicoUpdateSchema, await readBody(event))
    if (!parsed.success) {
      const msg = parsed.issues.map(i => i.message).join(', ')
      throw createError({ statusCode: 400, message: msg })
    }
    const data = parsed.output

    const exists = await prisma.mecanico.findUnique({
      where: { id_mecanico: id },
    })
    if (!exists) {
      throw createError({ statusCode: 404, message: 'Mecánico no encontrado' })
    }

    if (data.id_taller) {
      const taller = await prisma.taller.findUnique({
        where: { id_taller: data.id_taller },
      })
      if (!taller) {
        throw createError({ statusCode: 400, message: 'Taller no existe' })
      }
    }

    const updated = await prisma.mecanico.update({
      where: { id_mecanico: id },
      data: {
        ...(data.id_taller ? { id_taller: data.id_taller } : {}),
        ...(data.nombre    ? { nombre: data.nombre.trim() } : {}),
        ...(data.apellido  ? { apellido: data.apellido.trim() } : {}),
      },
    })

    return { ok: true, id_mecanico: updated.id_mecanico }
  } catch (err: any) {
    if (err?.code === 'P2003') {
      throw createError({ statusCode: 400, message: 'Taller inválido' })
    }
    if (err?.code === 'P2025') {
      throw createError({ statusCode: 404, message: 'Mecánico no encontrado' })
    }
    if (err?.statusCode) throw err
    console.error('PUT /api/mecanicos/[id] error:', err)
    throw createError({ statusCode: 500, message: 'Error actualizando mecánico' })
  }
})
