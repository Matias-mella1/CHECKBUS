// server/api/proveedores/index.post.ts
import { defineEventHandler, readBody, createError, setHeader } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { CrearProveedorDto } from '../../schemas/proveedor'

export default defineEventHandler(async (event) => {
  // nada de caché en POST
  setHeader(event, 'Cache-Control', 'no-store')

  const bodyRaw = await readBody(event)
  const parsed = safeParse(CrearProveedorDto, bodyRaw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const b = parsed.output

  const created = await prisma.proveedorRepuesto.create({
    data: {
      nombre: b.nombre,
      direccion: b.direccion ?? null,
      telefono: b.telefono ?? null,
      email: b.email ?? null,
    },
  })

  return {
    item: {
      id: created.id_proveedor,
      nombre: created.nombre,
      direccion: created.direccion ?? '',
      telefono: created.telefono ?? '',
      email: created.email ?? '',
    },
  }
})
