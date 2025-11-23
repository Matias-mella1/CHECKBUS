// server/api/documentos/[id].put.ts
import { defineEventHandler, createError, getRouterParam, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { Prisma } from '@prisma/client'
import { safeParse } from 'valibot'
import { ActualizarDocumentoDto } from '../../schemas/documento'
import { categoriaRequiere } from '../../utils/DocumentoRuler'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido' })

  const bodyRaw = await readBody<any>(event)
  const parsed = safeParse(ActualizarDocumentoDto, bodyRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
  const b = parsed.output

  const data: any = {}

  if (b.nombre_archivo !== undefined) {
    data.nombre_archivo = String(b.nombre_archivo).slice(0, 100)
  }
  if (b.ruta !== undefined) {
    data.ruta = String(b.ruta).slice(0, 255)
  }
  if (b.fecha_caducidad !== undefined) {
    data.fecha_caducidad = b.fecha_caducidad ? new Date(b.fecha_caducidad) : null
  }
  if (b.tamano !== undefined && b.tamano !== null) {
    data.tamano = new Prisma.Decimal(Number(b.tamano).toFixed(2))
  }
  if (b.id_tipo_documento !== undefined)   data.id_tipo_documento = Number(b.id_tipo_documento)
  if (b.id_estado_documento !== undefined) data.id_estado_documento = Number(b.id_estado_documento)
  if (b.id_usuario !== undefined)          data.id_usuario = b.id_usuario ?? null
  if (b.id_bus !== undefined)              data.id_bus = b.id_bus ?? null
  if (b.id_incidente !== undefined)        data.id_incidente = b.id_incidente ?? null
  if (b.id_mantenimiento !== undefined)    data.id_mantenimiento = b.id_mantenimiento ?? null

  // Validar categoría si se cambia el tipo
  if (b.id_tipo_documento !== undefined) {
    const tipo = await prisma.tipoDocumento.findUnique({
      where: { id_tipo_documento: Number(b.id_tipo_documento) },
      select: { categoria: true },
    })
    if (!tipo) throw createError({ statusCode: 400, statusMessage: 'Tipo de documento inválido' })

    const need = categoriaRequiere(tipo.categoria)
    if (need.requiereBus && data.id_bus == null) {
      throw createError({ statusCode: 400, statusMessage: 'id_bus es requerido para documentos de Vehículo' })
    }
    if (need.requiereUsuario && data.id_usuario == null) {
      throw createError({ statusCode: 400, statusMessage: 'id_usuario es requerido para documentos de Conductor' })
    }
    if (need.requiereMantenimiento && data.id_mantenimiento == null) {
      throw createError({ statusCode: 400, statusMessage: 'id_mantenimiento es requerido para documentos de Mantenimiento' })
    }
    if (need.requiereIncidente && data.id_incidente == null) {
      throw createError({ statusCode: 400, statusMessage: 'id_incidente es requerido para documentos de Incidente' })
    }
  }

  const doc = await prisma.documento.update({
    where: { id_documento: id },
    data,
    include: { tipo: true, estado: true },
  })

  return { ok: true, documento: doc }
})
