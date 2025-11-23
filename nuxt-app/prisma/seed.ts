// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()
async function seedIfEmpty<T>(
  countFn: () => Promise<number>,
  createFn: () => Promise<T>,
  name: string
) {
  const count = await countFn()
  if (count === 0) {
    await createFn()
    console.log(` Seed de ${name} insertado.`)
  } else {
    console.log(`• ${name} ya tenía datos, no se insertó.`)
  }
}

async function main() {
  console.log('🌱 Iniciando seed...')

  // --- ESTADOS USUARIO ---
  await seedIfEmpty(
    () => prisma.estadoUsuario.count(),
    () =>
      prisma.estadoUsuario.createMany({
        data: [
          { nombre_estado: 'ACTIVO', descripcion: 'Usuario habilitado' },
          { nombre_estado: 'INACTIVO', descripcion: 'Usuario deshabilitado' },
          { nombre_estado: 'SUSPENDIDO', descripcion: 'Bloqueo temporal' },
          { nombre_estado: 'PENDIENTE', descripcion: 'A la espera de verificación' },
        ],
        skipDuplicates: true,
      }),
    'EstadoUsuario'
  )

  // --- ROLES ---
  await seedIfEmpty(
    () => prisma.rol.count(),
    () =>
      prisma.rol.createMany({
        data: [
          { nombre_rol: 'ADMINISTRADOR', descripcion : 'Usuario con acceso total al sistema'   },
          { nombre_rol: 'PROPIETARIO', descripcion: 'Dueño o encargado de flota' },
          { nombre_rol: 'CONDUCTOR' , descripcion: 'Persona responsable del bus y sus rutas'  },
          { nombre_rol: 'SUPERVISOR' , descripcion:  'Encargado de supervisar actividades y reportes'},
        ],
        skipDuplicates: true,
      }),
    'Rol'
  )

  // --- ESTADOS BUS ---
  await seedIfEmpty(
    () => prisma.estadoBus.count(),
    () =>
      prisma.estadoBus.createMany({
        data: [
          { nombre_estado: 'OPERATIVO', descripcion: 'Bus funcionando correctamente.' },
          { nombre_estado: 'MANTENIMIENTO', descripcion: 'Bus en reparación o revisión.' },
          { nombre_estado: 'FUERA DE SERVICIO', descripcion: 'Bus fuera de circulación.' },
        ],
        skipDuplicates: true,
      }),
    'EstadoBus'
  )

  // --- ESTADOS TURNO ---
  await seedIfEmpty(
    () => prisma.estadoTurno.count(),
    () =>
      prisma.estadoTurno.createMany({
        data: [
          { nombre_estado: 'PROGRAMADO', descripcion: 'Turno creado' },
          { nombre_estado: 'EN CURSO', descripcion: 'Turno activo' },
          { nombre_estado: 'COMPLETADO', descripcion: 'Turno finalizado' },
          { nombre_estado: 'CANCELADO', descripcion: 'No se ejecuta' },
        ],
        skipDuplicates: true,
      }),
    'EstadoTurno'
  )

  // --- TIPOS DE TALLER ---
  await seedIfEmpty(
    () => prisma.tipoTaller.count(),
    () =>
      prisma.tipoTaller.createMany({
        data: [
          {
            nombre_tipo: 'Taller General',
            descripcion:
              'Mantenimiento integral y reparaciones mecánicas en motores, transmisiones, frenos y sistemas auxiliares.',
            especialidad: 'Mecánica General',
          },
          {
            nombre_tipo: 'Electricidad y Electrónica',
            descripcion:
              'Diagnóstico y reparación del sistema eléctrico, alternadores, baterías y módulos electrónicos.',
            especialidad: 'Sistemas Eléctricos y Electrónicos',
          },
          {
            nombre_tipo: 'Neumáticos y Suspensión',
            descripcion:
              'Montaje, alineación, balanceo y mantenimiento de suspensión y amortiguadores.',
            especialidad: 'Neumáticos y Suspensión',
          },
          {
            nombre_tipo: 'Carrocería y Pintura',
            descripcion:
              'Reparación estructural, enderezado, pintura y restauración estética del bus.',
            especialidad: 'Carrocería y Pintura',
          },
          {
            nombre_tipo: 'Sistemas de Frenos',
            descripcion:
              'Mantenimiento y calibración de frenos neumáticos, hidráulicos y ABS.',
            especialidad: 'Frenos',
          },
          {
            nombre_tipo: 'Aire Acondicionado y Climatización',
            descripcion:
              'Revisión, recarga y reparación de sistemas de climatización, ventilación y calefacción.',
            especialidad: 'Climatización',
          },
          {
            nombre_tipo: 'Diagnóstico Computarizado',
            descripcion:
              'Uso de herramientas de diagnóstico electrónico para detectar fallas en sistemas de control.',
            especialidad: 'Diagnóstico Electrónico',
          },
        ],
        skipDuplicates: true,
      }),
    'TipoTaller'
  )

  // --- ESTADOS MANTENIMIENTO ---
  await seedIfEmpty(
    () => prisma.estadoMantenimiento.count(),
    () =>
      prisma.estadoMantenimiento.createMany({
        data: [
          { nombre_estado: 'PENDIENTE', descripcion: 'Solicitado' },
          { nombre_estado: 'EN PROCESO', descripcion: 'En ejecución' },
          { nombre_estado: 'COMPLETADO', descripcion: 'Finalizado' },
          { nombre_estado: 'ANULADO', descripcion: 'Cancelado' },
        ],
        skipDuplicates: true,
      }),
    'EstadoMantenimiento'
  )

  // --- TIPOS MANTENIMIENTO ---
  await seedIfEmpty(
    () => prisma.tipoMantenimiento.count(),
    () =>
      prisma.tipoMantenimiento.createMany({
        data: [
          { nombre_tipo: 'Preventivo', descripcion: 'Planificado', categoria: 'Plan' },
          { nombre_tipo: 'Correctivo', descripcion: 'Por falla', categoria: 'Incidente' },
        ],
        skipDuplicates: true,
      }),
    'TipoMantenimiento'
  )

  // --- ESTADOS REPUESTO ---
  await seedIfEmpty(
    () => prisma.estadoRepuesto.count(),
    () =>
      prisma.estadoRepuesto.createMany({
        data: [
          { nombre_estado: 'Original', descripcion: 'Repuesto original de fábrica' },
          { nombre_estado: 'Usado', descripcion: 'Repuesto usado o reacondicionado' },
          { nombre_estado: 'Alternativo', descripcion: 'Repuesto compatible' },
        ],
        skipDuplicates: true,
      }),
    'EstadoRepuesto'
  )

  // --- TIPOS REPUESTO ---
  await seedIfEmpty(
    () => prisma.tipoRepuesto.count(),
    () =>
      prisma.tipoRepuesto.createMany({
        data: [
          { nombre_tipo: 'Motor', descripcion: 'Partes internas y externas del motor.', categoria: 'Mecánico' },
          { nombre_tipo: 'Eléctrico', descripcion: 'Componentes del sistema eléctrico y electrónico.', categoria: 'Eléctrico' },
          { nombre_tipo: 'Frenos', descripcion: 'Piezas del sistema de seguridad de frenado.', categoria: 'Seguridad' },
          { nombre_tipo: 'Suspensión', descripcion: 'Elementos de amortiguación y chasis.', categoria: 'Chasis' },
          { nombre_tipo: 'Transmisión', descripcion: 'Componentes para la transferencia de potencia.', categoria: 'Mecánico' },
          { nombre_tipo: 'Dirección', descripcion: 'Piezas para la maniobrabilidad del vehículo.', categoria: 'Chasis' },
          { nombre_tipo: 'Carrocería', descripcion: 'Partes exteriores y estructurales.', categoria: 'Estructura' },
          { nombre_tipo: 'Encendido', descripcion: 'Piezas clave para iniciar la combustión.', categoria: 'Eléctrico' },
          { nombre_tipo: 'Refrigeración', descripcion: 'Elementos para el control de temperatura del motor.', categoria: 'Térmico' },
          { nombre_tipo: 'Filtración', descripcion: 'Filtros de aire, aceite y combustible.', categoria: 'Mantenimiento' },
        ],
        skipDuplicates: true,
      }),
    'TipoRepuesto'
  )

  // --- ESTADOS INCIDENTE ---
  await seedIfEmpty(
    () => prisma.estadoIncidente.count(),
    () =>
      prisma.estadoIncidente.createMany({
        data: [
          { nombre_estado: 'REPORTADO', descripcion: 'Levantado por usuario' },
          { nombre_estado: 'EN REVISIÓN', descripcion: 'Analizando' },
          { nombre_estado: 'RESUELTO', descripcion: 'Cerrado' },
          { nombre_estado: 'DESCARTADO', descripcion: 'No procede' },
        ],
        skipDuplicates: true,
      }),
    'EstadoIncidente'
  )

  // --- TIPOS INCIDENTE ---
  await seedIfEmpty(
    () => prisma.tipoIncidente.count(),
    () =>
      prisma.tipoIncidente.createMany({
        data: [
          { nombre_tipo: 'Accidente', descripcion: 'Colisión u otro', categoria: 'Seguridad' },
          { nombre_tipo: 'Avería', descripcion: 'Falla mecánica', categoria: 'Operación' },
          { nombre_tipo: 'Retraso', descripcion: 'Demora en servicio', categoria: 'Servicio' },
          { nombre_tipo: 'Queja', descripcion: 'Cliente/usuario', categoria: 'Atención' },
        ],
        skipDuplicates: true,
      }),
    'TipoIncidente'
  )

  // --- ESTADOS DOCUMENTO ---
  await seedIfEmpty(
    () => prisma.estadoDocumento.count(),
    () =>
      prisma.estadoDocumento.createMany({
        data: [
          { nombre_estado: 'VIGENTE', descripcion: 'Documento válido' },
          { nombre_estado: 'VENCIDO', descripcion: 'Caducado' },
          { nombre_estado: 'POR VENCER', descripcion: 'Próximo a caducar' },
          { nombre_estado: 'ANULADO', descripcion: 'No válido' },
        ],
        skipDuplicates: true,
      }),
    'EstadoDocumento'
  )

  // --- ESTADOS ALERTA ---
  await seedIfEmpty(
    () => prisma.estadoAlerta.count(),
    () =>
      prisma.estadoAlerta.createMany({
        data: [
          { nombre_estado: 'ACTIVA', descripcion: 'Pendiente de gestionar' },
          { nombre_estado: 'ATENDIDA', descripcion: 'Gestionada' },
          { nombre_estado: 'CERRADA', descripcion: 'Sin acciones pendientes' },
        ],
        skipDuplicates: true,
      }),
    'EstadoAlerta'
  )

  // --- TIPOS DE DOCUMENTO (simplificado) ---
  await seedIfEmpty(
    () => prisma.tipoDocumento.count(),
    () =>
      prisma.tipoDocumento.createMany({
        data: [
          // ===== VEHÍCULO =====
          { nombre_tipo: 'Tarjeta de circulación', categoria: 'Vehículo', descripcion: 'Identificación oficial del vehículo' },
          { nombre_tipo: 'Permiso de circulación', categoria: 'Vehículo', descripcion: 'Autorización anual de tránsito' },
          { nombre_tipo: 'Revisión técnica', categoria: 'Vehículo', descripcion: 'Verificación de normas de seguridad y emisiones' },
          { nombre_tipo: 'Póliza SOAP', categoria: 'Vehículo', descripcion: 'Seguro obligatorio de accidentes personales' },
          { nombre_tipo: 'Certificado de propiedad', categoria: 'Vehículo', descripcion: 'Acredita titularidad del vehículo' },

          // ===== CONDUCTOR =====
          { nombre_tipo: 'Licencia de conducir', categoria: 'Conductor', descripcion: 'Habilitación legal para conducir' },
          { nombre_tipo: 'Certificado médico', categoria: 'Conductor', descripcion: 'Acredita condiciones de salud' },
          { nombre_tipo: 'Contrato laboral', categoria: 'Conductor', descripcion: 'Vinculación laboral con la empresa' },
          { nombre_tipo: 'Capacitación', categoria: 'Conductor', descripcion: 'Certificación de cursos o entrenamientos' },

          // ===== MANTENIMIENTO =====
          { nombre_tipo: 'Orden de trabajo', categoria: 'Mantenimiento', descripcion: 'Solicitud de mantenimiento o reparación' },
          { nombre_tipo: 'Informe de mantenimiento', categoria: 'Mantenimiento', descripcion: 'Detalle de servicios realizados' },
          { nombre_tipo: 'Factura o boleta de reparación', categoria: 'Mantenimiento', descripcion: 'Comprobante del servicio' },
          { nombre_tipo: 'Checklist técnico', categoria: 'Mantenimiento', descripcion: 'Control de revisión o inspección' },

          // ===== REPUESTOS / PROVEEDORES =====
          { nombre_tipo: 'Factura de compra de repuesto', categoria: 'Repuesto', descripcion: 'Documento de adquisición de piezas' },
          { nombre_tipo: 'Guía de despacho', categoria: 'Repuesto', descripcion: 'Comprobante de entrega de proveedor' },
          { nombre_tipo: 'Garantía de repuesto', categoria: 'Repuesto', descripcion: 'Cobertura ante fallas o defectos' },

          // ===== INCIDENTES / SEGURIDAD =====
          { nombre_tipo: 'Parte de accidente', categoria: 'Incidente', descripcion: 'Reporte de siniestro o colisión' },
          { nombre_tipo: 'Informe de aseguradora', categoria: 'Incidente', descripcion: 'Evaluación y cobertura del seguro' },
          { nombre_tipo: 'Plan de acción correctiva', categoria: 'Incidente', descripcion: 'Medidas tomadas tras el evento' },

          // ===== OPERACIÓN / LOGÍSTICA =====
          { nombre_tipo: 'Hoja de ruta', categoria: 'Operación', descripcion: 'Plan de recorrido y entregas' },
          { nombre_tipo: 'Bitácora de viaje', categoria: 'Operación', descripcion: 'Registro de uso y actividades del vehículo' },
          { nombre_tipo: 'Vale de combustible', categoria: 'Operación', descripcion: 'Control de gasto en combustible' },

          // ===== ADMINISTRATIVO =====
          { nombre_tipo: 'Contrato con proveedor', categoria: 'Administrativo', descripcion: 'Acuerdo comercial o de servicio' },
          { nombre_tipo: 'Factura de servicio externo', categoria: 'Administrativo', descripcion: 'Pago a terceros o consultores' },
          { nombre_tipo: 'Informe de auditoría', categoria: 'Administrativo', descripcion: 'Resultado de revisión interna o externa' },
        ],
        skipDuplicates: true,
      }),
    'TipoDocumento'
  )

  // --- ADMIN POR DEFECTO ---
  const estadoActivo =
    (await prisma.estadoUsuario.findFirst({ where: { nombre_estado: 'ACTIVO' } })) ||
    (await prisma.estadoUsuario.findFirst({ where: { nombre_estado: 'Activo' } }))

  const rolAdmin =
    (await prisma.rol.findFirst({ where: { nombre_rol: 'ADMINISTRADOR' } })) ||
    (await prisma.rol.findFirst({ where: { nombre_rol: 'Administrador' } }))

  if (!estadoActivo) throw new Error('Falta ACTIVO en EstadoUsuario')
  if (!rolAdmin) throw new Error('Falta ADMINISTRADOR en Rol')

  const passwordHash = await bcrypt.hash('P455word2525', 10)

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      rut: '12345678-9', 
      nombre: 'usuario',
      apellido: 'uno',
      email: 'admin@gmail.com',
      telefono: '924283690',
      username: 'admin1',
      password_hash: passwordHash,
      fecha_registro: new Date(),
      
      estado_usuario: {
        connect: { id_estado_usuario: estadoActivo.id_estado_usuario },
      },
    },
  })

  await prisma.usuarioRol.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: admin.id_usuario,
        id_rol: rolAdmin.id_rol,
      },
    },
    update: { estado: 'ACTIVO', fecha_inicio: new Date() },
    create: {
      id_usuario: admin.id_usuario,
      id_rol: rolAdmin.id_rol,
      estado: 'ACTIVO',
      fecha_inicio: new Date(),
    },
  })

  console.log('✔ Seed OK: catálogos + tipos de documento + admin')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
