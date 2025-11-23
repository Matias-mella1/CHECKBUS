import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError } from 'h3'
import { safeParse } from 'valibot'
import { MantenimientoCreateSchema } from '../../schemas/mantenimiento'
import { toDateOrNull } from '../../utils/date'
import { syncBusEstadoFromMantenimiento } from '../../lib/mantenimientoBus'
import { generarAlertaMantenimientoInmediata } from '../../lib/alertas'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const parsed = safeParse(MantenimientoCreateSchema, body)
    if (!parsed.success) {
      const msg = parsed.issues.map(i => i.message).join(', ')
      throw createError({ statusCode: 400, message: msg })
    }
    const data = parsed.output

    const [bus, taller, tipo, estado] = await Promise.all([
      prisma.bus.findUnique({
        where: { id_bus: data.id_bus },
        include: { estado_bus: true },
      }),
      prisma.taller.findUnique({ where: { id_taller: data.id_taller } }),
      prisma.tipoMantenimiento.findUnique({
        where: { id_tipo_mantenimiento: data.id_tipo_mantenimiento },
      }),
      prisma.estadoMantenimiento.findUnique({
        where: { id_estado_mantenimiento: data.id_estado_mantenimiento },
      }),
    ])

    if (!bus)    throw createError({ statusCode: 400, message: 'Bus no encontrado' })
    if (!taller) throw createError({ statusCode: 400, message: 'Taller no encontrado' })
    if (!tipo)   throw createError({ statusCode: 400, message: 'Tipo de mantenimiento inválido' })
    if (!estado) throw createError({ statusCode: 400, message: 'Estado de mantenimiento inválido' })

    // No permitir si ya está en mantenimiento
    const estadoBusActual = bus.estado_bus?.nombre_estado?.toUpperCase().trim()
    if (estadoBusActual === 'MANTENIMIENTO' || estadoBusActual === 'EN MANTENCIÓN') {
      throw createError({
        statusCode: 400,
        message: `El bus ${bus.patente ?? bus.id_bus} ya se encuentra en mantenimiento y no admite otra mantención activa.`,
      })
    }

    const montoManoObra = Number(data.costo_mano_obra ?? 0)

    const createData: any = {
      id_bus: data.id_bus,
      id_taller: data.id_taller,
      id_tipo_mantenimiento: data.id_tipo_mantenimiento,
      id_estado_mantenimiento: data.id_estado_mantenimiento,
      fecha: toDateOrNull(data.fecha)!,
      observaciones: data.observaciones ?? null,

      // campos de BD reales
      costo_mano_obra: montoManoObra,
      costo_repuestos: 0,
      costo_total: montoManoObra,
      // 👆 ya NO enviamos "costo"
    }

    const creado = await prisma.mantenimiento.create({
      data: createData,
      include: {
        bus:    { select: { id_bus: true, patente: true } },
        taller: { select: { id_taller: true, nombre: true } },
        tipo:   { select: { id_tipo_mantenimiento: true, nombre_tipo: true } },
        estado: { select: { id_estado_mantenimiento: true, nombre_estado: true } },
      },
    })

    await syncBusEstadoFromMantenimiento(creado.id_mantenimiento)

    try {
      await generarAlertaMantenimientoInmediata(creado.id_mantenimiento)
    } catch (e: any) {
      console.error('Error generando alerta inmediata de mantenimiento:', e)
    }

    const costoManoObra  = Number(creado.costo_mano_obra ?? 0)
    const costoRepuestos = Number(creado.costo_repuestos ?? 0)
    const costoTotal     = Number(creado.costo_total ?? (costoManoObra + costoRepuestos))

    return {
      item: {
        id_mantenimiento: creado.id_mantenimiento,
        id_bus: creado.id_bus,
        id_taller: creado.id_taller,
        id_tipo_mantenimiento: creado.id_tipo_mantenimiento,
        id_estado_mantenimiento: creado.id_estado_mantenimiento,
        fecha: creado.fecha,
        // para el front
        costo: costoTotal,
        costo_mano_obra: costoManoObra,
        costo_repuestos: costoRepuestos,
        costo_total: costoTotal,
        observaciones: creado.observaciones,
        bus: creado.bus,
        taller: creado.taller,
        tipo: creado.tipo,
        estado: creado.estado,
      },
    }
  } catch (err: any) {
    console.error('❌ Error en POST /api/mantenimientos:', err)
    if (err?.statusCode) throw err
    throw createError({ statusCode: 500, message: `Error al crear mantenimiento: ${err?.message ?? 'Error desconocido'}` })
  }
})
