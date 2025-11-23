import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { hashPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token: string; newPassword: string }>(event)
  if (!body.token || !body.newPassword) {
    throw createError({ statusCode: 400, message: 'Datos incompletos' })
  }

  // Buscar el token
  const tokenRecord = await prisma.tokenRestablecimiento.findFirst({
    where: { codigo_token: body.token },
    include: { usuario: true },
  })

  // Validar token
  if (!tokenRecord || tokenRecord.fecha_expiracion < new Date()) {
    throw createError({ statusCode: 400, message: 'Token inválido o expirado' })
  }

  // Hash de nueva contraseña
  const newHash = await hashPassword(body.newPassword)

  // Actualizar usuario
  await prisma.usuario.update({
    where: { id_usuario: tokenRecord.id_usuario },
    data: { password_hash: newHash },
  })

  // Eliminar token usado
  await prisma.tokenRestablecimiento.delete({
    where: { codigo_token: body.token },
  })

  return { message: 'Contraseña actualizada correctamente.' }
})
