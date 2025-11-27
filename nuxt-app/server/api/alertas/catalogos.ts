import { prisma } from '../../utils/prisma'
import { defineEventHandler } from 'h3'


export default defineEventHandler(async () => {
  const estados = await prisma.estadoAlerta.findMany({
    select: { id_estado_alerta: true, nombre_estado: true },
    orderBy: { nombre_estado: 'asc' },
  })

  const tipos = await prisma.tipoAlerta.findMany({
    select: { id_tipo_alerta: true, nombre_tipo: true, categoria: true },
    orderBy: { nombre_tipo: 'asc' },
  })

  return {
    estados: estados.map(e => ({
      id: e.id_estado_alerta,
      nombre: e.nombre_estado,
    })),
    tipos: tipos.map(t => ({
      id: t.id_tipo_alerta,
      nombre: t.nombre_tipo,
      categoria: t.categoria,
    })),
  }
})
