// server/api/incidentes/index.post.ts
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { CrearIncidenteDto } from '../../schemas/incidente'
import { generarAlertaIncidenteInmediata } from '../../lib/alertas'
import { updateBusEstadoOnIncidente } from '../../lib/incidenteBus'
import { defineEventHandler, readBody, createError, setHeader } from 'h3'

let REPORTADO_ID_CACHE: number | null = null

async function getReportadoEstadoId(): Promise<number> {
  if (REPORTADO_ID_CACHE) return REPORTADO_ID_CACHE

  const found = await prisma.estadoIncidente.findFirst({
    where: { nombre_estado: { equals: 'REPORTADO', mode: 'insensitive' } },
    select: { id_estado_incidente: true },
  })

  if (found) {
    REPORTADO_ID_CACHE = found.id_estado_incidente
    return REPORTADO_ID_CACHE
  }

  const created = await prisma.estadoIncidente.create({
    data: {
      nombre_estado: 'REPORTADO',
      descripcion: 'Levantado por usuario',
    },
    select: { id_estado_incidente: true },
  })

  REPORTADO_ID_CACHE = created.id_estado_incidente
  return REPORTADO_ID_CACHE
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const bodyRaw = await readBody(event)
  const parsed = safeParse(CrearIncidenteDto, bodyRaw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, message: msg })
  }

  const body = parsed.output

  // id_usuario desde auth 
  let idUsuario =
    Number((event as any).context?.auth?.user?.id_usuario) ||
    Number((event as any).context?.auth?.user?.id) ||
    0

  if (!idUsuario && body.id_usuario) idUsuario = Number(body.id_usuario)
  if (!idUsuario) {
    throw createError({ statusCode: 401, message: 'No autenticado' })
  }

  const idEstadoReportado = await getReportadoEstadoId()

  const fechaDate = new Date(`${body.fecha}T00:00:00`) // viene YYYY-MM-DD

  const created = await prisma.incidente.create({
    data: {
      id_bus: Number(body.id_bus),
      id_usuario: idUsuario,
      fecha: fechaDate,
      urgencia: body.urgencia ?? null,
      ubicacion: body.ubicacion ?? null,
      descripcion: body.descripcion ?? null,
      id_tipo_incidente: Number(body.id_tipo_incidente),
      id_estado_incidente: idEstadoReportado,
    },
    include: { bus: true, usuario: true, estado: true, tipo: true },
  })

  generarAlertaIncidenteInmediata(created.id_incidente).catch((err) =>
    console.error('[alertas] error alerta incidente inmediata', err),
  )


  updateBusEstadoOnIncidente(created.id_incidente).catch((err) =>
    console.error('[bus] error updateBusEstadoOnIncidente', err),
  )

  return {
    item: {
      id: created.id_incidente,
      id_bus: created.id_bus,
      id_usuario: created.id_usuario,
      fecha: created.fecha ? created.fecha.toISOString() : null,
      descripcion: created.descripcion ?? '',
      urgencia: created.urgencia ?? '',
      ubicacion: created.ubicacion ?? '',
      id_estado_incidente: created.id_estado_incidente,
      estado: created.estado?.nombre_estado ?? 'REPORTADO',
      id_tipo_incidente: created.id_tipo_incidente,
      tipo: created.tipo?.nombre_tipo ?? '',
      bus: created.bus
        ? `${created.bus.patente ?? ''}${
            created.bus.modelo ? ' - ' + created.bus.modelo : ''
          }`.trim()
        : '',
      usuario: created.usuario
        ? `${created.usuario.nombre ?? ''} ${
            created.usuario.apellido ?? ''
          }`.trim()
        : '',
    },
  }
})
