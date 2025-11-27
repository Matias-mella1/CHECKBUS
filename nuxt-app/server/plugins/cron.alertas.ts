// server/plugins/cron.alertas.ts
import { CronJob } from 'cron'
import { generarAlertas } from '../lib/alertas'

declare global {
  var __ALERTS_CRON__: CronJob | undefined
}

export default function (nitroApp: any) {

  if ((globalThis as any).__ALERTS_CRON__) return

  const cronExpr = process.env.ALERTS_CRON || '5 8 * * *' 

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

  nitroApp.hooks.hook('close', () => {
    job.stop()
  })
}
