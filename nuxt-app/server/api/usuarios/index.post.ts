// server/api/usuarios/index.post.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import crypto from 'crypto'
import { hashPassword } from '../../utils/password'

// ⭐ IMPORTA tu helper de correo
import { sendPasswordResetEmail } from '../../utils/mailer-resend'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      rut: string
      nombre: string
      apellido: string
      email: string
      username: string
      telefono?: string
      licencia?: string
      roles?: string[]
    }>(event)

    const estadoPendiente = await prisma.estadoUsuario.findFirst({
      where: { nombre_estado: 'PENDIENTE' },
    })

    if (!estadoPendiente) {
      throw createError({ statusCode: 500, message: 'Estado PENDIENTE no existe' })
    }

    // ✔ token temporal para password
    const tempPlain = crypto.randomBytes(16).toString('hex')
    const tempHash = await hashPassword(tempPlain)

    // ✔ token para correo
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const { created } = await prisma.$transaction(async (tx) => {
      // 1) Crear usuario
      const user = await tx.usuario.create({
        data: {
          rut: body.rut.trim(),
          nombre: body.nombre.trim(),
          apellido: body.apellido.trim(),
          email: body.email.trim().toLowerCase(),
          username: body.username.trim(),
          telefono: body.telefono?.trim() || undefined,
          licencia_con: body.licencia?.trim() || undefined,
          password_hash: tempHash,
          estado_usuario: {
            connect: { id_estado_usuario: estadoPendiente.id_estado_usuario },
          },
        },
      })

      // 2) Crear token de restablecimiento
      await tx.tokenRestablecimiento.create({
        data: {
          codigo_token: token,
          id_usuario: user.id_usuario,
          fecha_expiracion: expira,
        },
      })

      // 3) Crear roles
      const rolesNombres = (body.roles || []).filter((r) => !!r)

      if (rolesNombres.length) {
        const roles = await tx.rol.findMany({
          where: { nombre_rol: { in: rolesNombres } },
        })

        if (roles.length) {
          await tx.usuarioRol.createMany({
            data: roles.map((r) => ({
              id_usuario: user.id_usuario,
              id_rol: r.id_rol,
              estado: 'VIGENTE',
            })),
          })
        }
      }

      return { created: user }
    })

    // ⭐ ENVÍO DE CORREO
    let emailError: string | null = null

    try {
      await sendPasswordResetEmail({
        to: created.email,
        nombre: created.nombre,
        username: created.username,   // 👈 AQUÍ SE AGREGA EL USERNAME
        token,
      })
    } catch (err: any) {
      console.error('⚠️ Error enviando correo:', err)
      emailError = err.message || 'No se pudo enviar el correo.'
    }

    setResponseStatus(event, 201)

    return {
      message: emailError
        ? 'Usuario creado, pero no se pudo enviar el correo.'
        : 'Usuario creado y correo enviado.',
      emailError: emailError || undefined,
    }
  } catch (err: any) {
    console.error(err)
    throw createError({ statusCode: 500, message: 'Error creando usuario' })
  }
})
