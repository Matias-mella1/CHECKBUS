// server/api/usuarios/index.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery } from 'h3'

const ESTADOS_VALIDOS = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'PENDIENTE'] as const

export default defineEventHandler(async (event) => {
  const q = getQuery(event) as any
  const where: any = {}

  // 🔎 Búsqueda por texto
  if (q.q) {
    const text = String(q.q).trim()
    where.OR = [
      { nombre:   { contains: text, mode: 'insensitive' } },
      { apellido: { contains: text, mode: 'insensitive' } },
      { email:    { contains: text, mode: 'insensitive' } },
      { username: { contains: text, mode: 'insensitive' } },
    ]
  }

  // 🎨 Filtro por estado
  if (q.estado && ESTADOS_VALIDOS.includes(q.estado)) {
    where.estado_usuario = { nombre_estado: q.estado }
  }

  // 🎭 Filtro por rol (solo roles vigentes/activos)
  if (q.rol) {
    where.roles = {
      some: {
        estado: { in: ['VIGENTE', 'ACTIVO'] },
        rol: { nombre_rol: q.rol },
      },
    }
  }

  // 📄 Paginación
  const page = q.page ? Math.max(1, Number(q.page)) : 1
  const pageSize = q.pageSize ? Math.max(1, Number(q.pageSize)) : 10
  const skip = (page - 1) * pageSize

  const [total, usuarios] = await prisma.$transaction([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      include: {
        estado_usuario: true,
        roles: { include: { rol: true } },
        turnos: true,
        documentos: true,
        alertas: true,
        incidentes: true,
      },
      orderBy: { id_usuario: 'asc' },
      skip,
      take: pageSize,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items: usuarios.map((u) => ({
      id: u.id_usuario,
      rut: u.rut,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      username: u.username,
      telefono: u.telefono ?? '',
      licencia: u.licencia_con ?? '',
      estado: u.estado_usuario?.nombre_estado ?? '',
      roles: u.roles
        .filter((x) => ['VIGENTE', 'ACTIVO'].includes((x.estado || '').toUpperCase()))
        .map((x) => x.rol.nombre_rol),
      turnosCount: u.turnos.length,
      documentosCount: u.documentos.length,
      alertasCount: u.alertas.length,
      incidentesCount: u.incidentes.length,
    })),
    page,
    pageSize,
    total,
    totalPages,
  }
})
