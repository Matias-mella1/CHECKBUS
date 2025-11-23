// server/lib/busEstado.ts
import { prisma } from '../utils/prisma'
import { getEstadoBusId } from './estados'

export async function recomputeBusEstado(id_bus: number) {
  // ---- Incidentes activos ----
  const [incReportado, incRevision] = await Promise.all([
    prisma.estadoIncidente.findFirst({
      where: { nombre_estado: { equals: 'REPORTADO', mode: 'insensitive' } },
    }),
    prisma.estadoIncidente.findFirst({
      where: { nombre_estado: { equals: 'EN REVISIÓN', mode: 'insensitive' } },
    }),
  ])

  const incidentesActivos = await prisma.incidente.count({
    where: {
      id_bus,
      id_estado_incidente: {
        in: [
          incReportado?.id_estado_incidente,
          incRevision?.id_estado_incidente,
        ].filter(Boolean) as number[],
      },
    },
  })

  // ---- Mantenciones activas ----
  const [mantPend, mantProc] = await Promise.all([
    prisma.estadoMantenimiento.findFirst({
      where: { nombre_estado: { equals: 'PENDIENTE', mode: 'insensitive' } },
    }),
    prisma.estadoMantenimiento.findFirst({
      where: { nombre_estado: { equals: 'EN PROCESO', mode: 'insensitive' } },
    }),
  ])

  const mantenimientosActivos = await prisma.mantenimiento.count({
    where: {
      id_bus,
      id_estado_mantenimiento: {
        in: [
          mantPend?.id_estado_mantenimiento,
          mantProc?.id_estado_mantenimiento,
        ].filter(Boolean) as number[],
      },
    },
  })

  // ---- Decisión final ----
  let nuevoEstadoNombre: string
  if (incidentesActivos > 0) {
    nuevoEstadoNombre = 'FUERA DE SERVICIO'
  } else if (mantenimientosActivos > 0) {
    nuevoEstadoNombre = 'MANTENIMIENTO'
  } else {
    nuevoEstadoNombre = 'OPERATIVO'
  }

  const bus = await prisma.bus.findUnique({
    where: { id_bus },
    select: { id_estado_bus: true },
  })
  if (!bus) return

  const idNuevoEstado = await getEstadoBusId(nuevoEstadoNombre)
  if (bus.id_estado_bus === idNuevoEstado) return

  await prisma.bus.update({
    where: { id_bus },
    data: { id_estado_bus: idNuevoEstado },
  })
}
