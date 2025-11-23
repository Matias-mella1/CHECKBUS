// schemas/bus.ts
import * as v from 'valibot'

export const busSchema = v.object({
  patente: v.pipe(
    v.string('⚠️ La Patente es obligatoria.'),
    v.regex(
      /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2}|[A-Z]{5}\d{1})$/i,
      '🚫 Patente inválida. Formatos aceptados: AA1234, ABCD12 o ABCDE1.'
    )
  ),

  marca: v.pipe(
    v.string('🏷️ La Marca es obligatoria.'),
    v.minLength(2, '🏷️ La Marca debe tener al menos 2 caracteres.')
  ),

  modelo: v.pipe(
    v.string('🚌 El Modelo es obligatorio.'),
    v.minLength(1, '🚌 El Modelo debe tener al menos 1 carácter.')
  ),

  combustible: v.picklist(
    ['DIESEL', 'GASOLINA', 'GAS', 'ELECTRICO'],
    '⛽️ Combustible inválido. Selecciona una opción.'
  ),

  anio: v.nullish(
    v.pipe(
      v.number('Año inválido.'),
      v.minValue(1950, 'El Año no puede ser menor a 1950.'),
      v.maxValue(2050, 'El Año es demasiado alto (máximo 2050).')
    )
  ),
  kilometraje: v.nullish(
    v.pipe(
      v.number('Kilómetros inválidos.'),
      v.minValue(0, 'Kilometraje no puede ser negativo.')
    )
  ),

  capacidad: v.nullish(
    v.pipe(
      v.number('Capacidad inválida.'),
      v.minValue(1, '👥 Capacidad mínima: 1 pasajero.'),
      v.maxValue(100, 'Capacidad demasiado alta.')
    )
  ),

  fechaRevisionTecnica: v.pipe(
    v.string('📆 Ingrese la fecha de revisión técnica.'),
    v.regex(/^\d{4}-\d{2}-\d{2}$/, '📆 Formato inválido. Use AAAA-MM-DD.')
  ),
  fechaExtintor: v.pipe(
    v.string('🧯 Ingrese la fecha de vencimiento del extintor.'),
    v.regex(/^\d{4}-\d{2}-\d{2}$/, '🧯 Formato inválido. Use AAAA-MM-DD.')
  ),

  estado: v.picklist(
    ['OPERATIVO', 'MANTENIMIENTO', 'FUERA DE SERVICIO'],
    '🚦 Estado inválido. Selecciona una opción.'
  ),
})
