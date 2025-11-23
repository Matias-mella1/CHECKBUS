// server/api/roles/index.get.ts
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const roles = await prisma.rol.findMany({ orderBy: { id_rol: 'asc' } })
  return { items: roles.map(r => ({ id: r.id_rol, nombre: r.nombre_rol })) }
})