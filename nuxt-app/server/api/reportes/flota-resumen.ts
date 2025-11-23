// server/api/reportes/flota-resumen.get.ts
import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const hoy = new Date()
  const hace30 = new Date(hoy)
  hace30.setDate(hoy.getDate() - 30)

  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const dentro30 = new Date(hoy)
  dentro30.setDate(hoy.getDate() + 30)

  const [
    totalBuses,
    busesPorEstado,
    kmStats,
    mantPorEstado,
    incidentesRecientesRaw,
    alertasActivasRaw,
    docsPorVencerRaw,
    mantUltimoMes,
    incidentesUltimos30,
    topIncidentesPorBus,
    busesRevisionVencida,
    busesExtintorVencido,
  ] = await Promise.all([
    // 1) Total de buses
    prisma.bus.count(),

    // 2) Buses por estado
    prisma.bus
      .groupBy({
        by: ['id_estado_bus'],
        _count: { id_bus: true },
      })
      .then(async (rows) => {
        if (!rows.length) return []
        const estados = await prisma.estadoBus.findMany({
          where: { id_estado_bus: { in: rows.map((r) => r.id_estado_bus) } },
        })
        const map = new Map(
          estados.map((e) => [e.id_estado_bus, e.nombre_estado]),
        )
        return rows.map((r) => ({
          estado: map.get(r.id_estado_bus) || `Estado ${r.id_estado_bus}`,
          cantidad: r._count.id_bus,
        }))
      }),

    // 3) Kilometraje promedio y máximo
    prisma.bus.aggregate({
      _avg: { kilometraje: true },
      _max: { kilometraje: true },
    }),

    // 4) Mantenciones por estado
    prisma.mantenimiento
      .groupBy({
        by: ['id_estado_mantenimiento'],
        _count: { id_mantenimiento: true },
      })
      .then(async (rows) => {
        if (!rows.length) return []
        const estados = await prisma.estadoMantenimiento.findMany({
          where: {
            id_estado_mantenimiento: {
              in: rows.map((r) => r.id_estado_mantenimiento),
            },
          },
        })
        const map = new Map(
          estados.map((e) => [e.id_estado_mantenimiento, e.nombre_estado]),
        )
        return rows.map((r) => ({
          estado:
            map.get(r.id_estado_mantenimiento) ||
            `Estado ${r.id_estado_mantenimiento}`,
          cantidad: r._count.id_mantenimiento,
        }))
      }),

    // 5) Incidentes últimos 30 días (detalle)
    prisma.incidente.findMany({
      where: { fecha: { gte: hace30 } },
      orderBy: { fecha: 'desc' },
      take: 10,
      include: {
        bus: true,
        estado: true,
        tipo: true,
      },
    }),

    // 6) Alertas activas (no cerradas / resueltas / anuladas)
    prisma.alerta.findMany({
      where: {
        estado: {
          nombre_estado: {
            notIn: ['CERRADA', 'RESUELTA', 'ANULADA'],
          },
        },
      },
      orderBy: { fecha_creacion: 'desc' },
      take: 10,
      include: {
        bus: true,
        usuario: true, // <- para poder mostrar "Conductor ..."
        tipo: true,
        estado: true,
      },
    }),

    // 7) Documentos que vencen en los próximos 30 días
    prisma.documento.findMany({
      where: {
        fecha_caducidad: {
          gte: hoy,
          lte: dentro30,
        },
      },
      orderBy: { fecha_caducidad: 'asc' },
      take: 10,
      include: {
        bus: true,
        usuario: true, // docs de conductor
        tipo: true,
        estado: true,
      },
    }),

    // 8) Mantenciones realizadas desde el inicio del mes
    prisma.mantenimiento.count({
      where: { fecha: { gte: primerDiaMes } },
    }),

    // 9) Incidentes últimos 30 días (solo conteo)
    prisma.incidente.count({
      where: { fecha: { gte: hace30 } },
    }),

    // 10) TOP buses con más incidentes en los últimos 30 días
    prisma.incidente
      .groupBy({
        by: ['id_bus'],
        where: { fecha: { gte: hace30 } },
        _count: { id_incidente: true },
      })
      .then(async (rows) => {
        if (!rows.length) return []
        rows.sort((a, b) => b._count.id_incidente - a._count.id_incidente)
        const top = rows.slice(0, 5)
        const idsBus = top.map((t) => t.id_bus)
        const buses = await prisma.bus.findMany({
          where: { id_bus: { in: idsBus } },
        })
        const map = new Map(buses.map((b) => [b.id_bus, b.patente]))
        return top.map((t) => ({
          id_bus: t.id_bus,
          patente: map.get(t.id_bus) || `Bus ${t.id_bus}`,
          cantidad: t._count.id_incidente,
        }))
      }),

    // 11) Buses con revisión técnica vencida o sin fecha
    prisma.bus.count({
      where: {
        OR: [
          { fecha_revision_tecnica: null },
          { fecha_revision_tecnica: { lt: hoy } },
        ],
      },
    }),

    // 12) Buses con extintor vencido o sin fecha
    prisma.bus.count({
      where: {
        OR: [
          { fecha_extintor: null },
          { fecha_extintor: { lt: hoy } },
        ],
      },
    }),
  ])

  const up = (s: string) => s.toUpperCase()

  const busesOperativos = busesPorEstado
    .filter((b) => up(b.estado).includes('OPERAT'))
    .reduce((acc, b) => acc + b.cantidad, 0)

  const busesEnTaller = busesPorEstado
    .filter((b) => up(b.estado).includes('TALLER'))
    .reduce((acc, b) => acc + b.cantidad, 0)

  const busesFueraServicio = busesPorEstado
    .filter((b) => up(b.estado).includes('FUERA'))
    .reduce((acc, b) => acc + b.cantidad, 0)

  return {
    resumen: {
      totalBuses,
      busesOperativos,
      busesEnTaller,
      busesFueraServicio,
      kmPromedio: kmStats._avg.kilometraje ?? null,
      kmMaximo: kmStats._max.kilometraje ?? null,
      busesSinRevisionVigente: busesRevisionVencida,
      busesSinExtintorVigente: busesExtintorVencido,
      mantUltimoMes,
      incidentesUltimos30,
    },

    busesPorEstado,
    mantPorEstado,

    incidentesRecientes: incidentesRecientesRaw.map((i) => ({
      id: i.id_incidente,
      fecha: i.fecha,
      bus: i.bus?.patente ?? '—',
      tipo: i.tipo?.nombre_tipo ?? '—',
      estado: i.estado?.nombre_estado ?? '—',
      descripcion: i.descripcion ?? '',
    })),

    // IMPORTANTE: aquí "bus" ya puede ser bus o conductor (o ninguno)
    alertasActivas: alertasActivasRaw.map((a) => {
      let sujeto = a.bus?.patente ?? ''

      if (!sujeto && (a as any).usuario) {
        const u = (a as any).usuario
        sujeto = u.rut
          ? `Conductor ${u.rut}`
          : `Conductor ${u.nombre ?? u.id_usuario}`
      }

      if (!sujeto) sujeto = '—'

      return {
        id: a.id_alerta,
        fecha: a.fecha_creacion,
        bus: sujeto, // se usará en la columna "Asociado a"
        tipo: a.tipo?.nombre_tipo ?? '—',
        estado: a.estado?.nombre_estado ?? '—',
        prioridad: a.prioridad ?? '—',
        titulo: a.titulo,
        descripcion: a.descripcion ?? '',
      }
    }),

    // Documentos que vencen (bus o conductor)
    docsPorVencer: docsPorVencerRaw.map((d) => {
      let sujeto = d.bus?.patente ?? ''

      if (!sujeto && (d as any).usuario) {
        const u = (d as any).usuario
        sujeto = u.rut
          ? `Conductor ${u.rut}`
          : `Conductor ${u.nombre ?? u.id_usuario}`
      }

      if (!sujeto) sujeto = '—'

      return {
        id: d.id_documento,
        vence: d.fecha_caducidad,
        bus: sujeto, // se usará en la columna "Asociado a"
        tipo: d.tipo?.nombre_tipo ?? '—',
        estado: d.estado?.nombre_estado ?? '—',
        nombre_archivo: d.nombre_archivo,
      }
    }),

    topBusesIncidentes: topIncidentesPorBus,
  }
})
