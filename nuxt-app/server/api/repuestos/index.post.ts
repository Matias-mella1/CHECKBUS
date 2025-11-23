// server/api/repuestos/index.post.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { CrearRepuestoDto } from '../../schemas/repuesto'
import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const bodyRaw = await readBody(event)

  const parsed = safeParse(CrearRepuestoDto, bodyRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }
  const body = parsed.output

  const created = await prisma.repuesto.create({
    data: {
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      costo: body.costo,
      id_estado_repuesto: body.id_estado_repuesto,
      id_tipo_repuesto: body.id_tipo_repuesto,
      id_proveedor: body.id_proveedor,
    },
    include: { estado: true, tipo: true, proveedor: true },
  })

  return {
    item: {
      id: created.id_repuesto,
      nombre: created.nombre,
      descripcion: created.descripcion ?? '',
      costo: Number(created.costo),

      id_estado_repuesto: created.id_estado_repuesto,
      estado: created.estado?.nombre_estado ?? '',

      id_tipo_repuesto: created.id_tipo_repuesto,
      tipo: created.tipo?.nombre_tipo ?? '',

      id_proveedor: created.id_proveedor,
      proveedor: created.proveedor?.nombre ?? '',
    },
  }
})
