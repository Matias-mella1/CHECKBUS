import { prisma } from '../../../utils/prisma'
import { defineEventHandler, getQuery, setHeader, createError } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const q = getQuery(event)

  let idUsuario =
    Number((event as any).context?.auth?.user?.id_usuario) ||
    Number((event as any).context?.auth?.user?.id) || 0

  if (!idUsuario && q.id_usuario) idUsuario = Number(q.id_usuario)

  if (!idUsuario) {
    throw createError({ statusCode: 401, message: 'No autenticado: falta id_usuario' })
  }

  const where: any = { id_usuario: idUsuario }

  if (q.id_bus) where.id_bus = Number(q.id_bus)
  if (q.id_estado_alerta) where.id_estado_alerta = Number(q.id_estado_alerta)
  if (q.id_tipo_alerta) where.id_tipo_alerta = Number(q.id_tipo_alerta)

  // búsqueda por texto (titulo / descripcion)
  if (q.q) {
    const texto = String(q.q)
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { titulo: { contains: texto, mode: 'insensitive' } },
          { descripcion: { contains: texto, mode: 'insensitive' } },
        ],
      },
    ]
  }

  // rango de fechas (ajusta "fecha_creacion" al campo real)
  if (q.from) {
    where.fecha_creacion = { gte: new Date(String(q.from)) }
  }
  if (q.to) {
    where.fecha_creacion = {
      ...(where.fecha_creacion || {}),
      lte: new Date(String(q.to)),
    }
  }

  //  Paginacion (page + pageSize, como usas en mis-alertas.vue) ===
  const pageSize = Math.min(Number(q.pageSize ?? 10), 100)
  const page = Math.max(Number(q.page ?? 1), 1)
  const skip = (page - 1) * pageSize

  //  Consulta
  const [rows, total] = await Promise.all([
    prisma.alerta.findMany({
      where,
      include: {
        estado: {
          select: {
            id_estado_alerta: true,
            nombre_estado: true,
          },
        },
        tipo: {
          select: {
            id_tipo_alerta: true,
            nombre_tipo: true,
            categoria: true,
          },
        },
        bus: {
          select: {
            id_bus: true,
            patente: true,
          },
        },
        documento: {
          select: {
            id_documento: true,
            nombre_archivo: true,
          },
        },
        incidente: {
          select: {
            id_incidente: true,
          },
        },
        mantenimiento: {
          select: {
            id_mantenimiento: true,
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombre: true,
            email: true,
            rut: true,
          },
        },
      },
      orderBy: { fecha_creacion: 'desc' }, 
      skip,
      take: pageSize,
    }),
    prisma.alerta.count({ where }),
  ])

  return {
    items: rows,
    total,
    page,
    pageSize,
  }
})
