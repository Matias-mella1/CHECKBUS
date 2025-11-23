// server/api/conductor/index.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery, setHeader } from 'h3'

type ConductorEstado = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'PENDIENTE'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const query = getQuery(event)
  const q = query.q?.toString().trim() || ''
  const estado = (query.estado?.toString().trim().toUpperCase() ||
    '') as ConductorEstado | ''

  // 📄 PAGINACIÓN: page y pageSize desde query
  const rawPage = query.page ? Number(query.page) : 1
  const rawPageSize = query.pageSize ? Number(query.pageSize) : 10

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  // limitamos tamaño de página entre 1 y 100 para no matar la BD
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, 100)
    : 10

  const skip = (page - 1) * pageSize

  const incluirPropietario =
    query.incluirPropietario === true ||
    query.incluirPropietario === 'true' ||
    query.incluirPropietario === '1'

  const rolesDeseados = incluirPropietario
    ? ['CONDUCTOR', 'PROPIETARIO']
    : ['CONDUCTOR']

  const where: any = {
    roles: {
      some: {
        estado: { in: ['VIGENTE', 'ACTIVO'] },
        rol: {
          OR: rolesDeseados.map((nombre) => ({
            nombre_rol: { equals: nombre, mode: 'insensitive' },
          })),
        },
      },
    },
  }

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { apellido: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { telefono: { contains: q, mode: 'insensitive' } },
      { licencia_con: { contains: q, mode: 'insensitive' } },
      { rut: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (estado === 'ACTIVO' || estado === 'INACTIVO') {
    where.estado_usuario = { is: { nombre_estado: estado } }
  }

  // 1️⃣ total de conductores que cumplen filtro
  const total = await prisma.usuario.count({ where })

  // 2️⃣ página actual
  const rows = await prisma.usuario.findMany({
    where,
    include: {
      estado_usuario: true,
      roles: { include: { rol: true } },
    },
    orderBy: { id_usuario: 'asc' },
    skip,
    take: pageSize,
  })

  const items = rows.map((u) => ({
    id: u.id_usuario,
    rut: u.rut ?? '',
    nombre: [u.nombre, u.apellido].filter(Boolean).join(' '),
    email: u.email ?? '',
    telefono: u.telefono ?? '',
    licencia: u.licencia_con ?? '',
    estado: (u.estado_usuario?.nombre_estado || '').toUpperCase(),
    roles: (u.roles || [])
      .filter((r) => ['VIGENTE', 'ACTIVO'].includes((r.estado || '').toUpperCase()))
      .map((r) => r.rol?.nombre_rol)
      .filter(Boolean) as string[],
  }))

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
  }
})
