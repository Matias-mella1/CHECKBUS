// plugins/toast.client.ts
import { defineNuxtPlugin } from '#app'
import Toast, { POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'

export default defineNuxtPlugin((nuxtApp) => {
  const options = {
    position: POSITION.TOP_CENTER,
    timeout: 3000,
    closeOnClick: true,
    pauseOnHover: true,

    // 🔥 ESTO ES LO QUE PERMITE USAR HTML EN LOS TOASTS
    allowHtml: true
  }

  nuxtApp.vueApp.use(Toast, options)
})
