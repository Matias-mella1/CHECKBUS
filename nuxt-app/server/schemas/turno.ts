// server/schemas/turno.ts
import {object,number,string,optional,minLength,pipe,custom,} from 'valibot'

const DateTimeSchema = pipe(
  string('La fecha y hora es obligatoria.'),
  custom(
    (value) => {
      const d = new Date(value as string)
      return !Number.isNaN(d.getTime())
    },
    'Fecha y hora inválida.'
  )
)

export const TurnoCreateSchema = object({
  id_usuario: number('Conductor es obligatorio.'),
  id_bus: number('Bus es obligatorio.'),
  inicio: DateTimeSchema,                   
  fin: DateTimeSchema,                     

  titulo: optional(
    pipe(
      string(),
      minLength(3, 'El título debe tener al menos 3 caracteres.')
    )
  ),

  descripcion: optional(string()),
  id_estado_turno: optional(number('Estado de turno inválido.')),

  ruta_origen: optional(string()),
  ruta_fin: optional(string()),
})

export const TurnoUpdateSchema = object({
  id_bus: optional(number('Bus inválido.')),
  inicio: optional(DateTimeSchema),
  fin: optional(DateTimeSchema),

  titulo: optional(
    pipe(
      string(),
      minLength(3, 'El título debe tener al menos 3 caracteres.')
    )
  ),
  descripcion: optional(string()),
  id_estado_turno: optional(number('Estado de turno inválido.')),

  ruta_origen: optional(string()),
  ruta_fin: optional(string()),
})
