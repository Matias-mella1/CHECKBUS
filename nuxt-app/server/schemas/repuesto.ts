// utils/schemas/repuesto.ts
import {object,string,optional,number,minLength,maxLength,trim,pipe,check,union,literal,} from 'valibot'


const NombreRepuesto = pipe(
  string('Nombre debe ser texto.'),
  trim(),
  minLength(1, 'El nombre es obligatorio.'),
  maxLength(150, 'El nombre no puede superar 150 caracteres.')
)

const DescripcionRepuesto = pipe(
  string('Descripción debe ser texto.'),
  trim(),
  maxLength(500, 'Descripción: máx 500 caracteres.')
)

const CostoRepuesto = pipe(
  number('Costo debe ser numérico.'),
  check((v) => v >= 0, 'Costo debe ser mayor o igual a 0.')
)

function IdPositivo(label: string) {
  return pipe(
    number(`${label} debe ser numérico.`),
    check((v) => Number.isInteger(v) && v > 0, `${label} es obligatorio.`)
  )
}

export const CrearRepuestoDto = object({
  nombre: NombreRepuesto,
  descripcion: optional(DescripcionRepuesto),
  costo: CostoRepuesto,
  id_estado_repuesto: IdPositivo('Estado'),
  id_tipo_repuesto: IdPositivo('Tipo'),
  id_proveedor: IdPositivo('Proveedor'),
})

export const ActualizarRepuestoDto = object({
  nombre: optional(NombreRepuesto),
  descripcion: optional(DescripcionRepuesto),
  costo: optional(CostoRepuesto),
  id_estado_repuesto: optional(IdPositivo('Estado')),
  id_tipo_repuesto: optional(IdPositivo('Tipo')),
  id_proveedor: optional(IdPositivo('Proveedor')),
})


export const RepuestoListaQueryDto = object({
  q: optional(string()),
  id_estado_repuesto: optional(string()),
  id_tipo_repuesto: optional(string()),
  id_proveedor: optional(string()),
  costoMin: optional(string()),
  costoMax: optional(string()),
  page: optional(string()),
  pageSize: optional(string()),
  sortBy: optional(
    union([
      literal('id_repuesto'),
      literal('nombre'),
      literal('costo'),
    ])
  ),
  sortOrder: optional(
    union([literal('asc'), literal('desc')])
  ),
})
