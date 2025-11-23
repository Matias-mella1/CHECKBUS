// server/api/repuestos/catalogos.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  const [estados, tipos, proveedores] = await Promise.all([
    prisma.estadoRepuesto.findMany({
      orderBy: { id_estado_repuesto: 'asc' },
    }),
    prisma.tipoRepuesto.findMany({
      orderBy: { id_tipo_repuesto: 'asc' },
    }),
    prisma.proveedorRepuesto.findMany({
      orderBy: { id_proveedor: 'asc' },
    }),
  ])

  return {
    estados: estados.map((s) => ({
      id: s.id_estado_repuesto,
      nombre: s.nombre_estado,
    })),
    tipos: tipos.map((t) => ({
      id: t.id_tipo_repuesto,
      nombre: t.nombre_tipo,
    })),
    proveedores: proveedores.map((p) => ({
      id: p.id_proveedor,
      nombre: p.nombre,
    })),
  }
})
