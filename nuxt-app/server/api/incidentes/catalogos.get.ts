// server/api/incidentes/catalogos.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const [buses, estados, tipos] = await Promise.all([
    prisma.bus.findMany({
      select: { id_bus: true, patente: true, modelo: true },
      orderBy: { id_bus: 'asc' },
    }),

    prisma.estadoIncidente.findMany({
      select: { id_estado_incidente: true, nombre_estado: true },
      orderBy: { id_estado_incidente: 'asc' },
    }),

    prisma.tipoIncidente.findMany({
      select: { id_tipo_incidente: true, nombre_tipo: true },
      orderBy: { id_tipo_incidente: 'asc' },
    }),
  ])

  return {
    buses: buses.map((b) => ({
      id: Number(b.id_bus),
      label: b.patente
        ? b.modelo
          ? `${b.patente} - ${b.modelo}`
          : b.patente
        : `BUS #${b.id_bus}`,
    })),
    estados: estados.map((e) => ({
      id: Number(e.id_estado_incidente),
      nombre: String(e.nombre_estado),
    })),
    tipos: tipos.map((t) => ({
      id: Number(t.id_tipo_incidente),
      nombre: String(t.nombre_tipo),
    })),
  }
})
