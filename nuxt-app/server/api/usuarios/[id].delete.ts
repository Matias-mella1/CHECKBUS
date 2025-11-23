// server/api/usuarios/[id].delete.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID inválido' })

  try {
    await prisma.usuarioRol.deleteMany({ where: { id_usuario: id } })
    await prisma.usuario.delete({ where: { id_usuario: id } })

    return { ok: true }
  } catch (err: any) {
    if (err?.code === 'P2003') {
      throw createError({
        statusCode: 409,
        message:
          'No se puede eliminar: el usuario tiene registros relacionados (turnos, incidentes, etc.)',
      })
    }
    if (err?.statusCode) throw err
    console.error('Error eliminando usuario:', err)
    throw createError({ statusCode: 500, message: 'Error eliminando usuario' })
  }
})
