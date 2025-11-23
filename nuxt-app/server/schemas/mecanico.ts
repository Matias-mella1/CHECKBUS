// utils/schemas/mecanico.ts
import {
  object,
  string,
  number,
  optional,
  pipe,
  trim,
  nonEmpty,
  minLength,
  maxLength,
  minValue,
} from 'valibot'

/* ------------------ Campos básicos ------------------ */
const NombreSchema = pipe(
  string('El nombre es obligatorio.'),
  trim(),
  nonEmpty('El nombre es obligatorio.'),
  minLength(2, 'El nombre debe tener al menos 2 caracteres.'),
  maxLength(80, 'El nombre no puede superar 80 caracteres.')
)

const ApellidoSchema = pipe(
  string('El apellido es obligatorio.'),
  trim(),
  nonEmpty('El apellido es obligatorio.'),
  minLength(2, 'El apellido debe tener al menos 2 caracteres.'),
  maxLength(80, 'El apellido no puede superar 80 caracteres.')
)

const IdTallerSchema = pipe(
  number('El taller es obligatorio.'),
  minValue(1, 'El taller es inválido.')
)

/* ------------------ CREATE ------------------ */
export const MecanicoCreateSchema = object({
  id_taller: IdTallerSchema,
  nombre: NombreSchema,
  apellido: ApellidoSchema,
})

/* ------------------ UPDATE ------------------ */
export const MecanicoUpdateSchema = object({
  id_taller: optional(IdTallerSchema),
  nombre: optional(NombreSchema),
  apellido: optional(ApellidoSchema),
})

/* ------------------ QUERY (BÚSQUEDA) ------------------ */
/**
 * Aquí SOLO aceptamos:
 *  - undefined
 *  - number (>= 1)
 *
 * Nada de strings. La conversión '2' -> 2 la hacemos en el handler.
 */
export const MecanicoQuerySchema = object({
  id_taller: optional(
    pipe(
      number('El taller debe ser numérico.'),
      minValue(1, 'El taller es inválido.')
    )
  ),

  q: optional(
    pipe(
      string('Parámetro de búsqueda inválido.'),
      trim(),
      maxLength(100, 'La búsqueda es demasiado larga.')
    )
  ),
})
