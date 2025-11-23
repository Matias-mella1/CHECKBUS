// server/api/turnos/catalogos.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const [buses, estados] = await Promise.all([
    prisma.bus.findMany({
      select: { id_bus: true, patente: true, modelo: true },
      orderBy: { id_bus: 'asc' },
    }),
    prisma.estadoTurno.findMany({
      select: { id_estado_turno: true, nombre_estado: true },
      orderBy: { nombre_estado: 'asc' },
    }),
  ])

  return {
    buses: buses.map(b => ({
      id: b.id_bus,
      label: `${b.patente ?? 'SIN PATENTE'} - ${b.modelo ?? 'SIN MODELO'}`,
    })),
    estados: estados.map(e => ({
      id: e.id_estado_turno,
      nombre: e.nombre_estado,
    })),
  }
})
