// utils/schemas/taller.ts
import {
  object,
  string,
  number,
  optional,
  nullable,
  pipe,
  trim,
  nonEmpty,
  minLength,
  maxLength,
  minValue,
  email as emailRule,
  union,
  transform,
} from 'valibot'

const NombreTallerSchema = pipe(
  string('El nombre es obligatorio.'),
  trim(),
  nonEmpty('El nombre es obligatorio.'),
  minLength(2, 'El nombre debe tener al menos 2 caracteres.'),
  maxLength(120, 'El nombre no puede superar 120 caracteres.')
)

const IdTipoTallerSchema = pipe(
  number('El tipo de taller es obligatorio.'),
  minValue(1, 'El tipo de taller es inválido.')
)

const TextoCortoOpcional = optional(
  nullable(
    pipe(
      string('Valor inválido.'),
      trim(),
      maxLength(200, 'El texto es demasiado largo (máx. 200 caracteres).')
    )
  )
)

const EmailOpcional = optional(
  nullable(
    pipe(
      string('Email inválido.'),
      trim(),
      emailRule('El email no tiene un formato válido.')
    )
  )
)

export const TallerCreateSchema = object({
  nombre: NombreTallerSchema,
  id_tipo_taller: IdTipoTallerSchema,
  contacto: TextoCortoOpcional,
  direccion: TextoCortoOpcional,
  email: EmailOpcional,
})

export const TallerUpdateSchema = object({
  nombre: optional(NombreTallerSchema),
  id_tipo_taller: optional(IdTipoTallerSchema),
  contacto: TextoCortoOpcional,
  direccion: TextoCortoOpcional,
  email: EmailOpcional,
})

/**
 * ⚠️ Aquí estaba el problema:
 * - Antes: number() → peta si llega "3" (string desde la query)
 * - Ahora: union([string(), number()]) + transform → lo convertimos a number o undefined
 */
const IdTipoTallerQuerySchema = optional(
  pipe(
    union([string(), number()]),
    transform((v) => {
      // sin filtro => no se usa en el WHERE
      if (v === '' || v == null) return undefined

      const n = Number(v)
      if (Number.isNaN(n)) {
        throw new Error('El tipo de taller debe ser numérico.')
      }
      if (n < 1) {
        throw new Error('El tipo de taller es inválido.')
      }
      return n
    })
  )
)

export const TallerQuerySchema = object({
  id_tipo_taller: IdTipoTallerQuerySchema,
  q: optional(
    pipe(
      string('Parámetro de búsqueda inválido.'),
      trim(),
      maxLength(100, 'La búsqueda es demasiado larga.')
    )
  ),
})
