import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { TallerUpdateSchema } from '../../schemas/taller'

function collectErrors(issues:any[]) {
  return issues.map(i => i.message).join(' | ')
}

export default defineEventHandler(async (event) => {
  try {
    const id = Number(getRouterParam(event, 'id'))
    if (!id) throw createError({ statusCode: 400, message: 'ID inválido.' })

    const parsed = safeParse(TallerUpdateSchema, await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        message: collectErrors(parsed.issues)
      })
    }

    const data = parsed.output

    const exists = await prisma.taller.findUnique({ where: { id_taller:id } })
    if (!exists) throw createError({ statusCode:404, message:'Taller no encontrado.' })

    if (data.id_tipo_taller) {
      const tipo = await prisma.tipoTaller.findUnique({ where:{ id_tipo_taller:data.id_tipo_taller } })
      if (!tipo) throw createError({ statusCode:400, message:'Tipo de taller no existe.' })
    }

    const upd = await prisma.taller.update({
      where:{ id_taller:id }, data
    })

    return { ok:true, id_taller:upd.id_taller }

  } catch (err:any) {
    if (err?.statusCode) throw err
    console.error('PUT talleres:', err)
    throw createError({ statusCode:500, message:'Error actualizando taller' })
  }
})
