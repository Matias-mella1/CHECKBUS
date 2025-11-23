// fronted/server/api/upload-url.post.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig()

  // 🚨 validador de env
  const missing: string[] = []
  if (!cfg.awsRegion) missing.push('AWS_REGION')
  if (!cfg.awsAccessKeyId) missing.push('AWS_ACCESS_KEY_ID')
  if (!cfg.awsSecretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY')
  if (!cfg.s3Bucket) missing.push('S3_BUCKET')
  if (missing.length) {
    console.error('Faltan env:', missing)
    throw createError({ statusCode: 500, statusMessage: `Faltan variables de entorno: ${missing.join(', ')}` })
  }

  const { filename, folder } = await readBody<{ filename: string; folder?: string }>(event)
  if (!filename) throw createError({ statusCode: 400, statusMessage: 'filename requerido' })

  const prefix = (folder ?? cfg.s3UploadPrefix ?? 'uploads/').replace(/^\/+|\/+$/g, '')
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${prefix}/${Date.now()}-${safe}`

  const s3 = new S3Client({
    region: cfg.awsRegion,
    credentials: { accessKeyId: cfg.awsAccessKeyId, secretAccessKey: cfg.awsSecretAccessKey }
  })

  const cmd = new PutObjectCommand({ Bucket: cfg.s3Bucket, Key: key }) // sin headers firmados
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 })
  return { uploadUrl, key }
})
