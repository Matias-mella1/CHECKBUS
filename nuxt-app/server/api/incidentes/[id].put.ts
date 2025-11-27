// server/api/incidentes/[id].put.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { ActualizarIncidenteDto } from '../../schemas/incidente'
import { updateBusEstadoOnIncidente } from '../../lib/incidenteBus'
import {
  defineEventHandler,
  readBody,
  createError,
  getRouterParam,
} from 'h3'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }

  const bodyRaw = await readBody(event)

  const parsed = safeParse(ActualizarIncidenteDto, bodyRaw)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const b = parsed.output

  const data: any = {}

  if (typeof b.id_bus === 'number') {
    data.id_bus = b.id_bus
  }

  if (typeof b.id_usuario === 'number') {
    data.id_usuario = b.id_usuario
  }

  if (b.descripcion !== undefined) {
    data.descripcion = b.descripcion ?? null
  }

  if (b.urgencia !== undefined) {
    data.urgencia = b.urgencia ?? null
  }

  if (b.ubicacion !== undefined) {
    data.ubicacion = b.ubicacion ?? null
  }

  if (typeof b.id_tipo_incidente === 'number') {
    data.id_tipo_incidente = b.id_tipo_incidente
  }

  if (b.fecha !== undefined) {
    data.fecha = new Date(`${b.fecha}T00:00:00`)
  }


  if (typeof b.id_estado_incidente === 'number') {
    data.id_estado_incidente = b.id_estado_incidente
  }

  const updated = await prisma.incidente.update({
    where: { id_incidente: id },
    data,
    include: { bus: true, usuario: true, estado: true, tipo: true },
  })

  updateBusEstadoOnIncidente(updated.id_incidente).catch((err) =>
    console.error('[bus] error updateBusEstadoOnIncidente', err),
  )

  return {
    item: {
      id: updated.id_incidente,
      id_bus: updated.id_bus,
      id_usuario: updated.id_usuario,
      fecha: updated.fecha,
      descripcion: updated.descripcion ?? '',
      urgencia: updated.urgencia ?? '',
      ubicacion: updated.ubicacion ?? '',
      id_estado_incidente: updated.id_estado_incidente,
      estado: updated.estado?.nombre_estado ?? '',
      id_tipo_incidente: updated.id_tipo_incidente,
      tipo: updated.tipo?.nombre_tipo ?? '',
      bus: updated.bus
        ? `${updated.bus.patente ?? ''} - ${updated.bus.modelo ?? ''}`
        : '',
      usuario: updated.usuario
        ? `${updated.usuario.nombre ?? ''} ${
            updated.usuario.apellido ?? ''
          }`.trim()
        : '',
    },
  }
})
