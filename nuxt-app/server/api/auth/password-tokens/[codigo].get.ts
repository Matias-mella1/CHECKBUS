// server/api/auth/password-tokens/[codigo].get.ts
import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const codigo = String(getRouterParam(event, 'codigo') || '')
  if (!codigo) {
    throw createError({ statusCode: 400, message: 'Token requerido' })
  }

  const row = await prisma.tokenRestablecimiento.findUnique({
    where: { codigo_token: codigo },
    include: {
      usuario: { include: { estado_usuario: true } },
    },
  })

  if (!row) throw createError({ statusCode: 404, message: 'Token inválido' })
  if (row.fecha_expiracion < new Date()) throw createError({ statusCode: 410, message: 'Token expirado' })
  if (row.fecha_uso) throw createError({ statusCode: 409, message: 'Token ya utilizado' })

  return {
    ok: true,
    id_usuario: row.id_usuario,
    estado_usuario: row.usuario?.estado_usuario?.nombre_estado ?? null,
  }
})
