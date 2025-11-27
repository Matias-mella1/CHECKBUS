// server/lib/estados.ts
import { prisma } from '../utils/prisma'

export async function getEstadoBusId(nombre: string): Promise<number> {
  const upper = nombre.toUpperCase().trim()

  const found = await prisma.estadoBus.findFirst({
    where: {
      nombre_estado: {
        equals: upper,
        mode: 'insensitive',
      },
    },
    select: { id_estado_bus: true },
  })

  if (found) return found.id_estado_bus

  const created = await prisma.estadoBus.create({
    data: {
      nombre_estado: upper,
      descripcion: `Estado creado automáticamente (${upper})`,
    },
    select: { id_estado_bus: true },
  })

  return created.id_estado_bus
}
