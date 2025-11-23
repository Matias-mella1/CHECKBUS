// utils/date.ts

export function toDateOrNull(ymd?: string | null): Date | null {
  if (!ymd) return null
  const [y,m,d] = ymd.split('-').map(n => parseInt(n,10))
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m-1, d))
}

// datetime-local (YYYY-MM-DDTHH:mm)
export function toDateTimeOrNull(str?: string | null): Date | null {
  if (!str) return null
  const dt = new Date(str)
  if (isNaN(dt.getTime())) return null
  return dt
}
