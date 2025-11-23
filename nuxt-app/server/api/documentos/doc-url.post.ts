// server/api/doc-url.post.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { defineEventHandler, readBody, createError } from 'h3' // Asegúrate de importar h3 utils

function extOf(key: string): string {
    return (key.split('.').pop()?.toLowerCase() || '')
}

function isOfficeDoc(key: string): boolean {
    // Definimos las extensiones de Office que el visor de Microsoft puede manejar
    const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    return officeExts.includes(extOf(key))
}

function guessMimeByExt(key: string): string | undefined {
    const ext = extOf(key)
    const map: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        txt: 'text/plain',
        csv: 'text/csv',
        json: 'application/json'
        // NOTA: No es necesario mapear los MIME de Office aquí si usamos el visor
    }
    return map[ext]
}

export default defineEventHandler(async (event) => {
    const cfg = useRuntimeConfig()
    // body ahora usa el tipo de h3 para una mejor tipificación
    const b = await readBody<{ key: string; inline?: boolean; contentType?: string; expiresIn?: number }>(event)
    
    if (!b?.key) throw createError({ statusCode: 400, statusMessage: 'key requerido' })

    const s3 = new S3Client({
        region: cfg.awsRegion,
        credentials: { accessKeyId: cfg.awsAccessKeyId, secretAccessKey: cfg.awsSecretAccessKey }
    })

    const filename = b.key.split('/').pop() || 'archivo'
    
    // 1. Crear la URL firmada de S3 (GET)
    // El 'disposition' y 'responseType' se mantienen para PDF/Imágenes/Descarga
    const disposition = b.inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`
    const responseType = b.contentType || guessMimeByExt(b.key)

    const cmd = new GetObjectCommand({
        Bucket: cfg.s3Bucket,
        Key: b.key,
        ResponseContentDisposition: disposition,
        ResponseContentType: responseType
    })

    // La URL firmada es la URL pública que usará el visor de Office
    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: b.expiresIn ?? 300 })
    
    // 2. Comprobar si es un documento de Office y si se quiere ver en línea
    if (isOfficeDoc(b.key) && b.inline !== false) {
        // Para Office, devolvemos la URL del visor de Microsoft, que toma la URL firmada como parámetro
        // Nota: URL encode es fundamental aquí.
        const encodedUrl = encodeURIComponent(signedUrl)
        const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`
        
        return { url: viewerUrl }
    }
    
    // 3. Para PDF, Imágenes o Descarga forzada, devolvemos la URL firmada de S3 directamente
    return { url: signedUrl }
})