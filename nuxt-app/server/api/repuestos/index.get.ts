// server/api/repuestos/index.get.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { RepuestoListaQueryDto } from '../../schemas/repuesto'
import {
  defineEventHandler,
  getQuery,
  setHeader,
  createError,
} from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const rawQuery = getQuery(event)
  const parsed = safeParse(RepuestoListaQueryDto, rawQuery)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Parámetros inválidos'
    throw createError({ statusCode: 400, message: msg })
  }
  const q = parsed.output

  // paginación
  const page = Number(q.page ?? 1) || 1
  const pageSize = Number(q.pageSize ?? 100) || 100
  const skip = (page - 1) * pageSize
  const take = pageSize

  // filtros
  const where: any = {}

  if (q.q) {
    const term = String(q.q)
    where.OR = [
      { nombre: { contains: term, mode: 'insensitive' } },
      { descripcion: { contains: term, mode: 'insensitive' } },
      { proveedor: { nombre: { contains: term, mode: 'insensitive' } } },
      { tipo: { nombre_tipo: { contains: term, mode: 'insensitive' } } },
      { estado: { nombre_estado: { contains: term, mode: 'insensitive' } } },
    ]
  }

  if (q.id_estado_repuesto) {
    where.id_estado_repuesto = Number(q.id_estado_repuesto)
  }
  if (q.id_tipo_repuesto) {
    where.id_tipo_repuesto = Number(q.id_tipo_repuesto)
  }
  if (q.id_proveedor) {
    where.id_proveedor = Number(q.id_proveedor)
  }

  const costoWhere: any = {}
  if (q.costoMin !== undefined && q.costoMin !== '') {
    costoWhere.gte = Number(q.costoMin)
  }
  if (q.costoMax !== undefined && q.costoMax !== '') {
    costoWhere.lte = Number(q.costoMax)
  }
  if (Object.keys(costoWhere).length) {
    where.costo = costoWhere
  }

  const sortBy = (q.sortBy as string) || 'id_repuesto'
  const sortOrder = (q.sortOrder as 'asc' | 'desc') || 'desc'

  const [total, rows] = await Promise.all([
    prisma.repuesto.count({ where }),
    prisma.repuesto.findMany({
      where,
      include: {
        estado: true,
        tipo: true,
        proveedor: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
  ])

  const items = rows.map((r) => ({
    id: r.id_repuesto,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    costo: Number(r.costo),

    id_estado_repuesto: r.id_estado_repuesto,
    estado: r.estado?.nombre_estado ?? '',

    id_tipo_repuesto: r.id_tipo_repuesto,
    tipo: r.tipo?.nombre_tipo ?? '',

    id_proveedor: r.id_proveedor,
    proveedor: r.proveedor?.nombre ?? '',
  }))

  return {
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    items,
  }
})
