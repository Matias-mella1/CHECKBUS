import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { TallerQuerySchema } from '../../schemas/taller'

function collectErrors(issues:any[]) {
  return issues.map(i => i.message).join(' | ')
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const parsed = safeParse(TallerQuerySchema, query)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: collectErrors(parsed.issues)
    })
  }

  const { id_tipo_taller, q } = parsed.output

  const where:any = {}
  if (id_tipo_taller) where.id_tipo_taller = id_tipo_taller
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { contacto: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { tipo_taller: { nombre_tipo: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const rows = await prisma.taller.findMany({
    where,
    orderBy: { nombre:'asc' },
    include: {
      tipo_taller: true,
      _count: { select:{ mecanicos:true, mantenimientos:true } }
    }
  })

  return { items: rows }
})
