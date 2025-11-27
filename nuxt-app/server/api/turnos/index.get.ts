// server/api/turnos/index.get.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  const where: any = {}

  if (q.usuarioId) {
    where.id_usuario = Number(q.usuarioId)
  }

  if (q.id_estado_turno) {
    where.id_estado_turno = Number(q.id_estado_turno)
  }

  if (q.from || q.to) {
    where.hora_inicio = {}
    if (q.from) where.hora_inicio.gte = new Date(q.from as string)
    if (q.to)   where.hora_inicio.lte = new Date(q.to as string)
  }

  //  Obtener turnos 
  let rows = await prisma.turnoConductor.findMany({
    where,
    include: { usuario: true, bus: true, estado: true },
    orderBy: { hora_inicio: 'desc' },
  })

  //Actualización automática por hora
  const now = new Date()

  for (const turno of rows) {
    // Validamos que no sean null
    const inicio = turno.hora_inicio ? new Date(turno.hora_inicio) : null
    const fin = turno.hora_fin ? new Date(turno.hora_fin) : null

    if (!inicio || !fin) continue

   
    if (turno.id_estado_turno === 1 && now >= inicio && now < fin) {
      await prisma.turnoConductor.update({
        where: { id_turno: turno.id_turno },
        data: { id_estado_turno: 2 },
      })
      turno.id_estado_turno = 2
      if (turno.estado) turno.estado.nombre_estado = 'EN CURSO'
    }

  
    if (turno.id_estado_turno === 2 && now >= fin) {
      await prisma.turnoConductor.update({
        where: { id_turno: turno.id_turno },
        data: { id_estado_turno: 3 },
      })
      turno.id_estado_turno = 3
      if (turno.estado) turno.estado.nombre_estado = 'COMPLETADO'
    }
  }

  const items = rows.map((t) => ({
    id: t.id_turno,
    usuarioId: t.id_usuario,
    usuarioNombre:
      [t.usuario?.nombre, t.usuario?.apellido].filter(Boolean).join(' ') || '',
    busId: t.id_bus,
    busLabel: `${t.bus?.patente ?? ''} - ${t.bus?.modelo ?? ''}`,
    inicio: t.hora_inicio,
    fin: t.hora_fin,
    estado: t.estado?.nombre_estado ?? '',
    id_estado_turno: t.id_estado_turno,
    titulo: t.titulo ?? '',
    descripcion: t.descripcion ?? '',
    ruta_origen: t.ruta_origen,
    ruta_fin: t.ruta_fin,
  }))

  return { items }
})
