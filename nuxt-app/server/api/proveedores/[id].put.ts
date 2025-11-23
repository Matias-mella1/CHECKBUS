// server/api/proveedores/[id].put.ts
import {defineEventHandler,readBody,getRouterParam,createError,} from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ActualizarProveedorDto } from '../../schemas/proveedor'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }

  const bodyRaw = await readBody(event)
  const parsed = safeParse(ActualizarProveedorDto, bodyRaw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const b = parsed.output

  const updated = await prisma.proveedorRepuesto.update({
    where: { id_proveedor: id },
    data: {
      ...(b.nombre    !== undefined ? { nombre:    b.nombre }           : {}),
      ...(b.direccion !== undefined ? { direccion: b.direccion ?? null } : {}),
      ...(b.telefono  !== undefined ? { telefono:  b.telefono  ?? null } : {}),
      ...(b.email     !== undefined ? { email:     b.email     ?? null } : {}),
    },
  })

  return {
    item: {
      id: updated.id_proveedor,
      nombre: updated.nombre,
      direccion: updated.direccion ?? '',
      telefono: updated.telefono ?? '',
      email: updated.email ?? '',
    },
  }
})
