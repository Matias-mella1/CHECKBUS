import { hash, compare } from 'bcrypt'
import { defineEventHandler, readBody, sendError, createError } from 'h3'
import {prisma} from '../../utils/prisma'   

export default defineEventHandler(async (event) => {

  // Usuario no logueado
  const userId = event.context.user?.id
  if (!userId) {
    return sendError(event, createError({
      statusCode: 401,
      statusMessage: 'No autorizado'
    }))
  }

  // Datos enviados
  const { currentPassword, newPassword } = await readBody(event)

  if (!currentPassword || !newPassword) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: 'Faltan parámetros'
    }))
  }

  // Buscar usuario
  const user = await prisma.usuario.findUnique({
    where: {id_usuario: userId }
  })

  if (!user) {
    return sendError(event, createError({
      statusCode: 404,
      statusMessage: 'Usuario no encontrado'
    }))
  }

  // Comparar contraseña actual
  const valid = await compare(currentPassword, user.password_hash)

  if (!valid) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: 'La contraseña actual es incorrecta'
    }))
  }

  // Generar hash para la nueva contraseña
  const newHash = await hash(newPassword, 10)

  // Guardar nueva contraseña
  await prisma.usuario.update({
    where: { id_usuario: userId },
    data: { password_hash: newHash }
  })

  return {
    ok: true,
    message: 'Contraseña actualizada correctamente.'
  }
})
