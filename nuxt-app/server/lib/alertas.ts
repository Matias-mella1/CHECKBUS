// lib/alertas.ts
import { addDays } from 'date-fns'
import { prisma } from '../utils/prisma'
import { sendAlertEmail } from '../utils/email'
import { estadoSegunFechaCaducidad } from '../utils/DocumentoRuler'

function ymd(d?: Date | string | null): string | null {
  if (!d) return null
  const dt = new Date(d)
  return Number.isNaN(+dt) ? null : dt.toISOString().slice(0, 10)
}

function dtLocal(d?: Date | string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return '—'
  return dt.toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function labelBus(b?: { patente?: string | null; id_bus: number } | null) {
  return b?.patente?.trim() ? b!.patente! : (b ? `#${b.id_bus}` : '—')
}

function userEmail(u: any): string | null {
  if (!u) return null
  const raw = (u.email ?? u.correo ?? u.mail ?? '')
    .toString()
    .trim()
  return raw.length ? raw : null
}

async function getEstadoAlertaId(nombre: string) {
  const e = await prisma.estadoAlerta.findFirst({
    where: { nombre_estado: { equals: nombre, mode: 'insensitive' } },
    select: { id_estado_alerta: true },
  })
  if (e) return e.id_estado_alerta

  const created = await prisma.estadoAlerta.create({
    data: { nombre_estado: nombre },
  })
  return created.id_estado_alerta
}

async function getTipoAlertaId(nombre: string, categoria?: string) {
  const t = await prisma.tipoAlerta.findFirst({
    where: { nombre_tipo: { equals: nombre, mode: 'insensitive' } },
    select: { id_tipo_alerta: true },
  })
  if (t) return t.id_tipo_alerta

  const created = await prisma.tipoAlerta.create({
    data: { nombre_tipo: nombre, categoria },
  })
  return created.id_tipo_alerta
}

async function getEstadoDocumentoId(
  nombre: 'VIGENTE' | 'POR VENCER' | 'VENCIDO'
): Promise<number> {
  const row = await prisma.estadoDocumento.findFirst({
    where: {
      nombre_estado: {
        equals: nombre,
        mode: 'insensitive',
      },
    },
    select: { id_estado_documento: true },
  })

  if (row) return row.id_estado_documento

  const created = await prisma.estadoDocumento.create({
    data: { nombre_estado: nombre },
  })
  return created.id_estado_documento
}

async function getRoleEmails(rolesRaw?: string | null): Promise<string[]> {
  const raw = (rolesRaw ?? '').trim()
  if (!raw) return []

  const roleNames = raw
    .split(',')
    .map(r => r.trim())
    .filter(Boolean)

  if (!roleNames.length) return []

  // Buscar IDs de roles por nombre
  const roles = await prisma.rol.findMany({
    where: {
      nombre_rol: {
        in: roleNames,
        mode: 'insensitive',
      },
    },
    select: { id_rol: true },
  })

  const roleIds = roles.map(r => r.id_rol)
  if (!roleIds.length) return []

  const users = await prisma.usuario.findMany({
    where: {
      roles: {
        some: {
          id_rol: { in: roleIds },
        
        },
      },
    },
    select: { email: true },
  })

  const unique = new Set<string>()
  for (const u of users) {
    const e = (u.email ?? '').toString().trim()
    if (e) unique.add(e)
  }

  return Array.from(unique)
}

const LOGO_URL =
  (process.env.ALERTS_LOGO_URL ?? '').trim() ||
  'https://mi-sistema-logo-publico.s3.us-east-2.amazonaws.com/logo-app.png'

const APP_NAME = (process.env.MAIL_NAME || 'CheckBus').trim()

function wrapEmailHtml(opts: { title: string; body: string; subtitle?: string }) {
  const subtitle = opts.subtitle || 'Notificación automática del sistema'

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#0b1120;border-radius:18px;padding:28px 24px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.7);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">

          <tr>
            <td align="center" style="padding-bottom:22px;border-bottom:1px solid #1f2937;">
              <img 
                src="${LOGO_URL}"
                alt="${APP_NAME}"
                style="max-width:160px;max-height:60px;margin-bottom:6px;display:block;"
              />
              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
                ${subtitle}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding-top:20px;padding-bottom:4px;">
              <h1 style="margin:0 0 10px 0;font-size:20px;font-weight:600;color:#f9fafb;">
                ${opts.title}
              </h1>
              ${opts.body}
            </td>
          </tr>

          <tr>
            <td style="padding-top:20px;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;color:#4b5563;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
              <p style="margin:0;font-size:11px;color:#4b5563;">
                © ${new Date().getFullYear()} ${APP_NAME} · Plataforma de gestión de transporte
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `
}

// Generar alerta diaria

export async function generarAlertas({ diasVentana = 30 }: { diasVentana?: number } = {}) {
  const ESTADO_ACTIVA = await getEstadoAlertaId('ACTIVA')

  // tipos de alerta
  const TIPO_DOC_CADUCA  = await getTipoAlertaId('documento_caduca',  'Documento')
  const TIPO_DOC_VENCIDO = await getTipoAlertaId('documento_vencido', 'Documento')
  const TIPO_EXTINTOR    = await getTipoAlertaId('extintor_caduca',   'Seguridad')
  const TIPO_REV_TEC     = await getTipoAlertaId('revision_tecnica_caduca', 'Vehiculo')
  const TIPO_INC_PEND    = await getTipoAlertaId('incidente_pendiente', 'Incidente')

  // estados de documento
  const EST_DOC_VIGENTE    = await getEstadoDocumentoId('VIGENTE')
  const EST_DOC_POR_VENCER = await getEstadoDocumentoId('POR VENCER')
  const EST_DOC_VENCIDO    = await getEstadoDocumentoId('VENCIDO')

  const hoy = new Date()
  const limite = addDays(hoy, diasVentana)
  const adminMail = (process.env.ALERTS_FALLBACK_TO ?? '').trim()

  const defaultRoles = process.env.ALERTS_DEFAULT_ROLES
  const docRoles  = process.env.ALERTS_DOC_ROLES  ?? defaultRoles
  const extRoles  = process.env.ALERTS_EXTINTOR_ROLES ?? defaultRoles
  const incRoles  = process.env.ALERTS_INCIDENTE_ROLES ?? defaultRoles
  const mantRoles = process.env.ALERTS_MANTENIMIENTO_ROLES ?? defaultRoles

  const docRoleEmails  = await getRoleEmails(docRoles)
  const extRoleEmails  = await getRoleEmails(extRoles)
  const revRoleEmails  = await getRoleEmails(extRoles) 
  const incRoleEmails  = await getRoleEmails(incRoles)
  const mantRoleEmails = await getRoleEmails(mantRoles) 


  // Documento por vencer 

  const docsPorCaducar = await prisma.documento.findMany({
    where: {
      fecha_caducidad: {
        gte: hoy,
        lte: limite,
      },
    },
    include: {
      tipo: true,
      bus: { select: { id_bus: true, patente: true } },
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
    },
  })

  for (const d of docsPorCaducar) {
    const vence = ymd(d.fecha_caducidad) ?? ymd(hoy)!
    const dedup_key = `doc_caduca|doc:${d.id_documento}|${vence}`

 
    const estadoCalc = estadoSegunFechaCaducidad(d.fecha_caducidad ?? undefined)
    let nuevoEstadoId: number | null = d.id_estado_documento ?? null

    if (estadoCalc === 'POR VENCER') {
      nuevoEstadoId = EST_DOC_POR_VENCER
    } else if (estadoCalc === 'VIGENTE') {
      nuevoEstadoId = EST_DOC_VIGENTE
    }

    if (nuevoEstadoId && nuevoEstadoId !== d.id_estado_documento) {
      await prisma.documento.update({
        where: { id_documento: d.id_documento },
        data: { id_estado_documento: nuevoEstadoId },
      })
    }

    try {
      const alerta = await prisma.alerta.create({
        data: {
          dedup_key,
          titulo: `Documento por caducar: ${d.nombre_archivo}`,
          descripcion: [
            d.tipo?.nombre_tipo && `Tipo: ${d.tipo.nombre_tipo}`,
            d.bus && `Bus: ${labelBus(d.bus)}`,
            d.usuario && `Usuario: ${d.usuario.nombre ?? d.usuario.id_usuario}`,
            `Vence: ${vence}`,
          ].filter(Boolean).join(' · '),
          prioridad: 'media',
          id_estado_alerta: ESTADO_ACTIVA,
          id_tipo_alerta: TIPO_DOC_CADUCA,
          id_documento: d.id_documento,
          id_bus: d.id_bus ?? null,
          id_usuario: d.id_usuario ?? null,
        },
      })

      const destinosSet = new Set<string>()
      const uMail = userEmail(d.usuario)
      if (uMail) destinosSet.add(uMail)
      docRoleEmails.forEach(e => destinosSet.add(e))
      if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

      const destinos = Array.from(destinosSet)
      if (!destinos.length) continue

      const title = 'Documento próximo a caducar'
      const body = `
        <p>Se ha detectado un documento próximo a caducar:</p>
        <ul style="padding-left:18px;">
          <li><b>Documento:</b> ${d.nombre_archivo}</li>
          ${d.tipo ? `<li><b>Tipo:</b> ${d.tipo.nombre_tipo}</li>` : ''}
          ${d.bus ? `<li><b>Bus:</b> ${labelBus(d.bus)}</li>` : ''}
          <li><b>Fecha de vencimiento:</b> ${vence}</li>
        </ul>
        <p style="margin-top:12px;">Te recomendamos actualizar o renovar este documento antes de su vencimiento.</p>
        <p style="margin-top:8px;font-size:12px;color:#6b7280;">
          <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
        </p>
      `

      await sendAlertEmail({
        to: destinos,
        subject: `⚠️ Documento por vencer: ${d.nombre_archivo}`,
        title,
        message: wrapEmailHtml({ title, body }),
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }


  // Docuemntos ya vencidos

  const docsVencidos = await prisma.documento.findMany({
    where: {
      fecha_caducidad: { lt: hoy },
      NOT: { id_estado_documento: EST_DOC_VENCIDO },
    },
    include: {
      tipo: true,
      bus: { select: { id_bus: true, patente: true } },
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
    },
  })

  for (const d of docsVencidos) {
    const vencio = ymd(d.fecha_caducidad) ?? ymd(hoy)!
    const dedup_key = `doc_vencido|doc:${d.id_documento}|${vencio}`

    // Marcar siempre VENCIDO
    await prisma.documento.update({
      where: { id_documento: d.id_documento },
      data: { id_estado_documento: EST_DOC_VENCIDO },
    })

    try {
      const alerta = await prisma.alerta.create({
        data: {
          dedup_key,
          titulo: `Documento VENCIDO: ${d.nombre_archivo}`,
          descripcion: [
            d.tipo?.nombre_tipo && `Tipo: ${d.tipo.nombre_tipo}`,
            d.bus && `Bus: ${labelBus(d.bus)}`,
            d.usuario && `Usuario: ${d.usuario.nombre ?? d.usuario.id_usuario}`,
            `Venció: ${vencio}`,
          ].filter(Boolean).join(' · '),
          prioridad: 'alta',
          id_estado_alerta: ESTADO_ACTIVA,
          id_tipo_alerta: TIPO_DOC_VENCIDO,
          id_documento: d.id_documento,
          id_bus: d.id_bus ?? null,
          id_usuario: d.id_usuario ?? null,
        },
      })

      const destinosSet = new Set<string>()
      const uMail = userEmail(d.usuario)
      if (uMail) destinosSet.add(uMail)
      docRoleEmails.forEach(e => destinosSet.add(e))
      if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

      const destinos = Array.from(destinosSet)
      if (!destinos.length) continue

      const title = 'Documento vencido'
      const body = `
        <p>Se ha detectado un documento que ya se encuentra <b>VENCIDO</b>:</p>
        <ul style="padding-left:18px;">
          <li><b>Documento:</b> ${d.nombre_archivo}</li>
          ${d.tipo ? `<li><b>Tipo:</b> ${d.tipo.nombre_tipo}</li>` : ''}
          ${d.bus ? `<li><b>Bus:</b> ${labelBus(d.bus)}</li>` : ''}
          <li><b>Fecha de vencimiento:</b> ${vencio}</li>
        </ul>
        <p style="margin-top:12px;">Por favor regulariza este documento o retira el vehículo de circulación si corresponde.</p>
        <p style="margin-top:8px;font-size:12px;color:#6b7280;">
          <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
        </p>
      `

      await sendAlertEmail({
        to: destinos,
        subject: `⛔ Documento vencido: ${d.nombre_archivo}`,
        title,
        message: wrapEmailHtml({ title, body }),
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }

  // Extintor Por vencer

  const busesExtintor = await prisma.bus.findMany({
    where: { fecha_extintor: { gte: hoy, lte: limite } },
    select: { id_bus: true, patente: true, fecha_extintor: true },
  })

  for (const b of busesExtintor) {
    const vence = ymd(b.fecha_extintor) ?? ymd(hoy)!
    const dedup_key = `extintor|bus:${b.id_bus}|${vence}`

    try {
      const alerta = await prisma.alerta.create({
        data: {
          dedup_key,
          titulo: `Extintor por vencer — Bus ${labelBus(b)}`,
          descripcion: `Bus: ${labelBus(b)} · Vence: ${vence}`,
          prioridad: 'alta',
          id_estado_alerta: ESTADO_ACTIVA,
          id_tipo_alerta: TIPO_EXTINTOR,
          id_bus: b.id_bus,
        },
      })

      const destinosSet = new Set<string>()
      extRoleEmails.forEach(e => destinosSet.add(e))
      if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

      const destinos = Array.from(destinosSet)
      if (!destinos.length) continue

      const title = 'Extintor próximo a caducar'
      const body = `
        <p>Se ha detectado un extintor próximo a vencer:</p>
        <ul style="padding-left:18px;">
          <li><b>Bus:</b> ${labelBus(b)}</li>
          <li><b>Vencimiento:</b> ${vence}</li>
        </ul>
        <p style="margin-top:12px;">Por favor coordina su recarga o reemplazo oportunamente.</p>
        <p style="margin-top:8px;font-size:12px;color:#6b7280;">
          <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
        </p>
      `

      await sendAlertEmail({
        to: destinos,
        subject: `🔥 Extintor por vencer — Bus ${labelBus(b)}`,
        title,
        message: wrapEmailHtml({ title, body }),
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }


  // Revision Tecnica

  const busesRev = await prisma.bus.findMany({
    where: { fecha_revision_tecnica: { gte: hoy, lte: limite } },
    select: { id_bus: true, patente: true, fecha_revision_tecnica: true },
  })

  for (const b of busesRev) {
    const vence = ymd(b.fecha_revision_tecnica) ?? ymd(hoy)!
    const dedup_key = `rev_tecnica|bus:${b.id_bus}|${vence}`

    try {
      const alerta = await prisma.alerta.create({
        data: {
          dedup_key,
          titulo: `Revisión técnica por vencer — Bus ${labelBus(b)}`,
          descripcion: `Bus: ${labelBus(b)} · Vence: ${vence}`,
          prioridad: 'media',
          id_estado_alerta: ESTADO_ACTIVA,
          id_tipo_alerta: TIPO_REV_TEC,
          id_bus: b.id_bus,
        },
      })

      const destinosSet = new Set<string>()
      revRoleEmails.forEach(e => destinosSet.add(e))
      if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

      const destinos = Array.from(destinosSet)
      if (!destinos.length) continue

      const title = 'Revisión técnica próxima a caducar'
      const body = `
        <p>Una revisión técnica está próxima a caducar:</p>
        <ul style="padding-left:18px;">
          <li><b>Bus:</b> ${labelBus(b)}</li>
          <li><b>Fecha de vencimiento:</b> ${vence}</li>
        </ul>
        <p style="margin-top:12px;">Te recomendamos agendar esta revisión lo antes posible.</p>
        <p style="margin-top:8px;font-size:12px;color:#6b7280;">
          <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
        </p>
      `

      await sendAlertEmail({
        to: destinos,
        subject: `🔧 Revisión técnica por vencer — Bus ${labelBus(b)}`,
        title,
        message: wrapEmailHtml({ title, body }),
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }


  // Incidentes aviertos  > 7 DÍAS

  const hace7 = addDays(hoy, -7)

  const incs = await prisma.incidente.findMany({
    where: {
      fecha: { lte: hace7 },
      estado: {
        nombre_estado: {
          in: ['REPORTADO', 'EN REVISIÓN'],
          mode: 'insensitive',
        },
      },
    },
    include: {
      bus: { select: { id_bus: true, patente: true } },
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
    },
  })

  for (const i of incs) {
    const hoyStr = ymd(hoy)!
    const dedup_key = `inc_pend|inc:${i.id_incidente}|${hoyStr}`

    try {
      const alerta = await prisma.alerta.create({
        data: {
          dedup_key,
          titulo: `Incidente sin cierre #${i.id_incidente}`,
          descripcion: [
            i.fecha && `Desde: ${ymd(i.fecha)}`,
            i.bus && `Bus: ${labelBus(i.bus)}`,
            i.usuario && `Usuario: ${i.usuario.nombre ?? i.usuario.id_usuario}`,
          ].filter(Boolean).join(' · '),
          prioridad: 'media',
          id_estado_alerta: ESTADO_ACTIVA,
          id_tipo_alerta: TIPO_INC_PEND,
          id_incidente: i.id_incidente,
          id_bus: i.id_bus ?? null,
          id_usuario: i.id_usuario ?? null,
        },
      })

      const destinosSet = new Set<string>()
      incRoleEmails.forEach(e => destinosSet.add(e))
      if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

      const destinos = Array.from(destinosSet)
      if (!destinos.length) continue

      const title = 'Incidente pendiente de cierre'
      const body = `
        <p>Hay un incidente abierto por más de 7 días:</p>
        <ul style="padding-left:18px;">
          <li><b>ID Incidente:</b> #${i.id_incidente}</li>
          <li><b>Fecha:</b> ${ymd(i.fecha)}</li>
          ${i.bus ? `<li><b>Bus:</b> ${labelBus(i.bus)}</li>` : ''}
          ${i.usuario ? `<li><b>Reportado por:</b> ${i.usuario.nombre}</li>` : ''}
        </ul>
        <p style="margin-top:12px;">Se recomienda revisar y actualizar su estado en el sistema.</p>
        <p style="margin-top:8px;font-size:12px;color:#6b7280;">
          <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
        </p>
      `

      await sendAlertEmail({
        to: destinos,
        subject: `🚨 Incidente sin cierre #${i.id_incidente}`,
        title,
        message: wrapEmailHtml({ title, body }),
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
    }
  }
}

// Alerta inmediata-incidente nuevo 

export async function generarAlertaIncidenteInmediata(id_incidente: number) {
  const ESTADO_ACTIVA = await getEstadoAlertaId('ACTIVA')
  const TIPO_INC_NUEVO = await getTipoAlertaId('incidente_nuevo', 'Incidente')

  const adminMail = (process.env.ALERTS_FALLBACK_TO ?? '').trim()
  const roles = process.env.ALERTS_INCIDENTE_ROLES ?? process.env.ALERTS_DEFAULT_ROLES
  const roleEmails = await getRoleEmails(roles)

  const inc = await prisma.incidente.findUnique({
    where: { id_incidente },
    include: {
      bus: { select: { id_bus: true, patente: true } },
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
      estado: true,
      tipo: true,
    },
  })
  if (!inc) return

  const clave = `inc_nuevo|${inc.id_incidente}`

  try {
    const alerta = await prisma.alerta.create({
      data: {
        dedup_key: clave,
        titulo: `Incidente registrado #${inc.id_incidente}`,
        descripcion: [
          `Tipo: ${inc.tipo?.nombre_tipo || 'Incidente'}`,
          inc.bus && `Bus: ${labelBus(inc.bus)}`,
          inc.usuario && `Usuario: ${inc.usuario.nombre}`,
          inc.fecha && `Fecha: ${ymd(inc.fecha)}`,
          inc.urgencia && `Urgencia: ${inc.urgencia}`,
          inc.ubicacion && `Ubicación: ${inc.ubicacion}`,
        ].filter(Boolean).join(' · '),
        prioridad: 'alta',
        id_estado_alerta: ESTADO_ACTIVA,
        id_tipo_alerta: TIPO_INC_NUEVO,
        id_incidente: inc.id_incidente,
        id_bus: inc.id_bus ?? null,
        id_usuario: inc.id_usuario ?? null,
      },
    })

    const destinosSet = new Set<string>()
    const uMail = userEmail(inc.usuario)
    if (uMail) destinosSet.add(uMail)
    roleEmails.forEach(e => destinosSet.add(e))
    if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

    const destinos = Array.from(destinosSet)
    if (!destinos.length) return

    const title = 'Nuevo incidente registrado'
    const body = `
      <p>Se ha registrado un nuevo incidente:</p>
      <ul style="padding-left:18px;">
        <li><b>ID Incidente:</b> #${inc.id_incidente}</li>
        <li><b>Tipo:</b> ${inc.tipo?.nombre_tipo}</li>
        <li><b>Estado:</b> ${inc.estado?.nombre_estado}</li>
        <li><b>Bus:</b> ${labelBus(inc.bus)}</li>
        <li><b>Fecha:</b> ${ymd(inc.fecha)}</li>
        ${inc.urgencia ? `<li><b>Urgencia:</b> ${inc.urgencia}</li>` : ''}
        ${inc.ubicacion ? `<li><b>Ubicación:</b> ${inc.ubicacion}</li>` : ''}
      </ul>
      ${inc.descripcion ? `<p><b>Descripción:</b><br/>${inc.descripcion}</p>` : ''}
      <p style="margin-top:8px;font-size:12px;color:#6b7280;">
        <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
      </p>
    `

    await sendAlertEmail({
      to: destinos,
      subject: `🚨 Nuevo incidente #${inc.id_incidente}`,
      title,
      message: wrapEmailHtml({ title, body }),
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return
    console.error('Error generando alerta de incidente nuevo', e)
    throw e
  }
}


//Alerta inmediata -mantenimiento nuevo

export async function generarAlertaMantenimientoInmediata(id_mantenimiento: number) {
  const ESTADO_ACTIVA = await getEstadoAlertaId('ACTIVA')
  const TIPO_MANT_NUEVO = await getTipoAlertaId('mantenimiento_nuevo', 'Mantenimiento')

  const adminMail = (process.env.ALERTS_FALLBACK_TO ?? '').trim()
  const roles = process.env.ALERTS_MANTENIMIENTO_ROLES ?? process.env.ALERTS_DEFAULT_ROLES
  const roleEmails = await getRoleEmails(roles)

  const mant = await prisma.mantenimiento.findUnique({
    where: { id_mantenimiento },
    include: {
      bus: { select: { id_bus: true, patente: true } },
      tipo: true,
      taller: true,
    },
  })
  if (!mant) return

  const clave = `mant_nuevo|${mant.id_mantenimiento}`

  try {
    const alerta = await prisma.alerta.create({
      data: {
        dedup_key: clave,
        titulo: `Mantenimiento registrado #${mant.id_mantenimiento}`,
        descripcion: [
          mant.tipo?.nombre_tipo && `Tipo: ${mant.tipo.nombre_tipo}`,
          mant.bus && `Bus: ${labelBus(mant.bus)}`,
          mant.taller && `Taller: ${mant.taller.nombre}`,
          mant.fecha && `Fecha: ${ymd(mant.fecha)}`,
          mant.costo_mano_obra && `Costo mano de obra: $${mant.costo_mano_obra.toString()}`,
          mant.costo_repuestos && `Costo repuestos: $${mant.costo_repuestos.toString()}`,
          mant.costo_total && `Costo total: $${mant.costo_total.toString()}`,
        ].filter(Boolean).join(' · '),
        prioridad: 'media',
        id_estado_alerta: ESTADO_ACTIVA,
        id_tipo_alerta: TIPO_MANT_NUEVO,
        id_mantenimiento: mant.id_mantenimiento,
        id_bus: mant.id_bus,
      },
    })

    const destinosSet = new Set<string>()
    roleEmails.forEach(e => destinosSet.add(e))
    if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

    const destinos = Array.from(destinosSet)
    if (!destinos.length) return

    const title = 'Nuevo mantenimiento registrado'
    const body = `
      <p>Hola,</p>
      <p>Se ha registrado un nuevo mantenimiento en el sistema:</p>
      <ul style="padding-left:18px;">
        <li><b>ID Mantenimiento:</b> #${mant.id_mantenimiento}</li>
        <li><b>Bus:</b> ${labelBus(mant.bus)}</li>
        <li><b>Tipo:</b> ${mant.tipo?.nombre_tipo ?? '—'}</li>
        <li><b>Taller:</b> ${mant.taller?.nombre ?? '—'}</li>
        <li><b>Fecha:</b> ${ymd(mant.fecha) ?? '—'}</li>
        ${mant.costo_mano_obra ? `<li><b>Costo mano de obra:</b> $${mant.costo_mano_obra}</li>` : ''}
        ${mant.costo_repuestos ? `<li><b>Costo repuestos:</b> $${mant.costo_repuestos}</li>` : ''}
        ${mant.costo_total ? `<li><b>Costo total:</b> $${mant.costo_total}</li>` : ''}
      </ul>
      ${mant.observaciones ? `<p><b>Observaciones:</b><br/>${mant.observaciones}</p>` : ''}
      <p style="margin-top:8px;font-size:12px;color:#6b7280;">
        <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
      </p>
    `

    await sendAlertEmail({
      to: destinos,
      subject: `🛠 Nuevo mantenimiento — Bus ${labelBus(mant.bus)}`,
      title,
      message: wrapEmailHtml({ title, body }),
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return
    console.error('Error generando alerta de mantenimiento nuevo', e)
    throw e
  }
}


// Alerta generada-mantenimiento finalizado


export async function generarAlertaMantenimientoFinalizado(id_mantenimiento: number) {
  const ESTADO_ACTIVA = await getEstadoAlertaId('ACTIVA')
  const TIPO_MANT_FIN = await getTipoAlertaId('mantenimiento_finalizado', 'Mantenimiento')

  const adminMail = (process.env.ALERTS_FALLBACK_TO ?? '').trim()
  const roles = process.env.ALERTS_MANTENIMIENTO_ROLES ?? process.env.ALERTS_DEFAULT_ROLES
  const roleEmails = await getRoleEmails(roles)

  const mant = await prisma.mantenimiento.findUnique({
    where: { id_mantenimiento },
    include: {
      bus: { select: { id_bus: true, patente: true } },
      tipo: true,
      taller: true,
    },
  })
  if (!mant) return

  const clave = `mant_finalizado|${mant.id_mantenimiento}`

  try {
    const alerta = await prisma.alerta.create({
      data: {
        dedup_key: clave,
        titulo: `Mantención finalizada #${mant.id_mantenimiento}`,
        descripcion: [
          mant.bus && `Bus: ${labelBus(mant.bus)}`,
          mant.tipo && `Tipo: ${mant.tipo.nombre_tipo}`,
          mant.taller && `Taller: ${mant.taller.nombre}`,
          mant.fecha && `Fecha: ${ymd(mant.fecha)}`,
          mant.costo_mano_obra && `Costo mano de obra: $${mant.costo_mano_obra.toString()}`,
          mant.costo_repuestos && `Costo repuestos: $${mant.costo_repuestos.toString()}`,
          mant.costo_total && `Costo total: $${mant.costo_total.toString()}`,
        ].filter(Boolean).join(' · '),
        prioridad: 'media',
        id_estado_alerta: ESTADO_ACTIVA,
        id_tipo_alerta: TIPO_MANT_FIN,
        id_mantenimiento: mant.id_mantenimiento,
        id_bus: mant.id_bus,
      },
    })

    const destinosSet = new Set<string>()
    roleEmails.forEach(e => destinosSet.add(e))
    if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

    const destinos = Array.from(destinosSet)
    if (!destinos.length) return

    const title = 'Mantención finalizada'
    const body = `
      <p>Hola,</p>
      <p>Una mantención ha sido marcada como <b>COMPLETADA</b> en el sistema:</p>
      <ul style="padding-left:18px;">
        <li><b>Bus:</b> ${labelBus(mant.bus)}</li>
        <li><b>Tipo:</b> ${mant.tipo?.nombre_tipo ?? '—'}</li>
        <li><b>Taller:</b> ${mant.taller?.nombre ?? '—'}</li>
        <li><b>Fecha:</b> ${ymd(mant.fecha) ?? '—'}</li>
        ${mant.costo_mano_obra ? `<li><b>Costo mano de obra:</b> $${mant.costo_mano_obra}</li>` : ''}
        ${mant.costo_repuestos ? `<li><b>Costo repuestos:</b> $${mant.costo_repuestos}</li>` : ''}
        ${mant.costo_total ? `<li><b>Costo total:</b> $${mant.costo_total}</li>` : ''}
      </ul>
      <p style="margin-top:8px;font-size:12px;color:#6b7280;">
        <b>ID Mantenimiento:</b> #${mant.id_mantenimiento}<br/>
        <b>ID Alerta:</b> <code>${alerta.id_alerta}</code>
      </p>
    `

    await sendAlertEmail({
      to: destinos,
      subject: `✅ Mantención finalizada — Bus ${labelBus(mant.bus)}`,
      title,
      message: wrapEmailHtml({ title, body }),
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return
    console.error('Error generando alerta de mantención finalizada', e)
    throw e
  }
}


// Alerta inmediata -turno nuevo


export async function generarAlertaTurnoInmediata(id_turno: number) {
  const ESTADO_ACTIVA  = await getEstadoAlertaId('ACTIVA')
  const TIPO_TURNO_NVO = await getTipoAlertaId('turno_asignado', 'Turno')
  const adminMail      = (process.env.ALERTS_FALLBACK_TO ?? '').trim()

  const turno = await prisma.turnoConductor.findUnique({
    where: { id_turno },
    include: {
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
      bus:     { select: { id_bus: true, patente: true } },
      estado:  { select: { nombre_estado: true } },
    },
  })

  if (!turno) return

  const clave = `turno_asignado|turno:${turno.id_turno}`

  try {
    await prisma.alerta.create({
      data: {
        dedup_key: clave,
        titulo: `Turno asignado #${turno.id_turno}`,
        descripcion: [
          turno.usuario && `Conductor: ${turno.usuario.nombre ?? turno.usuario.id_usuario}`,
          turno.bus && `Bus: ${labelBus(turno.bus)}`,
          turno.hora_inicio && `Inicio: ${dtLocal(turno.hora_inicio)}`,
          turno.hora_fin && `Fin: ${dtLocal(turno.hora_fin)}`,
          turno.ruta_origen && `Ruta origen: ${turno.ruta_origen}`,
          turno.ruta_fin && `Ruta destino: ${turno.ruta_fin}`,
          turno.estado?.nombre_estado && `Estado: ${turno.estado.nombre_estado}`,
        ].filter(Boolean).join(' · '),
        prioridad: 'media',
        id_estado_alerta: ESTADO_ACTIVA,
        id_tipo_alerta: TIPO_TURNO_NVO,
        id_bus: turno.id_bus,
        id_usuario: turno.id_usuario,
      },
    })

    const destinosSet = new Set<string>()
    const uMail = userEmail(turno.usuario)
    if (uMail) destinosSet.add(uMail)
    if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

    const destinos = Array.from(destinosSet)
    if (!destinos.length) return

    const title = 'Nuevo turno asignado'
    const body = `
      <p>Hola ${turno.usuario?.nombre ?? ''},</p>
      <p>Se te ha asignado un nuevo turno. Estos son los detalles:</p>
      <ul style="padding-left:18px;">
        <li><b>Bus:</b> ${labelBus(turno.bus)}</li>
        <li><b>Inicio:</b> ${dtLocal(turno.hora_inicio)}</li>
        <li><b>Fin:</b> ${dtLocal(turno.hora_fin)}</li>
        ${
          turno.ruta_origen || turno.ruta_fin
            ? `<li><b>Ruta:</b> ${turno.ruta_origen || '—'} → ${turno.ruta_fin || '—'}</li>`
            : ''
        }
        ${turno.estado?.nombre_estado ? `<li><b>Estado:</b> ${turno.estado.nombre_estado}</li>` : ''}
      </ul>
      <p style="margin-top:12px;">
        Te recomendamos revisar tu planificación en el sistema antes de iniciar el turno.
      </p>
    `

    await sendAlertEmail({
      to: destinos,
      subject: '🚌 Nuevo turno asignado',
      title,
      message: wrapEmailHtml({ title, body }),
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return
    console.error('Error generando alerta de turno asignado', e)
    throw e
  }
}


// Alerta inmediata -turno cancelado



export async function generarAlertaTurnoCancelado(id_turno: number) {
  const ESTADO_ACTIVA = await getEstadoAlertaId('ACTIVA')
  const TIPO_TURNO_CANCEL = await getTipoAlertaId('turno_cancelado', 'Turno')
  const adminMail = (process.env.ALERTS_FALLBACK_TO ?? '').trim()

  const turno = await prisma.turnoConductor.findUnique({
    where: { id_turno },
    include: {
      usuario: { select: { id_usuario: true, nombre: true, email: true } },
      bus: { select: { id_bus: true, patente: true } },
      estado: { select: { nombre_estado: true } },
    },
  })

  if (!turno) return

  const clave = `turno_cancelado|turno:${turno.id_turno}`

  try {
    await prisma.alerta.create({
      data: {
        dedup_key: clave,
        titulo: `Turno cancelado #${turno.id_turno}`,
        descripcion: [
          turno.usuario && `Conductor: ${turno.usuario.nombre ?? turno.usuario.id_usuario}`,
          turno.bus && `Bus: ${labelBus(turno.bus)}`,
          turno.hora_inicio && `Inicio original: ${dtLocal(turno.hora_inicio)}`,
          turno.hora_fin && `Fin original: ${dtLocal(turno.hora_fin)}`,
          turno.estado?.nombre_estado && `Estado actual: ${turno.estado.nombre_estado}`,
        ].filter(Boolean).join(' · '),
        prioridad: 'media',
        id_estado_alerta: ESTADO_ACTIVA,
        id_tipo_alerta: TIPO_TURNO_CANCEL,
        id_bus: turno.id_bus,
        id_usuario: turno.id_usuario,
      },
    })

    const destinosSet = new Set<string>()
    const uMail = userEmail(turno.usuario)
    if (uMail) destinosSet.add(uMail)
    if (!destinosSet.size && adminMail) destinosSet.add(adminMail)

    const destinos = Array.from(destinosSet)
    if (!destinos.length) return

    const title = 'Turno cancelado'
    const body = `
      <p>Hola ${turno.usuario?.nombre ?? ''},</p>
      <p>Uno de tus turnos ha sido cancelado. Detalles del turno:</p>
      <ul style="padding-left:18px;">
        <li><b>Bus:</b> ${labelBus(turno.bus)}</li>
        <li><b>Inicio original:</b> ${dtLocal(turno.hora_inicio)}</li>
        <li><b>Fin original:</b> ${dtLocal(turno.hora_fin)}</li>
        ${turno.estado?.nombre_estado ? `<li><b>Estado actual:</b> ${turno.estado.nombre_estado}</li>` : ''}
      </ul>
      <p style="margin-top:12px;">
        Si tienes dudas sobre esta cancelación, por favor contacta a tu coordinador.
      </p>
    `

    await sendAlertEmail({
      to: destinos,
      subject: '⚠️ Turno cancelado',
      title,
      message: wrapEmailHtml({ title, body }),
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return
    console.error('Error generando alerta de turno cancelado', e)
    throw e
  }
}
