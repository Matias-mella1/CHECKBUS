// server/lib/mantenimientoBus.ts
import { prisma } from '../utils/prisma'
import { recomputeBusEstado } from './busEstado'

export async function syncBusEstadoFromMantenimiento(id_mantenimiento: number) {
  const mant = await prisma.mantenimiento.findUnique({
    where: { id_mantenimiento },
    select: { id_bus: true },
  })

  if (!mant) return

  await recomputeBusEstado(mant.id_bus)
}
