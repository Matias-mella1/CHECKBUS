// server/api/auth/password-tokens/[codigo].post.ts
import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getRouterParam, readBody, createError, setHeader } from 'h3'
import { hashPassword } from '../../../utils/password'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const codigo = String(getRouterParam(event, 'codigo') || '')
  const body = await readBody<{ password?: string }>(event)
  const pw = (body?.password || '').trim()

  if (!codigo) {
    throw createError({ statusCode: 400, message: 'Token requerido' })
  }
  if (pw.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'La contraseña debe tener al menos 8 caracteres',
    })
  }

  // 1) Buscar token + usuario
  const token = await prisma.tokenRestablecimiento.findUnique({
    where: { codigo_token: codigo },
    include: {
      usuario: {
        include: { estado_usuario: true },
      },
    },
  })

  if (!token) throw createError({ statusCode: 404, message: 'Token inválido' })
  if (token.fecha_expiracion < new Date()) throw createError({ statusCode: 410, message: 'Token expirado' })
  if (token.fecha_uso) throw createError({ statusCode: 409, message: 'Token ya utilizado' })

  const usuario = token.usuario
  if (!usuario) throw createError({ statusCode: 404, message: 'Usuario no encontrado para este token' })

  // 2) Buscar estado ACTIVO
  const estadoActivo = await prisma.estadoUsuario.findFirst({
    where: { nombre_estado: 'ACTIVO' },
  })
  if (!estadoActivo) {
    throw createError({ statusCode: 500, message: 'Estado ACTIVO no existe en BD' })
  }

  const password_hash = await hashPassword(pw)

  console.log(
    '[password-tokens] activando usuario',
    usuario.id_usuario,
    'estado antes:',
    usuario.estado_usuario?.nombre_estado,
  )

  // 3) Transacción: actualizar password + estado + marcar token usado
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id_usuario: token.id_usuario },
      data: {
        password_hash,
        estado_usuario: {
          connect: { id_estado_usuario: estadoActivo.id_estado_usuario },
        },
      },
    }),
    prisma.tokenRestablecimiento.update({
      where: { codigo_token: codigo },
      data: { fecha_uso: new Date() },
    }),
  ])

  return { ok: true, message: 'Contraseña actualizada y cuenta activada.' }
})
