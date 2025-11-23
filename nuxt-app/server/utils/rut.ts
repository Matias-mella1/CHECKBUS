// server/utils/rut.ts
export function validarRutChileno(raw: string): boolean {
  const value = raw.trim().toUpperCase()
  const clean = value.replace(/\./g, '').replace(/-/g, '')
  if (clean.length < 8) return false

  const cuerpo = clean.slice(0, -1)
  const dv     = clean.slice(-1)

  if (!/^\d+$/.test(cuerpo)) return false

  let suma = 0
  let multiplo = 2

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    const digit = cuerpo.charAt(i)
    suma += parseInt(digit, 10) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto = suma % 11
  const dvCalcNum = 11 - resto
  let dvCalc: string

  if (dvCalcNum === 11) dvCalc = '0'
  else if (dvCalcNum === 10) dvCalc = 'K'
  else dvCalc = String(dvCalcNum)

  return dv === dvCalc
}
