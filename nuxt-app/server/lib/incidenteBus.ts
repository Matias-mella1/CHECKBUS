// server/lib/incidentesBus.ts
import { prisma } from '../utils/prisma'
import { recomputeBusEstado } from './busEstado'

export async function updateBusEstadoOnIncidente(id_incidente: number) {
  const inc = await prisma.incidente.findUnique({
    where: { id_incidente },
    select: { id_bus: true },
  })

  if (!inc) return

  await recomputeBusEstado(inc.id_bus)
}
