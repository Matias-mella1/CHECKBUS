import { defineEventHandler, createError } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  try {
    const [tipos, estados, buses, usuariosConductor] = await Promise.all([
      // ==========================
      // TIPOS DE DOCUMENTO
      // ==========================
      prisma.tipoDocumento.findMany({
        orderBy: { nombre_tipo: 'asc' },
        select: { id_tipo_documento: true, nombre_tipo: true, categoria: true },
      }),

      // ==========================
      // ESTADOS
      // ==========================
      prisma.estadoDocumento.findMany({
        orderBy: { nombre_estado: 'asc' },
        select: { id_estado_documento: true, nombre_estado: true },
      }),

      // ==========================
      // BUSES
      // ==========================
      prisma.bus.findMany({
        orderBy: { id_bus: 'asc' },
        select: { id_bus: true, patente: true },
      }),

      // ==========================
      // USUARIOS CON ROL DE CONDUCTOR
      // ==========================
      prisma.usuario.findMany({
        where: {
          roles: {
            some: {
              rol: {
                nombre_rol: {
                  contains: 'Conductor',      // 👈 acepta "Conductor" o cualquier variante
                  mode: 'insensitive',        // 👈 sin distinguir mayúsculas/minúsculas
                },
              },
            },
          },
          // OPCIONAL: si quieres mostrar solo conductores activos, descomenta:
          /*
          estado_usuario: {
            nombre_estado: 'Activo',
          },
          */
        },
        orderBy: { id_usuario: 'asc' },
        select: {
          id_usuario: true,
          nombre: true,
          apellido: true,
          rut : true,
        },
      }),
    ])

    // ==========================
    // MAPEO PARA EL FRONTEND
    // ==========================

    const busesOpt = buses.map(b => ({
      id: b.id_bus,
      label: b.patente,
    }))

    const usuariosOpt = usuariosConductor.map(u => ({
      id: u.id_usuario,
      label: u.rut?? `${u.nombre} ${u.apellido}`,
    }))

    return {
      tipos,
      estados,
      buses: busesOpt,
      usuarios: usuariosOpt, // 👈 SOLO conductores reales
    }
  } catch (err: any) {
    console.error(err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error al obtener catálogos',
      data: err,
    })
  }
})
