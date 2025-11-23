// server/utils/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

// 🔧 Reutiliza una sola instancia (evita múltiples conexiones)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'], // puedes agregar 'query' para debug
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
