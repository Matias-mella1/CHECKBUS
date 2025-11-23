// server/api/turnos/usuarios-disponibles.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery, createError, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const q = getQuery(event)
  const inicioStr = q.inicio as string | undefined
  const finStr    = q.fin    as string | undefined

  if (!inicioStr || !finStr) {
    throw createError({ statusCode: 400, message: 'Debe enviar inicio y fin' })
  }

  const inicio = new Date(inicioStr)
  const fin    = new Date(finStr)

  if (!(inicio < fin)) {
    throw createError({ statusCode: 400, message: 'Inicio debe ser menor que fin' })
  }

  const ESTADOS_OCUPA = ['ASIGNADO', 'EN_CURSO', 'ACTIVO', 'PENDIENTE']

  const usuarios = await prisma.usuario.findMany({
    where: {
      // 👈 OJO: cambia "turnos" por el nombre real de la relación en tu schema
      turnos: {
        none: {
          hora_inicio: { lt: fin },
          hora_fin:    { gt: inicio },
          estado: {
            nombre_estado: { in: ESTADOS_OCUPA },
          },
        },
      },
    },
    select: { id_usuario: true, nombre: true, apellido: true },
    orderBy: { nombre: 'asc' },
  })

  return {
    usuarios: usuarios.map(u => ({
      id: u.id_usuario,
      nombre: [u.nombre, u.apellido].filter(Boolean).join(' '),
    })),
  }
})
