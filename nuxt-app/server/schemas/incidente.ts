// utils/schemas/incidente.ts
import {
  object,
  number,
  string,
  optional,
  nullable,
  pipe,
  trim,
  nonEmpty,
  minValue,
  maxLength,
  regex,
  union,
  transform,
} from 'valibot'

/* -------- IDs básicos -------- */
const IdBusSchema = pipe(
  number('El bus es obligatorio.'),
  minValue(1, 'El bus es inválido.')
)

const IdUsuarioSchema = pipe(
  number('El usuario es inválido.'),
  minValue(1, 'El usuario es inválido.')
)

const IdTipoSchema = pipe(
  number('El tipo de incidente es obligatorio.'),
  minValue(1, 'El tipo de incidente es inválido.')
)

// 👇 NUEVO: schema para estado del incidente
const IdEstadoIncidenteSchema = pipe(
  number('El estado del incidente es inválido.'),
  minValue(1, 'El estado del incidente es inválido.')
)

/* -------- Fecha -------- */
const FechaSchema = pipe(
  string('La fecha es obligatoria.'),
  trim(),
  nonEmpty('La fecha es obligatoria.'),
  regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD.')
)

/* -------- Textos -------- */
const TextoCortoOpcional = optional(
  nullable(
    pipe(
      string('Texto inválido.'),
      trim(),
      maxLength(200, 'Máximo 200 caracteres.')
    )
  )
)

const DescripcionOpcional = optional(
  nullable(
    pipe(
      string('Descripción inválida.'),
      trim(),
      maxLength(2000, 'Máximo 2000 caracteres.')
    )
  )
)

/* -------- Paginación -------- */
const PageNumberSchema = optional(
  pipe(
    union([string(), number()]),
    transform((v) => {
      if (v === '' || v == null) return 1
      const n = Number(v)
      return isNaN(n) || n < 1 ? 1 : n
    })
  )
)

const PageSizeSchema = optional(
  pipe(
    union([string(), number()]),
    transform((v) => {
      if (v === '' || v == null) return 20
      const n = Number(v)
      return isNaN(n) || n < 1 ? 20 : n
    })
  )
)

/* -------- DTO: Crear -------- */
export const CrearIncidenteDto = object({
  id_bus: IdBusSchema,
  id_usuario: optional(IdUsuarioSchema),
  fecha: FechaSchema,

  urgencia: TextoCortoOpcional,
  ubicacion: TextoCortoOpcional,
  descripcion: DescripcionOpcional,

  id_tipo_incidente: IdTipoSchema,

  // opcional: si no lo mandas, la BD puede poner por defecto REPORTADO
  id_estado_incidente: optional(IdEstadoIncidenteSchema),
})

/* -------- DTO: Listar (query) -------- */
export const ListaQueryDto = object({
  page: PageNumberSchema,
  pageSize: PageSizeSchema,

  id_bus: optional(IdBusSchema),
  id_usuario: optional(IdUsuarioSchema),
  id_tipo_incidente: optional(IdTipoSchema),

  // 👇 también puedes filtrar por estado si lo usas en el GET
  id_estado_incidente: optional(IdEstadoIncidenteSchema),

  urgencia: optional(
    pipe(
      string('Urgencia inválida.'),
      trim(),
      maxLength(50, 'Máximo 50 caracteres.')
    )
  ),

  desde: optional(FechaSchema),
  hasta: optional(FechaSchema),

  q: optional(
    pipe(
      string('Parámetro de búsqueda inválido.'),
      trim(),
      maxLength(200, 'La búsqueda es demasiado larga.')
    )
  ),

  sortBy: optional(pipe(string(), trim())),
  sortOrder: optional(pipe(string(), trim())),
})

/* -------- DTO: Actualizar -------- */
export const ActualizarIncidenteDto = object({
  id_bus: optional(IdBusSchema),
  id_usuario: optional(IdUsuarioSchema),
  fecha: optional(FechaSchema),

  urgencia: TextoCortoOpcional,
  ubicacion: TextoCortoOpcional,
  descripcion: DescripcionOpcional,

  id_tipo_incidente: optional(IdTipoSchema),

  // 👈 LO QUE FALTABA: ahora Valibot acepta el campo que mandas desde el front
  id_estado_incidente: optional(IdEstadoIncidenteSchema),
})
