// utils/schemas/documento.ts
import {object,string,number,optional,minLength,maxLength,  trim,pipe,union,literal,nullable,} from 'valibot'

const NombreArchivo = pipe(
  string('Nombre debe ser texto.'),
  trim(),
  minLength(1, 'El nombre es obligatorio.'),
  maxLength(100, 'El nombre no puede superar 100 caracteres.'),
)

const RutaArchivo = pipe(
  string('Ruta debe ser texto.'),
  trim(),
  minLength(1, 'La ruta es obligatoria.'),
  maxLength(255, 'La ruta no puede superar 255 caracteres.'),
)

const NullableNumber = nullable(number('Debe ser numérico.'))


export const CrearDocumentoDto = object({
  nombre_archivo:      NombreArchivo,
  ruta:                RutaArchivo,
  id_tipo_documento:   number('Tipo de documento debe ser numérico.'),
  id_estado_documento: number('Estado debe ser numérico.'),

  fecha_caducidad: optional(string('Fecha debe ser texto.')),
  tamano:          optional(number('Tamaño debe ser numérico.')),

  id_bus:           optional(NullableNumber),
  id_usuario:       optional(NullableNumber),
  id_mantenimiento: optional(NullableNumber),
  id_incidente:     optional(NullableNumber),
})


export const ActualizarDocumentoDto = object({
  nombre_archivo:      optional(NombreArchivo),
  ruta:                optional(RutaArchivo),
  id_tipo_documento:   optional(NullableNumber),
  id_estado_documento: optional(NullableNumber),

  fecha_caducidad: optional(string('Fecha debe ser texto.')),
  tamano:          optional(number('Tamaño debe ser numérico.')),

  id_bus:           optional(NullableNumber),
  id_usuario:       optional(NullableNumber),
  id_mantenimiento: optional(NullableNumber),
  id_incidente:     optional(NullableNumber),
})


export const ListaDocumentoQueryDto = object({
  q:                   optional(string()),
  id_tipo_documento:   optional(string()),
  id_estado_documento: optional(string()),
  categoria:           optional(string()),
  page:                optional(string()),
  pageSize:            optional(string()),
  limit:               optional(string()),
  sortBy: optional(
    union([
      literal('fecha_creacion'),
      literal('nombre_archivo'),
      literal('tamano'),
    ]),
  ),
  sortOrder: optional(
    union([literal('asc'), literal('desc')]),
  ),
})
