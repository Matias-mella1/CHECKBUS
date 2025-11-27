export default defineNuxtConfig({

  srcDir: 'front-end/',

  nitro: {
    srcDir: 'server/'
  },

  devtools: { enabled: true },

  pages: true,

  css: ['~/assets/css/main.css',
    'vue-toastification/dist/index.css'
  ],

  app: {
    head: {
      title: 'Sistema de Gestión de Flota',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }
      ]
    }
  },

  runtimeConfig: {
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.S3_BUCKET,
    s3UploadPrefix: process.env.S3_UPLOAD_PREFIX || 'uploads/',
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
    databaseUrl: process.env.DATABASE_URL,

    public: {
      s3Bucket: process.env.S3_BUCKET
    }
  }
})