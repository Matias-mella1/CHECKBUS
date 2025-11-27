// server/api/usuarios/index.post.ts
import { prisma } from '../../utils/prisma'
import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import crypto from 'crypto'
import { hashPassword } from '../../utils/password'
import { sendPasswordResetEmail } from '../../utils/mailer-resend'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const estadoPendiente = await prisma.estadoUsuario.findFirst({
      where: { nombre_estado: 'PENDIENTE' },
    })

    if (!estadoPendiente) {
      throw createError({
        statusCode: 500,
        message: 'Estado PENDIENTE no existe',
      })
    }

    // Token temporal para password
    const tempPlain = crypto.randomBytes(16).toString('hex')
    const tempHash = await hashPassword(tempPlain)

    //Token para correo
    const token = crypto.randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000)

    // Crear usuario + token + roles
    const { created } = await prisma.$transaction(async (tx) => {
      // Usuario
      const user = await tx.usuario.create({
        data: {
          rut: body.rut.trim(),
          nombre: body.nombre.trim(),
          apellido: body.apellido.trim(),
          email: body.email.trim().toLowerCase(),
          username: body.username.trim(),
          telefono: body.telefono?.trim() || null,
          licencia_con: body.licencia?.trim() || null,
          password_hash: tempHash,
          estado_usuario: {
            connect: {
              id_estado_usuario: estadoPendiente.id_estado_usuario,
            },
          },
        },
      })

      // Token de restablecimiento
      await tx.tokenRestablecimiento.create({
        data: {
          codigo_token: token,
          id_usuario: user.id_usuario,
          fecha_expiracion: expira,
        },
      })

      // Roles
      const rolesNombres = (body.roles || []).filter(Boolean)

      if (rolesNombres.length) {
        const roles = await tx.rol.findMany({
          where: { nombre_rol: { in: rolesNombres } },
        })

        if (roles.length > 0) {
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

    // Enviar correo de bienvenida + token
    let emailError: string | null = null

    try {
      await sendPasswordResetEmail({
        to: created.email,
        nombre: created.nombre,
        username: created.username,
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
