// server/api/repuestos/[id].put.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ActualizarRepuestoDto } from '../../schemas/repuesto'
import {
  defineEventHandler,
  readBody,
  getRouterParam,
  createError,
} from 'h3'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }

  const bodyRaw = await readBody(event)
  const parsed = safeParse(ActualizarRepuestoDto, bodyRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }
  const b = parsed.output

  const data: any = {}
  if (b.nombre !== undefined) data.nombre = b.nombre
  if (b.descripcion !== undefined) data.descripcion = b.descripcion ?? null
  if (b.costo !== undefined) data.costo = b.costo
  if (b.id_estado_repuesto !== undefined)
    data.id_estado_repuesto = b.id_estado_repuesto
  if (b.id_tipo_repuesto !== undefined)
    data.id_tipo_repuesto = b.id_tipo_repuesto
  if (b.id_proveedor !== undefined) data.id_proveedor = b.id_proveedor

  const updated = await prisma.repuesto.update({
    where: { id_repuesto: id },
    data,
    include: { estado: true, tipo: true, proveedor: true },
  })

  return {
    item: {
      id: updated.id_repuesto,
      nombre: updated.nombre,
      descripcion: updated.descripcion ?? '',
      costo: Number(updated.costo),

      id_estado_repuesto: updated.id_estado_repuesto,
      estado: updated.estado?.nombre_estado ?? '',

      id_tipo_repuesto: updated.id_tipo_repuesto,
      tipo: updated.tipo?.nombre_tipo ?? '',

      id_proveedor: updated.id_proveedor,
      proveedor: updated.proveedor?.nombre ?? '',
    },
  }
})
