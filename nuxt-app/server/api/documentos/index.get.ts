// server/api/documentos/index.get.ts
import { defineEventHandler, getQuery, createError, setHeader } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ListaDocumentoQueryDto } from '../../schemas/documento'
import { estadoSegunFechaCaducidad } from '../../utils/DocumentoRuler'  // 👈 IMPORTAR

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const raw = getQuery(event)
  const parsed = safeParse(ListaDocumentoQueryDto, raw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Parámetros inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
  const q = parsed.output

  const queryText = q.q ? q.q.trim() : ''
  const idTipo    = q.id_tipo_documento   ? Number(q.id_tipo_documento)   : undefined
  const idEstado  = q.id_estado_documento ? Number(q.id_estado_documento) : undefined
  const categoria = q.categoria ? q.categoria.trim() : undefined

  const page     = Number(q.page ?? 1)
  const pageSize = Math.min(Number(q.pageSize ?? q.limit ?? 15), 100)
  const skip     = (page - 1) * pageSize

  const sortBy    = q.sortBy ?? 'fecha_creacion'
  const sortOrder = (q.sortOrder ?? 'desc') === 'asc' ? 'asc' : 'desc'

  const where: any = {}

  if (queryText) {
    where.OR = [
      { nombre_archivo: { contains: queryText, mode: 'insensitive' } },
      { ruta:           { contains: queryText, mode: 'insensitive' } },
    ]
  }

  if (typeof idTipo === 'number' && !Number.isNaN(idTipo)) {
    where.id_tipo_documento = idTipo
  }

  if (typeof idEstado === 'number' && !Number.isNaN(idEstado)) {
    where.id_estado_documento = idEstado
  }

  if (categoria) {
    where.tipo = { is: { categoria } }
  }

  const [rows, total] = await Promise.all([
    prisma.documento.findMany({
      where,
      include: { tipo: true, estado: true },
      orderBy: { [sortBy]: sortOrder as any },
      skip,
      take: pageSize,
    }),
    prisma.documento.count({ where }),
  ])

  // 👇 AQUÍ aplicamos la lógica de VIGENTE / POR VENCER / VENCIDO
  const items = rows.map((r) => {
    const estadoAuto = estadoSegunFechaCaducidad(r.fecha_caducidad)

    return {
      ...r,
      // convertimos DECIMAL a number
      tamano: r.tamano == null ? null : Number(r.tamano),
      // sobrescribimos solo el nombre del estado para el front
      estado: r.estado
        ? { ...r.estado, nombre_estado: estadoAuto }
        : { nombre_estado: estadoAuto },
    }
  })

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
})
