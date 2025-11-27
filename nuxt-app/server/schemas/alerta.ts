// utils/schemas/alerta.ts
import {object,string,number,optional,boolean,minLength,maxLength,trim,pipe,union,literal,} from 'valibot'


const TextoCorto = pipe(
  string('Debe ser texto.'),
  trim(),
  minLength(1, 'El valor es obligatorio.'),
  maxLength(255, 'No puede superar 255 caracteres.')
)

export const ListaAlertaQueryDto = object({
  q:                 optional(string()),
  id_estado_alerta:  optional(string()),
  id_tipo_alerta:    optional(string()),
  page:              optional(string()),
  pageSize:          optional(string()),
})

export const ActualizarAlertaDto = object({
  atender:          optional(boolean()),
  cerrar:           optional(boolean()),
  id_estado_alerta: optional(number('id_estado_alerta debe ser numérico.')),
  prioridad: optional(
    union([
      literal('ALTA'),
      literal('MEDIA'),
      literal('BAJA'),
      literal('alta'),
      literal('media'),
      literal('baja'),
      TextoCorto,
    ])
  ),
})

export const GenerarAlertasDto = object({
  diasVentana: optional(
    number('diasVentana debe ser numérico.')
  ),
})
