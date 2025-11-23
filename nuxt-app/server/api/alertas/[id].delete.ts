import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)

  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  await prisma.alerta.delete({
    where: { id_alerta: id },
  })

  return { ok: true }
})
