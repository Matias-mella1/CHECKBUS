// server/api/usuarios/[id].put.ts
import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { safeParse } from 'valibot'
import { UsuarioUpdateSchema } from '../../schemas/usuario'

export default defineEventHandler(async (event) => {
  try {
    const id = Number(getRouterParam(event, 'id'))
    if (!id || Number.isNaN(id)) {
      throw createError({ statusCode: 400, message: 'ID inválido.' })
    }

    const body = await readBody(event)

    // ✅ Validación con Valibot (NO busSchema)
    const result = safeParse(UsuarioUpdateSchema, body)
    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.issues[0].message,
      })
    }

    const data = result.output

    // =======================
    //  UPDATE DATA PARA PRISMA
    // =======================
    const updateData: any = {
      rut: data.rut,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      username: data.username,
      telefono: data.telefono ?? null,
      licencia_con: data.licencia ?? null,
    }

    // Si envías "estado"
    if (data.estado) {
      const estado = await prisma.estadoUsuario.findFirst({
        where: { nombre_estado: data.estado },
      })

      if (!estado) {
        throw createError({ statusCode: 400, message: 'Estado inválido.' })
      }

      updateData.id_estado_usuario = estado.id_estado_usuario
    }

    // =======================
    //  ACTUALIZAR USUARIO
    // =======================
    const usuario = await prisma.usuario.update({
      where: { id_usuario: id },
      data: updateData,
    })

    // =======================
    //  ACTUALIZAR ROLES
    // =======================
    if (data.roles) {
      await prisma.usuarioRol.deleteMany({
        where: { id_usuario: usuario.id_usuario },
      })

      if (data.roles.length) {
        const roles = await prisma.rol.findMany({
          where: { nombre_rol: { in: data.roles } },
        })

        await prisma.usuarioRol.createMany({
          data: roles.map((r) => ({
            id_usuario: usuario.id_usuario,
            id_rol: r.id_rol,
            estado: 'VIGENTE',
          })),
        })
      }
    }

    return { item: usuario }

  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({
        statusCode: 409,
        message: '⚠️ Ya existe un usuario con ese RUT, email o username.',
      })
    }

    if (err?.statusCode) throw err

    console.error('Error en PUT /api/usuarios/[id]:', err)
    throw createError({ statusCode: 500, message: 'Error al actualizar usuario.' })
  }
})
