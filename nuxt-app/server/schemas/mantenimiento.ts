// utils/schemas/mantenimiento.ts
import {object,number,string,optional,nullable,pipe,trim,nonEmpty,minValue,regex,} from 'valibot'

const DateStringSchema = pipe(
  string('La fecha es obligatoria.'),
  trim(),
  nonEmpty('La fecha es obligatoria.'),
  regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD.')
)

const IdSchema = (label: string) =>
  pipe(
    number(`El ${label} es obligatorio.`),
    minValue(1, `El ${label} debe ser mayor a 0.`)
  )

const CostoManoObraSchema = optional(
  pipe(
    number('El costo de mano de obra debe ser un número.'),
    minValue(0, 'El costo de mano de obra no puede ser negativo.')
  )
)

export const MantenimientoCreateSchema = object({
  id_bus: IdSchema('bus'),
  id_taller: IdSchema('taller'),
  id_tipo_mantenimiento: IdSchema('tipo de mantenimiento'),
  id_estado_mantenimiento: IdSchema('estado de mantenimiento'),
  fecha: DateStringSchema,
  costo_mano_obra: CostoManoObraSchema,
  observaciones: optional(nullable(string('Observaciones inválidas.'))),
})

export const MantenimientoUpdateSchema = object({
  id_estado_mantenimiento: IdSchema('estado de mantenimiento'),
  costo_mano_obra: CostoManoObraSchema,
  observaciones: optional(nullable(string('Observaciones inválidas.'))),
})
