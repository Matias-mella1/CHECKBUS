// server/api/turnos/index.post.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError } from 'h3'
import { safeParse } from 'valibot'
import { TurnoCreateSchema } from '../../schemas/turno'

// 🔔 IMPORTA LAS ALERTAS DE TURNOS
import { generarAlertaTurnoInmediata } from '../../lib/alertas'

// Estados que se consideran “ocupando” recursos
const ESTADOS_OCUPA = ['PROGRAMADO', 'EN CURSO', 'ACTIVO', 'PENDIENTE', 'ASIGNADO']

export default defineEventHandler(async (event) => {
  const rawBody = await readBody(event)

  // ✅ Validación con Valibot
  const result = safeParse(TurnoCreateSchema, rawBody)

  if (!result.success) {
    const mensajes = result.issues.map((i) => `- ${i.message}`).join(' | ')
    throw createError({
      statusCode: 400,
      message: `Errores de Validación (Revisar campos): ${mensajes}`,
    })
  }

  const body = result.output

  const inicio = new Date(body.inicio)
  const fin    = new Date(body.fin)

  if (!(inicio < fin)) {
    throw createError({ statusCode: 400, message: 'Inicio debe ser menor que fin.' })
  }

  // 🔹 Estado por defecto = PROGRAMADO (si no viene uno explícito)
  let idEstadoTurno: number
  if (body.id_estado_turno) {
    const est = await prisma.estadoTurno.findUnique({
      where: { id_estado_turno: body.id_estado_turno },
    })
    if (!est) {
      throw createError({ statusCode: 400, message: 'Estado de turno inválido.' })
    }
    idEstadoTurno = est.id_estado_turno
  } else {
    let est = await prisma.estadoTurno.findFirst({
      where: { nombre_estado: 'PROGRAMADO' },
    })
    if (!est) {
      est = await prisma.estadoTurno.create({ data: { nombre_estado: 'PROGRAMADO' } })
    }
    idEstadoTurno = est.id_estado_turno
  }

  // 🔒 Conflicto BUS
  const busConflict = await prisma.turnoConductor.findFirst({
    where: {
      id_bus: body.id_bus,
      hora_inicio: { lt: fin },
      hora_fin:    { gt: inicio },
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

  // 🔒 Conflicto CONDUCTOR
  const driverConflict = await prisma.turnoConductor.findFirst({
    where: {
      id_usuario: body.id_usuario,
      hora_inicio: { lt: fin },
      hora_fin:    { gt: inicio },
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

  const created = await prisma.turnoConductor.create({
    data: {
      id_usuario: body.id_usuario,
      id_bus: body.id_bus,
      hora_inicio: inicio,
      hora_fin: fin,
      fecha: inicio,
      id_estado_turno: idEstadoTurno,
      titulo: body.titulo || null,
      descripcion: body.descripcion || null,
      ruta_origen: body.ruta_origen || null,
      ruta_fin: body.ruta_fin || null,
    },
    include: { usuario: true, bus: true, estado: true },
  })

  // 🔔 ALERTA
  try {
    await generarAlertaTurnoInmediata(created.id_turno)
  } catch (err) {
    console.error('Error enviando alerta de turno nuevo', err)
  }

  return {
    item: {
      id: created.id_turno,
      usuarioId: created.id_usuario,
      usuarioNombre:
        [created.usuario?.nombre, created.usuario?.apellido].filter(Boolean).join(' ') || '',
      busId: created.id_bus,
      busLabel: `${created.bus?.patente ?? ''} - ${created.bus?.modelo ?? ''}`,
      inicio: created.hora_inicio,
      fin: created.hora_fin,
      estado: created.estado?.nombre_estado ?? '',
      titulo: created.titulo ?? '',
      descripcion: created.descripcion ?? '',
      ruta_origen: created.ruta_origen,
      ruta_fin: created.ruta_fin,
    },
  }
})
