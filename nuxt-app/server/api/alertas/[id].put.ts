// server/api/alertas/[id].put.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { safeParse } from 'valibot'
import { ActualizarAlertaDto } from '../../schemas/alerta'

async function getEstadoAlertaId(nombre: string) {
  const nombreNorm = nombre.trim().toUpperCase()

  const found = await prisma.estadoAlerta.findFirst({
    where: {
      nombre_estado: {
        equals: nombreNorm,
        mode: 'insensitive',
      },
    },
    select: { id_estado_alerta: true },
  })

  if (found) return found.id_estado_alerta

  const created = await prisma.estadoAlerta.create({
    data: { nombre_estado: nombreNorm },
  })
  return created.id_estado_alerta
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const rawBody = await readBody(event)
  const parsed = safeParse(ActualizarAlertaDto, rawBody)
  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
  const body = parsed.output

  const alerta = await prisma.alerta.findUnique({
    where: { id_alerta: id },
    include: {
      estado: true,
      tipo: true,
      bus: true,
      usuario: true,
      documento: true,
      incidente: true,
      mantenimiento: true,
    },
  })

  if (!alerta) {
    throw createError({ statusCode: 404, statusMessage: 'Alerta no encontrada' })
  }

  let idEstado = alerta.id_estado_alerta

  if (body.cerrar) {
    idEstado = await getEstadoAlertaId('CERRADA')
  } else if (body.atender) {
    idEstado = await getEstadoAlertaId('ATENDIDA')
  } else if (typeof body.id_estado_alerta === 'number') {
    idEstado = body.id_estado_alerta
  }

  const updated = await prisma.alerta.update({
    where: { id_alerta: id },
    data: {
      id_estado_alerta: idEstado,
      prioridad: body.prioridad !== undefined ? body.prioridad : alerta.prioridad,
    },
    include: {
      estado: true,
      tipo: true,
      bus: true,
      usuario: true,
      documento: true,
      incidente: true,
      mantenimiento: true,
    },
  })

  return { item: updated }
})
