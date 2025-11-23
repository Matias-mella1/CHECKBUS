import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { TallerCreateSchema } from '../../schemas/taller'

function collectErrors(issues:any[]) {
  return issues.map(i => i.message).join(' | ')
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const parsed = safeParse(TallerCreateSchema, body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: collectErrors(parsed.issues)
      })
    }

    const data = parsed.output

    // verificar tipo
    const tipo = await prisma.tipoTaller.findUnique({
      where: { id_tipo_taller: data.id_tipo_taller }
    })
    if (!tipo)
      throw createError({ statusCode: 400, message: 'El tipo de taller no existe.' })

    const r = await prisma.taller.create({ data })
    return { id_taller: r.id_taller }

  } catch (err:any) {
    if (err?.statusCode) throw err
    console.error('POST talleres:', err)
    throw createError({ statusCode: 500, message: 'Error creando taller' })
  }
})
