// utils/schemas/proveedor.ts
import {object,string,optional,union,literal,minLength,maxLength,pipe,trim,transform,} from 'valibot'

const NombreProveedor = pipe(
  string('Nombre debe ser texto.'),
  trim(),
  minLength(1, 'El nombre es obligatorio.'),
  maxLength(150, 'El nombre no puede superar 150 caracteres.')
)

const DireccionProveedor = pipe(
  string('Dirección debe ser texto.'),
  trim(),
  maxLength(200, 'Dirección: máx 200 caracteres.')
)

const TelefonoProveedor = pipe(
  string('Teléfono debe ser texto.'),
  trim(),
  maxLength(20, 'Teléfono: máx 20 caracteres.')
)

const EmailProveedor = pipe(
  string('Email debe ser texto.'),
  trim(),
  maxLength(100, 'Email: máx 100 caracteres.')
)

export const CrearProveedorDto = object({
  nombre: NombreProveedor,
  direccion: optional(DireccionProveedor),
  telefono: optional(TelefonoProveedor),
  email: optional(EmailProveedor),
})

export const ActualizarProveedorDto = object({
  nombre: optional(NombreProveedor),
  direccion: optional(DireccionProveedor),
  telefono: optional(TelefonoProveedor),
  email: optional(EmailProveedor),
})


const ToNumber = pipe(
  string(),
  trim(),
  transform((v) => Number(v))
)

export const ListaProveedorQueryDto = object({
  q: optional(string()),
  nombre: optional(string()),
  email: optional(string()),
  telefono: optional(string()),

  page: optional(ToNumber),
  pageSize: optional(ToNumber),

  sortBy: optional(
    union([
      literal('nombre'),
      literal('email'),
      literal('telefono'),
      literal('id'),
    ])
  ),

  sortOrder: optional(
    union([literal('asc'), literal('desc')])
  ),
})
