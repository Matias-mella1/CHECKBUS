// server/api/proveedores/index.get.ts
import {defineEventHandler,getQuery,setHeader,createError,} from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ListaProveedorQueryDto } from '../../schemas/proveedor'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const parsed = safeParse(ListaProveedorQueryDto, getQuery(event))
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Parámetros inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const q = parsed.output

  const page = q.page ?? 1
  const pageSize = q.pageSize ?? 20
  const skip = (page - 1) * pageSize
  const take = pageSize

  const where: any = {}

  if (q.nombre)   where.nombre   = { contains: q.nombre,   mode: 'insensitive' }
  if (q.email)    where.email    = { contains: q.email,    mode: 'insensitive' }
  if (q.telefono) where.telefono = { contains: q.telefono, mode: 'insensitive' }

  if (q.q) {
    where.OR = [
      { nombre:    { contains: q.q, mode: 'insensitive' } },
      { email:     { contains: q.q, mode: 'insensitive' } },
      { telefono:  { contains: q.q, mode: 'insensitive' } },
      { direccion: { contains: q.q, mode: 'insensitive' } },
    ]
  }

  const sortBy = (q.sortBy ?? 'nombre') as string
  const sortOrder = (q.sortOrder ?? 'asc') as 'asc' | 'desc'

  const [total, rows] = await Promise.all([
    prisma.proveedorRepuesto.count({ where }),
    prisma.proveedorRepuesto.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
  ])

  return {
    meta: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
    items: rows.map((r) => ({
      id: r.id_proveedor,
      nombre: r.nombre,
      direccion: r.direccion ?? '',
      telefono: r.telefono ?? '',
      email: r.email ?? '',
    })),
  }
})
