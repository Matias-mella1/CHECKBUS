// server/utils/schemas/usuario.ts
import {object,string,optional,array,minLength,maxLength,email as emailRule,custom,pipe,union,literal,} from 'valibot'
import { validarRutChileno } from '../utils/rut'

const RutSchema = pipe(
  string('RUT es obligatorio'),
  custom(
    (value) => {
      if (typeof value !== 'string') return false
      return /^\d{7,8}-[\dkK]$/.test(value.trim())
    },
    'Formato RUT inválido. Usa 12345678-9 (sin puntos).'
  ),
  custom(
    (value) => {
      if (typeof value !== 'string') return false
      return validarRutChileno(value)
    },
    'RUT inválido. Ejemplo: 12345678-9'
  )
)

const TelefonoSchema = optional(
  pipe(
    string(),
    custom(
      (value) => {
        if (typeof value !== 'string') return false
        const clean = value.replace(/\s+/g, '')
        if (!clean) return true
        return /^9\d{8}$/.test(clean)
      },
      'Teléfono inválido. Usa 912345678 (sin +56).'
    )
  )
)

const LicenciaSchema = optional(
  pipe(
    string(),
    maxLength(100, 'La licencia no puede superar 100 caracteres')
  )
)

const RolesSchema = optional(
  array(
    pipe(
      string('Rol inválido'),
      minLength(2, 'El nombre de rol es demasiado corto')
    ),
    'Roles inválidos'
  )
)

const EstadoSchema = optional(
  union(
    [
      literal('ACTIVO'),
      literal('INACTIVO'),
      literal('SUSPENDIDO'),
      literal('PENDIENTE'),
    ],
    'Estado inválido'
  )
)

const PasswordSchema = optional(
  pipe(
    string('Contraseña inválida'),
    minLength(8, 'La contraseña debe tener al menos 8 caracteres')
  )
)

export const UsuarioCreateSchema = object({
  rut: RutSchema,
  nombre: pipe(
    string('Nombre es obligatorio'),
    minLength(2, 'Nombre demasiado corto'),
    maxLength(100, 'Nombre demasiado largo')
  ),
  apellido: pipe(
    string('Apellido es obligatorio'),
    minLength(2, 'Apellido demasiado corto'),
    maxLength(100, 'Apellido demasiado largo')
  ),
  email: pipe(
    string('Email es obligatorio'),
    emailRule('Email inválido'),
    maxLength(150, 'Email demasiado largo')
  ),
  username: pipe(
    string('Usuario es obligatorio'),
    minLength(3, 'El usuario debe tener al menos 3 caracteres'),
    maxLength(50, 'Usuario demasiado largo')
  ),
  telefono: TelefonoSchema,
  licencia: LicenciaSchema,
  roles: RolesSchema,
})

export const UsuarioUpdateSchema = object({
  rut: RutSchema,
  nombre: pipe(
    string('Nombre es obligatorio'),
    minLength(2, 'Nombre demasiado corto'),
    maxLength(100, 'Nombre demasiado largo')
  ),
  apellido: pipe(
    string('Apellido es obligatorio'),
    minLength(2, 'Apellido demasiado corto'),
    maxLength(100, 'Apellido demasiado largo')
  ),
  email: pipe(
    string('Email es obligatorio'),
    emailRule('Email inválido'),
    maxLength(150, 'Email demasiado largo')
  ),
  username: pipe(
    string('Usuario es obligatorio'),
    minLength(3, 'El usuario debe tener al menos 3 caracteres'),
    maxLength(50, 'Usuario demasiado largo')
  ),
  telefono: TelefonoSchema,
  licencia: LicenciaSchema,
  roles: RolesSchema,
  estado: EstadoSchema,
  password: PasswordSchema,
})
