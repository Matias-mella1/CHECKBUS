import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError, setHeader } from 'h3'
import { safeParse } from 'valibot'
import { MantenimientoUpdateSchema } from '../../schemas/mantenimiento'
import { syncBusEstadoFromMantenimiento } from '../../lib/mantenimientoBus'
import { generarAlertaMantenimientoFinalizado } from '../../lib/alertas'
import { Prisma } from '@prisma/client'

type MantenimientoConRelaciones = Prisma.MantenimientoGetPayload<{
  include: {
    estado: true
    bus: true
    tipo: true
    taller: true
  }
}>

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const id = Number(event.context.params!.id)

  if (!id) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }

  try {
    const body = await readBody(event)

    const parsed = safeParse(MantenimientoUpdateSchema, body)
    if (!parsed.success) {
      const msg = parsed.issues.map((i) => i.message).join(', ')
      throw createError({ statusCode: 400, message: msg })
    }
    const data = parsed.output as any

    const existente = await prisma.mantenimiento.findUnique({
      where: { id_mantenimiento: id },
      include: { estado: true, bus: true, tipo: true, taller: true },
    })

    if (!existente) {
      throw createError({
        statusCode: 404,
        message: 'Mantenimiento no encontrado',
      })
    }

    const manoObraInput =
      data.costo_mano_obra !== undefined && data.costo_mano_obra !== null
        ? data.costo_mano_obra
        : (data.costo !== undefined && data.costo !== null
            ? data.costo
            : undefined)

    const manoObra =
      manoObraInput !== undefined && manoObraInput !== null
        ? Number(manoObraInput)
        : Number(existente.costo_mano_obra ?? 0)

    const totalRepuestos = Number(existente.costo_repuestos ?? 0)

    const actualizado: MantenimientoConRelaciones =
      await prisma.mantenimiento.update({
        where: { id_mantenimiento: id },
        data: {
          id_estado_mantenimiento: data.id_estado_mantenimiento,
          observaciones: data.observaciones ?? null,

          // sincroniza mano de obra + total
          costo_mano_obra: manoObra,
          costo_total: manoObra + totalRepuestos,
        },
        include: {
          estado: true,
          bus: true,
          tipo: true,
          taller: true,
        },
      })

    await syncBusEstadoFromMantenimiento(actualizado.id_mantenimiento)

    const nuevoEstadoMant = actualizado.estado.nombre_estado
      .toUpperCase()
      .trim()

    if (nuevoEstadoMant === 'COMPLETADO') {
      try {
        await generarAlertaMantenimientoFinalizado(actualizado.id_mantenimiento)
      } catch (e) {
        console.error(
          'Error creando alerta/correo de mantenimiento completado:',
          e
        )
      }
    }

    return { item: actualizado }
  } catch (err: any) {
    console.error(' Error en PUT /api/mantenimientos/:id', err)
    if (err?.statusCode) throw err
    throw createError({
      statusCode: 500,
      message: 'Error al actualizar mantenimiento',
    })
  }
})
