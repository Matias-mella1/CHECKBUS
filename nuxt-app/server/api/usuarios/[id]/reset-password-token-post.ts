// server/api/usuarios/[id]/reset-password-token-post.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import crypto from 'crypto'
import { sendPasswordResetEmail } from '../../../../server/utils/mailer-resend'

export default defineEventHandler(async (event) => {
  try {
    const idParam = getRouterParam(event, 'id')
    const id = Number(idParam)

    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID inválido.' })
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
    })

    if (!usuario) {
      throw createError({ statusCode: 404, message: 'Usuario no encontrado.' })
    }

    // Generar nuevo token
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Guardar token (eliminar anteriores y crear uno nuevo)
    await prisma.$transaction(async (tx) => {
      await tx.tokenRestablecimiento.deleteMany({
        where: { id_usuario: id },
      })

      await tx.tokenRestablecimiento.create({
        data: {
          codigo_token: token,
          id_usuario: id,
          fecha_expiracion: expira,
        },
      })
    })

    // Enviar correo
    await sendPasswordResetEmail({
      to: usuario.email,
      nombre: usuario.nombre,
      username: usuario.username,
      token,
    })

    return { ok: true, message: 'Correo de restablecimiento enviado.' }
  } catch (err: any) {
    console.error('Error en reset-password-token-post:', err)

    if (err?.statusCode) throw err

    throw createError({
      statusCode: 500,
      message: 'Error al generar el token o enviar el correo.',
    })
  }
})
