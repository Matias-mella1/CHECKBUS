// server/api/reportes/flota.get.ts
import { defineEventHandler, sendStream } from 'h3'
import { prisma } from '../../utils/prisma'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import { join } from 'path'

type TopIncidenteBus = { id_bus: number; patente: string; cantidad: number }

// ================== Helpers de formato ==================
const fmtDate = (v: Date | string | null) => {
  if (!v) return '—'
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

const fmtDateTimeNow = () => {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year} ${hours}:${minutes}`
}

// Paleta sencilla
const colors = {
  primary: '#2563eb',
  primaryLight: '#e5edff',
  danger: '#b91c1c',
  dark: '#111827',
  medium: '#6b7280',
  light: '#f9fafb',
  border: '#e5e7eb',
}

// ================== Helpers de dibujo ==================

// Asegura que haya espacio suficiente en la página actual.
// Si no, crea una nueva página.
// Evita agregar página si recién estamos al inicio (para no crear páginas en blanco).
function ensureSpace(doc: PDFKit.PDFDocument, extra: number = 60) {
  const bottom = doc.page.height - doc.page.margins.bottom
  const top = doc.page.margins.top

  // si estamos casi arriba, no tiene sentido agregar otra página
  if (doc.y <= top + 5) return

  if (doc.y + extra > bottom) {
    doc.addPage()
    doc.fillColor(colors.dark)
  }
}

// Título de sección con línea azul
function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 40)

  doc.moveDown(0.8)
  const x = doc.page.margins.left

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(colors.dark)
    .text(title, x)

  const y = doc.y + 2
  doc
    .moveTo(x, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(1)
    .strokeColor(colors.primary)
    .stroke()

  doc.moveDown(0.6)
  doc.fillColor(colors.dark)
}

// Panel de resumen (caja suave con borde)
function addSummaryPanel(
  doc: PDFKit.PDFDocument,
  rows: Array<{ label: string; value: string | number; highlight?: boolean }>,
) {
  const x = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const lineHeight = 18
  const padding = 10
  const height = padding * 2 + rows.length * lineHeight

  ensureSpace(doc, height + 20)
  const y = doc.y

  // Fondo
  doc
    .roundedRect(x, y, width, height, 8)
    .fillAndStroke(colors.light, colors.border)

  let currentY = y + padding

  rows.forEach((row) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.medium)
      .text(`${row.label}:`, x + padding, currentY, { continued: true })

    doc
      .font('Helvetica-Bold')
      .fillColor(row.highlight ? colors.danger : colors.dark)
      .text(` ${row.value}`)

    currentY += lineHeight
  })

  doc.y = y + height + 10
}

// Bullet simple SIN caracteres raros
function addBullet(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 20)
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(colors.dark)
    .text(`- ${text}`, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    })
}

// ================== Handler ==================
export default defineEventHandler(async (event) => {
  try {
    const hoy = new Date()
    const hace30 = new Date()
    hace30.setDate(hoy.getDate() - 30)

    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const dentro30 = new Date()
    dentro30.setDate(hoy.getDate() + 30)

    const [
      totalBuses,
      busesPorEstado,
      kmStats,
      mantPorEstado,
      incidentesRecientes,
      alertasActivas,
      docsPorVencer,
      mantUltimoMes,
      incidentesUltimos30,
      rawTopIncidentesPorBus,
      busesRevisionVencida,
      busesExtintorVigente,
    ] = await Promise.all([
      // 1) Total de buses
      prisma.bus.count(),

      // 2) Buses por estado
      prisma.bus
        .groupBy({
          by: ['id_estado_bus'],
          _count: { id_bus: true },
        })
        .then(async (rows) => {
          if (!rows.length) return []
          const estados = await prisma.estadoBus.findMany({
            where: { id_estado_bus: { in: rows.map((r) => r.id_estado_bus) } },
          })
          const map = new Map(estados.map((e) => [e.id_estado_bus, e.nombre_estado]))
          return rows.map((r) => ({
            estado: map.get(r.id_estado_bus) || `Estado ${r.id_estado_bus}`,
            cantidad: r._count.id_bus,
          }))
        }),

      // 3) Kilometraje promedio y máximo
      prisma.bus.aggregate({
        _avg: { kilometraje: true },
        _max: { kilometraje: true },
      }),

      // 4) Mantenciones por estado
      prisma.mantenimiento
        .groupBy({
          by: ['id_estado_mantenimiento'],
          _count: { id_mantenimiento: true },
        })
        .then(async (rows) => {
          if (!rows.length) return []
          const estados = await prisma.estadoMantenimiento.findMany({
            where: {
              id_estado_mantenimiento: { in: rows.map((r) => r.id_estado_mantenimiento) },
            },
          })
          const map = new Map(
            estados.map((e) => [e.id_estado_mantenimiento, e.nombre_estado]),
          )
          return rows.map((r) => ({
            estado:
              map.get(r.id_estado_mantenimiento) ||
              `Estado ${r.id_estado_mantenimiento}`,
            cantidad: r._count.id_mantenimiento,
          }))
        }),

      // 5) Incidentes últimos 30 días (detalle)
      prisma.incidente.findMany({
        where: { fecha: { gte: hace30 } },
        orderBy: { fecha: 'desc' },
        take: 10,
        include: {
          bus: true,
          estado: true,
          tipo: true,
        },
      }),

      // 6) Alertas activas (no resueltas/anuladas)
      prisma.alerta.findMany({
        where: {
          estado: {
            nombre_estado: {
              notIn: ['CERRADA', 'RESUELTA', 'ANULADA'],
            },
          },
        },
        orderBy: { fecha_creacion: 'desc' },
        take: 10,
        include: {
          bus: true,
          tipo: true,
          estado: true,
          usuario: true,
        },
      }),

      // 7) Documentos por vencer (bus o conductor)
      prisma.documento.findMany({
        where: {
          fecha_caducidad: {
            gte: hoy,
            lte: dentro30,
          },
        },
        orderBy: { fecha_caducidad: 'asc' },
        take: 10,
        include: {
          bus: true,
          usuario: true,
          tipo: true,
          estado: true,
        },
      }),

      // 8) Mantenciones desde inicio de mes
      prisma.mantenimiento.count({
        where: { fecha: { gte: primerDiaMes } },
      }),

      // 9) Incidentes últimos 30 días (conteo)
      prisma.incidente.count({
        where: { fecha: { gte: hace30 } },
      }),

      // 10) Top buses con incidentes
      prisma.incidente
        .groupBy({
          by: ['id_bus'],
          where: { fecha: { gte: hace30 } },
          _count: { id_incidente: true },
        })
        .then(async (rows) => {
          if (!rows.length) return []
          rows.sort((a, b) => b._count.id_incidente - a._count.id_incidente)
          const top = rows.slice(0, 5)
          const idsBus = top.map((t) => t.id_bus)
          const buses = await prisma.bus.findMany({
            where: { id_bus: { in: idsBus } },
          })
          const map = new Map(buses.map((b) => [b.id_bus, b.patente]))
          return top.map((t) => ({
            id_bus: t.id_bus,
            patente: map.get(t.id_bus) || `Bus ${t.id_bus}`,
            cantidad: t._count.id_incidente,
          }))
        }),

      // 11) Buses con revisión técnica vencida o sin fecha
      prisma.bus.count({
        where: {
          OR: [
            { fecha_revision_tecnica: null },
            { fecha_revision_tecnica: { lt: hoy } },
          ],
        },
      }),

      // 12) Buses con extintor vencido o sin fecha
      prisma.bus.count({
        where: {
          OR: [
            { fecha_extintor: null },
            { fecha_extintor: { lt: hoy } },
          ],
        },
      }),
    ])

    const topBuses = rawTopIncidentesPorBus as TopIncidenteBus[]

    const up = (s: string) => s.toUpperCase()

    const resumen = {
      totalBuses,
      busesOperativos: busesPorEstado
        .filter((b) => up(b.estado).includes('OPERAT'))
        .reduce((acc, b) => acc + b.cantidad, 0),
      busesEnTaller: busesPorEstado
        .filter((b) => up(b.estado).includes('TALLER'))
        .reduce((acc, b) => acc + b.cantidad, 0),
      busesFueraServicio: busesPorEstado
        .filter((b) => up(b.estado).includes('FUERA'))
        .reduce((acc, b) => acc + b.cantidad, 0),
      kmPromedio: kmStats._avg.kilometraje ?? null,
      kmMaximo: kmStats._max.kilometraje ?? null,
      busesSinRevisionVigente: busesRevisionVencida,
      busesSinExtintorVigente: busesExtintorVigente,
      mantUltimoMes,
      incidentesUltimos30,
    }

    // ================== CREAR PDF ==================
    const doc = new PDFDocument({
      margin: 50,
      info: {
        Title: 'Reporte general de flota',
        Author: 'CheckBus',
      },
    })
    const stream = new PassThrough()
    doc.pipe(stream)

    event.node.res.setHeader('Content-Type', 'application/pdf')
    event.node.res.setHeader(
      'Content-Disposition',
      'attachment; filename="reporte-flota.pdf"',
    )

    // ---------- HEADER ----------
    const logoPath = join(process.cwd(), 'assets', 'fotos', 'logo.png')
    const headerY = doc.page.margins.top

    try {
      doc.image(logoPath, doc.page.margins.left, headerY - 5, { width: 60 })
    } catch {
      // si no hay logo, no fallamos
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(colors.dark)
      .text('Reporte general de flota', doc.page.margins.left + 70, headerY - 3)

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.medium)
      .text(
        `Generado el ${fmtDateTimeNow()} - Sistema CheckBus`,
        doc.page.margins.left + 70,
        headerY + 18,
      )

    const lineY = headerY + 40
    doc
      .moveTo(doc.page.margins.left, lineY)
      .lineTo(doc.page.width - doc.page.margins.right, lineY)
      .lineWidth(2)
      .strokeColor(colors.primary)
      .stroke()

    doc.y = lineY + 15
    doc.fillColor(colors.dark)

    // ---------- RESUMEN ----------
    addSectionTitle(doc, 'Resumen de la flota')

    const resumenRows = [
      { label: 'Total de buses', value: resumen.totalBuses },
      { label: 'Buses operativos', value: resumen.busesOperativos },
      { label: 'Buses en taller', value: resumen.busesEnTaller },
      {
        label: 'Buses fuera de servicio',
        value: resumen.busesFueraServicio,
        highlight: resumen.busesFueraServicio > 0,
      },
      {
        label: 'Kilometraje promedio',
        value:
          resumen.kmPromedio !== null ? `${resumen.kmPromedio.toFixed(0)} km` : '—',
      },
      {
        label: 'Kilometraje máximo',
        value: resumen.kmMaximo !== null ? `${resumen.kmMaximo.toFixed(0)} km` : '—',
      },
      {
        label: 'Buses sin revisión técnica vigente',
        value: resumen.busesSinRevisionVigente,
        highlight: resumen.busesSinRevisionVigente > 0,
      },
      {
        label: 'Buses sin extintor vigente',
        value: resumen.busesSinExtintorVigente,
        highlight: resumen.busesSinExtintorVigente > 0,
      },
      { label: 'Mantenciones este mes', value: resumen.mantUltimoMes },
      { label: 'Incidentes últimos 30 días', value: resumen.incidentesUltimos30 },
    ]

    addSummaryPanel(doc, resumenRows)

    // ---------- DISTRIBUCIÓN FLOTA ----------
    addSectionTitle(doc, 'Distribución de flota por estado')

    if (!busesPorEstado.length) {
      doc.fontSize(11).fillColor(colors.medium).text('No hay buses registrados.')
    } else {
      busesPorEstado.forEach((b: any) => {
        addBullet(doc, `${b.estado}: ${b.cantidad} bus(es)`)
      })
    }

    // ---------- ESTADO MANTENCIONES ----------
    addSectionTitle(doc, 'Estado de mantenciones')

    if (!mantPorEstado.length) {
      doc.fontSize(11).fillColor(colors.medium).text('No hay mantenciones registradas.')
    } else {
      mantPorEstado.forEach((m: any) => {
        addBullet(doc, `${m.estado}: ${m.cantidad} mantencion(es)`)
      })
    }

    // ---------- TOP INCIDENTES ----------
    addSectionTitle(doc, 'Buses con mas incidentes (ultimos 30 dias)')

    if (!topBuses.length) {
      doc
        .fontSize(11)
        .fillColor(colors.medium)
        .text('No se registran incidentes en los ultimos 30 dias.')
    } else {
      topBuses.forEach((b, idx) => {
        const pos = idx + 1
        addBullet(doc, `${pos}. ${b.patente}: ${b.cantidad} incidente(s)`)
      })
    }

    // ---------- INCIDENTES RECIENTES ----------
    addSectionTitle(doc, 'Incidentes recientes (ultimos 30 dias)')

    if (!incidentesRecientes.length) {
      doc
        .fontSize(11)
        .fillColor(colors.medium)
        .text('No se registran incidentes en los ultimos 30 dias.')
    } else {
      incidentesRecientes.forEach((i: any) => {
        ensureSpace(doc, 50)

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(colors.dark)
          .text(
            `[${fmtDate(i.fecha)}] Bus: ${i.bus?.patente ?? '—'} - ` +
              `${i.tipo?.nombre_tipo ?? '—'} - Estado: ${i.estado?.nombre_estado ?? '—'}`,
          )

        if (i.descripcion) {
          const text =
            i.descripcion.length > 120
              ? i.descripcion.substring(0, 120) + '...'
              : i.descripcion
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor(colors.medium)
            .text(`Descripcion: ${text}`)
        }

        doc.moveDown(0.7)
      })
    }

    // ---------- ALERTAS ACTIVAS ----------
    addSectionTitle(doc, 'Alertas activas')

    if (!alertasActivas.length) {
      doc.fontSize(11).fillColor(colors.medium).text('No hay alertas activas.')
    } else {
      alertasActivas.forEach((a: any) => {
        ensureSpace(doc, 60)

        let asociado = ''
        if (a.bus) {
          asociado = `Bus ${a.bus.patente}`
        } else if (a.usuario) {
          const rut = a.usuario.rut || ''
          const nombre = a.usuario.nombre || ''
          if (rut) asociado = `Conductor ${rut}`
          else if (nombre) asociado = `Conductor ${nombre}`
          else asociado = `Conductor ${a.id_usuario ?? ''}`
        } else if (a.id_mantenimiento) {
          asociado = `Mantencion #${a.id_mantenimiento}`
        } else if (a.id_incidente) {
          asociado = `Incidente #${a.id_incidente}`
        } else {
          asociado = 'Sin asociacion'
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(colors.dark)
          .text(`[${fmtDate(a.fecha_creacion)}] ${a.titulo}`)

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(colors.medium)
          .text(
            `Asociado a: ${asociado} | Prioridad: ${a.prioridad ?? '—'} | Estado: ${
              a.estado?.nombre_estado ?? '—'
            }`,
          )

        if (a.descripcion) {
          const text =
            a.descripcion.length > 120
              ? a.descripcion.substring(0, 120) + '...'
              : a.descripcion
          doc.text(`Detalle: ${text}`)
        }

        doc.moveDown(0.7)
      })
    }

    // ---------- DOCUMENTOS POR VENCER ----------
    addSectionTitle(doc, 'Documentos por vencer (proximos 30 dias)')

    if (!docsPorVencer.length) {
      doc
        .fontSize(11)
        .fillColor(colors.medium)
        .text('No hay documentos proximos a vencer.')
    } else {
      docsPorVencer.forEach((d: any) => {
        ensureSpace(doc, 50)

        let sujeto = ''
        if (d.bus) {
          sujeto = `Bus ${d.bus.patente}`
        } else if (d.usuario) {
          const rut = d.usuario.rut || ''
          const nombre = d.usuario.nombre || ''
          if (rut) sujeto = `Conductor ${rut}`
          else if (nombre) sujeto = `Conductor ${nombre}`
          else sujeto = `Conductor ${d.id_usuario ?? ''}`
        } else {
          sujeto = 'Sin asociacion'
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(colors.dark)
          .text(`${d.tipo?.nombre_tipo ?? 'Documento'} - Asociado a: ${sujeto}`)

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(colors.medium)
          .text(
            `Vencimiento: ${fmtDate(d.fecha_caducidad)} | Estado: ${
              d.estado?.nombre_estado ?? '—'
            } | Archivo: ${d.nombre_archivo}`,
          )

        doc.moveDown(0.7)
      })
    }

    doc.end()
    return sendStream(event, stream)
  } catch (err) {
    console.error('Error generando PDF de flota:', err)
    event.node.res.statusCode = 500
    return { message: 'Error generando el PDF de flota' }
  }
})
