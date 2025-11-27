// server/api/doc-url.post.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { defineEventHandler, readBody, createError } from 'h3'

function extOf(key: string): string {
    return key.split('.').pop()?.toLowerCase() || ''
}

function isOfficeDoc(key: string): boolean {
    const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    return officeExts.includes(extOf(key))
}

function guessMimeByExt(key: string): string | undefined {
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
    }
    return map[extOf(key)]
}

export default defineEventHandler(async (event) => {
    // 🔥 en Nitro viejo o Nuxt 3.x → así
    const cfg = useRuntimeConfig()

    const b = await readBody<{
        key: string
        inline?: boolean
        contentType?: string
        expiresIn?: number
    }>(event)

    if (!b.key) {
        throw createError({
            statusCode: 400,
            statusMessage: 'key requerido'
        })
    }

    const s3 = new S3Client({
        region: cfg.awsRegion,
        credentials: {
            accessKeyId: cfg.awsAccessKeyId,
            secretAccessKey: cfg.awsSecretAccessKey
        }
    })

    const filename = b.key.split('/').pop() || 'archivo'
    const disposition = b.inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`
    const responseType = b.contentType || guessMimeByExt(b.key)

    const cmd = new GetObjectCommand({
        Bucket: cfg.s3Bucket,
        Key: b.key,
        ResponseContentDisposition: disposition,
        ResponseContentType: responseType
    })

    const signedUrl = await getSignedUrl(s3, cmd, {
        expiresIn: b.expiresIn ?? 300
    })

    if (isOfficeDoc(b.key) && b.inline !== false) {
        return {
            url: `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`
        }
    }

    return { url: signedUrl }
})
