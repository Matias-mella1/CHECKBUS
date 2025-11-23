// server/api/mecanicos/index.get.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { MecanicoQuerySchema } from '../../schemas/mecanico'

export default defineEventHandler(async (event) => {
  const qRaw: any = getQuery(event)

  // 👇 Normalizar id_taller: '', '2', 2 → number | undefined
  if (typeof qRaw.id_taller === 'string') {
    const raw = qRaw.id_taller.trim()

    if (raw === '') {
      // Si viene vacío, lo quitamos y no filtramos por taller
      delete qRaw.id_taller
    } else {
      const n = Number(raw)
      if (Number.isNaN(n)) {
        throw createError({
          statusCode: 400,
          message: 'El taller debe ser numérico.',
        })
      }
      qRaw.id_taller = n
    }
  }

  // (Por si acaso algún día ya viene como number pero 0 o NaN)
  if (typeof qRaw.id_taller === 'number') {
    if (!Number.isFinite(qRaw.id_taller) || qRaw.id_taller <= 0) {
      delete qRaw.id_taller
    }
  }

  // ✅ Ahora sí validamos con Valibot: id_taller es number | undefined
  const parsed = safeParse(MecanicoQuerySchema, qRaw)
  if (!parsed.success) {
    const msg = parsed.issues.map(i => i.message).join(', ')
    throw createError({ statusCode: 400, message: msg })
  }

  const { id_taller, q } = parsed.output

  const where: any = {}
  if (id_taller) where.id_taller = id_taller
  if (q) {
    const term = String(q).trim()
    if (term) {
      where.OR = [
        { nombre:   { contains: term, mode: 'insensitive' } },
        { apellido: { contains: term, mode: 'insensitive' } },
        {
          taller: {
            nombre: { contains: term, mode: 'insensitive' },
          },
        },
      ]
    }
  }

  const rows = await prisma.mecanico.findMany({
    where,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    include: { taller: { select: { id_taller: true, nombre: true } } },
  })

  return { items: rows }
})
