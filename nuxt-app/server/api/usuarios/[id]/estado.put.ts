// server/api/usuarios/[id]/estado.put.ts
import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'

type EstadoNombre = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'PENDIENTE'
const ESTADOS_VALIDOS: EstadoNombre[] = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'PENDIENTE']

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID inválido' })

  const body = await readBody<{ estado?: EstadoNombre }>(event)
  const nuevoEstado = body.estado

  if (!nuevoEstado || !ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw createError({ statusCode: 400, message: 'Estado inválido' })
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    include: { roles: true },
  })
  if (!usuario) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  if (nuevoEstado === 'ACTIVO') {
    const tieneRolVigente = usuario.roles.some(
      (r) => (r.estado || '').toUpperCase() === 'VIGENTE'
    )
    if (!tieneRolVigente) {
      throw createError({
        statusCode: 400,
        message: 'No puedes activar un usuario sin roles vigentes.',
      })
    }
  }

  const estadoRow = await prisma.estadoUsuario.findFirst({
    where: { nombre_estado: nuevoEstado },
  })
  if (!estadoRow) {
    throw createError({
      statusCode: 500,
      message: `El estado ${nuevoEstado} no existe en BD`,
    })
  }

  await prisma.usuario.update({
    where: { id_usuario: id },
    data: {
      estado_usuario: {
        connect: { id_estado_usuario: estadoRow.id_estado_usuario },
      },
    },
  })

  return { ok: true, estado: nuevoEstado }
})
