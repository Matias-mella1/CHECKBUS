// server/api/turnos/[id].delete.ts
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID inválido' })

  await prisma.turnoConductor.delete({ where: { id_turno: id } })
  return { ok: true }
})
