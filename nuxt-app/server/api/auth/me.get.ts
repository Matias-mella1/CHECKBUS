// server/api/auth/me.get.ts
import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
import jwt from 'jsonwebtoken'
import { prisma } from '../../utils/prisma'

const SECRET = process.env.JWT_SECRET || 'super-secret-key'

export default defineEventHandler(async (event) => {
  try {
    const token = getCookie(event, 'auth_token')
    if (!token) {
      setResponseStatus(event, 401)
      return { user: null }
    }

    const decoded = jwt.verify(token, SECRET)
    if (typeof decoded !== 'object' || decoded === null) {
      setResponseStatus(event, 401)
      return { user: null }
    }

    const payload = decoded as any

    const u = await prisma.usuario.findUnique({
      where: { id_usuario: payload.sub },
      include: {
        roles: { include: { rol: true } },
        estado_usuario: true,
      },
    })

    if (!u) {
      setResponseStatus(event, 401)
      return { user: null }
    }

    const roles = u.roles
      .filter(r => ['VIGENTE', 'ACTIVO'].includes((r.estado || '').toUpperCase()))
      .map(r => r.rol.nombre_rol)

    return {
      user: {
        id: u.id_usuario,
        nombre: u.nombre,
        username: u.username,
        estado: u.estado_usuario?.nombre_estado || null,
        roles,
      },
    }
  } catch (e) {
    console.error('auth/me ERROR:', e)
    setResponseStatus(event, 401)
    return { user: null }
  }
})
