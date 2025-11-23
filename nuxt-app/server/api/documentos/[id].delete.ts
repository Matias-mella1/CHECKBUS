// server/api/bus/[id].delete.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getRouterParam, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }

  try {
    await prisma.documento.delete({ where: { id_documento: id } })
  } catch (e: any) {
    if (e?.code === 'P2003') {
      throw createError({
        statusCode: 400,
        message:
          'No se puede eliminar',
      })
    }
    throw e
  }

  return { ok: true }
})
