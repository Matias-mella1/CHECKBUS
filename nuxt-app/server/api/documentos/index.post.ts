// server/api/documentos/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { categoriaRequiere, requiereCaducidadPorNombre } from '../../utils/DocumentoRuler'
import { safeParse } from 'valibot'
import { CrearDocumentoDto } from '../../schemas/documento'

export default defineEventHandler(async (event) => {
  const bodyRaw = await readBody<any>(event)

  const parsed = safeParse(CrearDocumentoDto, bodyRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
  const body = parsed.output

  // Trae el tipo para conocer nombre y categoría
  const tipo = await prisma.tipoDocumento.findUnique({
    where: { id_tipo_documento: Number(body.id_tipo_documento) },
    select: { nombre_tipo: true, categoria: true },
  })
  if (!tipo) throw createError({ statusCode: 400, statusMessage: 'Tipo de documento inválido' })

  // Asociaciones obligatorias según categoría
  const need = categoriaRequiere(tipo.categoria)

  if (need.requiereBus && body.id_bus == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_bus es requerido para documentos de Vehículo' })
  }
  if (need.requiereUsuario && body.id_usuario == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_usuario es requerido para documentos de Conductor' })
  }
  if (need.requiereMantenimiento && body.id_mantenimiento == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_mantenimiento es requerido para documentos de Mantenimiento' })
  }
  if (need.requiereIncidente && body.id_incidente == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_incidente es requerido para documentos de Incidente' })
  }

  // Caducidad obligatoria si el NOMBRE del tipo está en la lista
  if (requiereCaducidadPorNombre(tipo.nombre_tipo) && !body.fecha_caducidad) {
    throw createError({ statusCode: 400, statusMessage: 'Este tipo requiere fecha_caducidad' })
  }

  const fecha_creacion  = new Date()
  const fecha_caducidad = body.fecha_caducidad ? new Date(body.fecha_caducidad) : undefined

  const tamanoNumber =
    typeof body.tamano === 'number'
      ? Number(body.tamano.toFixed(2))
      : undefined

  const doc = await prisma.documento.create({
    data: {
      nombre_archivo: String(body.nombre_archivo).slice(0, 100),
      ruta:           String(body.ruta).slice(0, 255),
      fecha_creacion,
      ...(fecha_caducidad ? { fecha_caducidad } : {}),
      ...(tamanoNumber != null ? { tamano: new Prisma.Decimal(tamanoNumber) } : {}),

      id_tipo_documento:   Number(body.id_tipo_documento),
      id_estado_documento: Number(body.id_estado_documento),

      ...(body.id_usuario       != null ? { id_usuario:       Number(body.id_usuario) } : {}),
      ...(body.id_bus           != null ? { id_bus:           Number(body.id_bus) } : {}),
      ...(body.id_incidente     != null ? { id_incidente:     Number(body.id_incidente) } : {}),
      ...(body.id_mantenimiento != null ? { id_mantenimiento: Number(body.id_mantenimiento) } : {}),
    },
    include: { tipo: true, estado: true },
  })

  return { ok: true, documento: doc }
})
