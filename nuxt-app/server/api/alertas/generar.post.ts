// server/api/alertas/generar.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { safeParse } from 'valibot'
import { GenerarAlertasDto } from '../../schemas/alerta'
import { generarAlertas } from '../../lib/alertas'

export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  const parsed = safeParse(GenerarAlertasDto, raw)

  if (!parsed.success) {
    const msg = parsed.issues?.[0]?.message || 'Datos inválidos'
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const { diasVentana } = parsed.output
  await generarAlertas({ diasVentana: diasVentana ?? 30 })

  return { ok: true }
})
