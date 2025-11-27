// server/api/turnos/[id].put.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { safeParse } from 'valibot'
import { TurnoUpdateSchema } from '../../schemas/turno'
import { generarAlertaTurnoCancelado } from '../../lib/alertas'

const ESTADOS_OCUPA = ['PROGRAMADO', 'EN CURSO', 'ACTIVO', 'PENDIENTE', 'ASIGNADO']

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID inválido' })

  const rawBody = await readBody(event)

  const result = safeParse(TurnoUpdateSchema, rawBody)
  if (!result.success) {
    const mensajes = result.issues.map((i) => `- ${i.message}`).join(' | ')
    throw createError({
      statusCode: 400,
      message: `Errores de Validación (Revisar campos): ${mensajes}`,
    })
  }
  const body = result.output

  const current = await prisma.turnoConductor.findUnique({
    where: { id_turno: id },
    include: { estado: true, usuario: true, bus: true },
  })
  if (!current) throw createError({ statusCode: 404, message: 'Turno no encontrado' })

  const id_bus = typeof body.id_bus === 'number' ? body.id_bus : current.id_bus
  const inicio = body.inicio ? new Date(body.inicio) : new Date(current.hora_inicio)
  const fin    = body.fin    ? new Date(body.fin)    : new Date(current.hora_fin!)
  const titulo = body.titulo !== undefined ? (body.titulo || null) : current.titulo
  const descripcion =
    body.descripcion !== undefined ? (body.descripcion || null) : current.descripcion
  const ruta_origen =
    body.ruta_origen !== undefined ? (body.ruta_origen || null) : current.ruta_origen
  const ruta_fin =
    body.ruta_fin !== undefined ? (body.ruta_fin || null) : current.ruta_fin

  if (!(inicio < fin)) {
    throw createError({ statusCode: 400, message: 'Inicio debe ser menor que fin.' })
  }

  let id_estado_turno = current.id_estado_turno
  if (typeof body.id_estado_turno === 'number') {
    const est = await prisma.estadoTurno.findUnique({
      where: { id_estado_turno: body.id_estado_turno },
    })
    if (!est) throw createError({ statusCode: 400, message: 'Estado de turno inválido.' })
    id_estado_turno = est.id_estado_turno
  }


  const busConflict = await prisma.turnoConductor.findFirst({
    where: {
      id_turno: { not: id },
      id_bus,
      hora_inicio: { lt: fin },
      hora_fin: { gt: inicio },
      estado: {
        nombre_estado: {
          in: ESTADOS_OCUPA,
        },
      },
    },
    select: { id_turno: true, hora_inicio: true, hora_fin: true },
  })

  if (busConflict) {
    throw createError({
      statusCode: 409,
      message: 'El bus ya está asignado en ese horario.',
      data: { conflicto: busConflict },
    })
  }


  const driverConflict = await prisma.turnoConductor.findFirst({
    where: {
      id_turno: { not: id },
      id_usuario: current.id_usuario,
      hora_inicio: { lt: fin },
      hora_fin: { gt: inicio },
      estado: {
        nombre_estado: {
          in: ESTADOS_OCUPA,
        },
      },
    },
    select: { id_turno: true, hora_inicio: true, hora_fin: true },
  })

  if (driverConflict) {
    throw createError({
      statusCode: 409,
      message: 'El conductor ya tiene un turno en ese horario.',
      data: { conflicto: driverConflict },
    })
  }

  const updated = await prisma.turnoConductor.update({
    where: { id_turno: id },
    data: {
      id_bus,
      hora_inicio: inicio,
      hora_fin: fin,
      titulo,
      descripcion,
      id_estado_turno,
      ruta_origen,
      ruta_fin,
    },
    include: { usuario: true, bus: true, estado: true },
  })

  const prevEstado = current.estado?.nombre_estado?.toUpperCase() ?? ''
  const newEstado  = updated.estado?.nombre_estado?.toUpperCase() ?? ''

  if (prevEstado !== 'CANCELADO' && newEstado === 'CANCELADO') {
    try {
      await generarAlertaTurnoCancelado(updated.id_turno)
    } catch (err) {
      console.error('Error enviando alerta de turno cancelado', err)
    }
  }

  return {
    item: {
      id: updated.id_turno,
      usuarioId: updated.id_usuario,
      usuarioNombre:
        [updated.usuario?.nombre, updated.usuario?.apellido].filter(Boolean).join(' ') || '',
      busId: updated.id_bus,
      busLabel: `${updated.bus?.patente ?? ''} - ${updated.bus?.modelo ?? ''}`,
      inicio: updated.hora_inicio,
      fin: updated.hora_fin,
      estado: updated.estado?.nombre_estado ?? '',
      titulo: updated.titulo ?? '',
      descripcion: updated.descripcion ?? '',
      ruta_origen: updated.ruta_origen,
      ruta_fin: updated.ruta_fin,
    },
  }
})
