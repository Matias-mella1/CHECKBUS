// server/api/incidentes/index.get.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ListaQueryDto } from '../../schemas/incidente'
import { defineEventHandler, getQuery, setHeader, createError } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  // --- Normalización de parámetros numéricos (evita "El bus es obligatorio") ---
  const qRaw: any = getQuery(event)

  function normalizeIntField(key: string) {
    const val = qRaw[key]

    if (typeof val === 'string') {
      const trimmed = val.trim()

      if (trimmed === '') {
        delete qRaw[key] // No filtrar
        return
      }

      const n = Number(trimmed)
      if (Number.isNaN(n)) {
        throw createError({
          statusCode: 400,
          message: `${key} debe ser numérico.`,
        })
      }
      qRaw[key] = n
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val) || val <= 0) {
        delete qRaw[key]
      }
    }
  }

  normalizeIntField('id_bus')
  normalizeIntField('id_usuario')
  normalizeIntField('id_tipo_incidente')
  normalizeIntField('id_estado_incidente')
  normalizeIntField('page')
  normalizeIntField('pageSize')

  // --- Ahora sí validamos ---
  const parsed = safeParse(ListaQueryDto, qRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Parámetros inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const q = parsed.output

  const page = q.page ?? 1
  const pageSize = q.pageSize ?? 20
  const skip = (page - 1) * pageSize

  const where: any = {}

  if (q.id_bus) where.id_bus = q.id_bus
  if (q.id_usuario) where.id_usuario = q.id_usuario
  if (q.id_tipo_incidente) where.id_tipo_incidente = q.id_tipo_incidente
  if (q.id_estado_incidente) where.id_estado_incidente = q.id_estado_incidente

  if (q.urgencia)
    where.urgencia = { contains: q.urgencia, mode: 'insensitive' }

  if (q.desde || q.hasta) {
    where.fecha = {}
    if (q.desde) where.fecha.gte = new Date(`${q.desde}T00:00:00`)
    if (q.hasta) where.fecha.lte = new Date(`${q.hasta}T23:59:59.999`)
  }

  if (q.q) {
    const term = q.q.trim()
    if (term) {
      where.OR = [
        { descripcion: { contains: term, mode: 'insensitive' } },
        { ubicacion: { contains: term, mode: 'insensitive' } },
        { bus: { patente: { contains: term, mode: 'insensitive' } } },
        { usuario: { nombre: { contains: term, mode: 'insensitive' } } },
        { usuario: { apellido: { contains: term, mode: 'insensitive' } } },
      ]
    }
  }

  const sortBy = q.sortBy ?? 'fecha'
  const sortOrder = (q.sortOrder ?? 'desc') as 'asc' | 'desc'

  const [total, rows] = await Promise.all([
    prisma.incidente.count({ where }),
    prisma.incidente.findMany({
      where,
      include: { bus: true, usuario: true, estado: true, tipo: true },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
    }),
  ])

  const items = rows.map((x) => ({
    id: x.id_incidente,
    id_bus: x.id_bus,
    id_usuario: x.id_usuario,
    fecha: x.fecha,
    descripcion: x.descripcion ?? '',
    urgencia: x.urgencia ?? '',
    ubicacion: x.ubicacion ?? '',
    id_estado_incidente: x.id_estado_incidente,
    estado: x.estado?.nombre_estado ?? '',
    id_tipo_incidente: x.id_tipo_incidente,
    tipo: x.tipo?.nombre_tipo ?? '',
    bus: x.bus
      ? `${x.bus.patente ?? ''}${x.bus.modelo ? ' - ' + x.bus.modelo : ''}`.trim()
      : '',
    usuario: x.usuario
      ? `${x.usuario.nombre ?? ''} ${x.usuario.apellido ?? ''}`.trim()
      : '',
  }))

  return {
    meta: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    items,
  }
})
