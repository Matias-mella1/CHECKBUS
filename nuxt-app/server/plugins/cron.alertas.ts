// server/plugins/cron.alertas.ts
import { CronJob } from 'cron'
import { generarAlertas } from '../lib/alertas'

declare global {
  // eslint-disable-next-line no-var
  var __ALERTS_CRON__: CronJob | undefined
}

// Nitro detecta este default export como plugin automáticamente
export default function (nitroApp: any) {
  // Evitar múltiples jobs en dev/HMR
  if ((globalThis as any).__ALERTS_CRON__) return

  const cronExpr = process.env.ALERTS_CRON || '5 8 * * *' // 08:05 todos los días

  const job = new CronJob(
    cronExpr,
    () => {
      generarAlertas().catch((err) => {
        console.error('[CRON alertas] Error generando alertas:', err)
      })
    },
    null,
    true,
    'America/Santiago'
  )

  ;(globalThis as any).__ALERTS_CRON__ = job

  // Detener cron cuando se apaga Nitro
  nitroApp.hooks.hook('close', () => {
    job.stop()
  })
}
