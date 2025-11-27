<script setup lang="ts">
import { ref, reactive, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import { useToast } from 'vue-toastification'


const toast = useToast()

function showValidationToast(errors: string[]) {
  const msg = [
    'Errores de validación (revisar campos):',
    ...errors.map(e => `- ${e}`),
  ].join('\n')

  toast.clear()
  toast.error(msg, {
    timeout: 7000,
    closeOnClick: true,
    pauseOnHover: true,
  })
}

type BusOpt = { id:number; label:string }
type CatOpt = { id:number; nombre:string }

type Initial = {
  id?: number
  id_bus?: number | null
  fecha?: string
  urgencia?: string
  ubicacion?: string
  descripcion?: string
  id_estado_incidente?: number | null 
  id_tipo_incidente?: number | null
  tipoNombreOId?: string | number
}

const props = defineProps<{
  initial?: Initial
  buses: BusOpt[]
  tipos: CatOpt[]  
}>()

const emit = defineEmits<{
  (e:'save', payload:{
    id?: number
    id_bus: number
    fecha: string
    urgencia?: string
    ubicacion?: string
    descripcion?: string
    id_tipo_incidente: number
  }): void
  (e:'cancel'): void
}>()


const URGENCIAS = ['BAJA','MEDIA','ALTA','CRÍTICA'] as const


function ymdOrEmpty(v?: string) {
  if (!v) {
    const d = new Date()
    const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString()
    return iso.slice(0,10)
  }
  return String(v).slice(0,10)
}

function findTipoIdByNameOrId(arr:CatOpt[], v?:string|number) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const s = String(v).trim().toUpperCase()
  return arr.find(t => t.nombre.toUpperCase() === s)?.id ?? null
}


const form = reactive({
  id: props.initial?.id ?? undefined,
  id_bus: (props.initial?.id_bus ?? '') as number | '',
  fecha: ymdOrEmpty(props.initial?.fecha),
  urgencia: (props.initial?.urgencia ?? '') as string | '',
  ubicacion: props.initial?.ubicacion ?? '',
  descripcion: props.initial?.descripcion ?? '',
  id_tipo_incidente: (props.initial?.id_tipo_incidente ?? '') as number | '',
})

watchEffect(() => {
  form.id = props.initial?.id ?? undefined
})

function validate(): boolean {
  const errors: string[] = []

  if (!form.id_bus) errors.push('Debes seleccionar un Bus.')
  if (!form.id_tipo_incidente) errors.push('Debes seleccionar un Tipo.')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha))
    errors.push('La fecha debe tener formato YYYY-MM-DD.')

  if (form.descripcion.length > 2000)
    errors.push('La descripción debe tener máximo 2000 caracteres.')

  if (errors.length) {
    showValidationToast(errors)
    return false
  }
  return true
}

function onSave() {
  if (!validate()) return

  emit('save', {
    id: form.id ?? undefined,
    id_bus: Number(form.id_bus),
    fecha: form.fecha,
    urgencia: form.urgencia || undefined,
    ubicacion: form.ubicacion || undefined,
    descripcion: form.descripcion || undefined,
    id_tipo_incidente: Number(form.id_tipo_incidente)
  })
}


const mapEl = ref(null)
let L: any = null
let map: any = null
let marker: any = null
let mapReady = false

const defaultLat = -36.833195
const defaultLng = -73.049469
const zoom = 14

async function reverseGeocode(lat:number, lng:number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const res = await fetch(url)
    return await res.json()
  } catch { return null }
}

async function geocodeAddress(q: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url)
    const arr = await res.json()
    if (arr[0]) {
      return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
    }
  } catch {}
  return null
}

async function setLocationFromLatLng(lat:number, lng:number) {
  if (mapReady && marker) {
    map.setView([lat,lng], 16)
    marker.setLatLng([lat,lng])
  }

  form.ubicacion = 'Buscando dirección…'

  const rev = await reverseGeocode(lat,lng)

  const street = rev?.address?.road || rev?.address?.street
  const house = rev?.address?.house_number
  const city = rev?.address?.city || rev?.address?.town

  if (street && city) {
    form.ubicacion = house
      ? `${street} ${house}, ${city}`
      : `${street}, ${city}`
  } else form.ubicacion = city || street || 'Dirección no disponible'
}

async function initMap() {
  if (!mapEl.value) return

  await import('leaflet/dist/leaflet.css')
  const leaflet = await import('leaflet')
  L = leaflet.default || leaflet

  map = L.map(mapEl.value).setView([defaultLat, defaultLng], zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

  marker = L.marker([defaultLat, defaultLng], {
    draggable: true,
    icon: L.divIcon({
      className: 'emoji-pin',
      html: '📍',
      iconSize: [30,30],
      iconAnchor: [15,30],
    })
  }).addTo(map)

  marker.on('dragend', () => {
    const pos = marker.getLatLng()
    setLocationFromLatLng(pos.lat, pos.lng)
  })

  map.on('click', (e:any) => {
    setLocationFromLatLng(e.latlng.lat, e.latlng.lng)
  })

  mapReady = true
}

async function searchAddr() {
  if (!form.ubicacion.trim()) return
  const res = await geocodeAddress(form.ubicacion.trim())
  if (!res) {
    toast.error('No se encontró esa dirección.')
    return
  }
  setLocationFromLatLng(res.lat, res.lng)
}

function useMyLocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(pos => {
    setLocationFromLatLng(pos.coords.latitude, pos.coords.longitude)
  })
}

onMounted(initMap)
onBeforeUnmount(() => { if (map) map.remove() })
</script>

<template>
  <div class="dialog-sheet">
    <form @submit.prevent="onSave">
      <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">

        <div>
          <label class="label">Bus *</label>
          <select class="input" v-model="form.id_bus">
            <option :value="''" disabled>Selecciona un bus…</option>
            <option v-for="b in buses" :key="b.id" :value="b.id">{{ b.label }}</option>
          </select>
        </div>

        <div>
          <label class="label">Fecha *</label>
          <input type="date" class="input" v-model="form.fecha" />
        </div>

        <div>
          <label class="label">Tipo *</label>
          <select class="input" v-model="form.id_tipo_incidente">
            <option :value="''">Selecciona tipo…</option>
            <option v-for="t in tipos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
          </select>
        </div>

        <div>
          <label class="label">Urgencia</label>
          <select class="input" v-model="form.urgencia">
            <option :value="''">Selecciona urgencia…</option>
            <option v-for="u in URGENCIAS" :key="u">{{ u }}</option>
          </select>
        </div>

        <div class="span-2">
          <label class="label">Ubicación</label>

          <div class="row loc-row">
            <input class="input" v-model="form.ubicacion" placeholder="Calle número, ciudad…" @keyup.enter.prevent="searchAddr" />
            <button type="button" class="btn small" @click="searchAddr">🔎 Buscar</button>
            <button type="button" class="btn small" @click="useMyLocation">📍 Mi Ubicación</button>
          </div>

          <div class="mapwrap">
            <div ref="mapEl" class="mapbox"></div>
          </div>
        </div>

        <div class="span-2">
          <label class="label">Descripción</label>
          <textarea rows="4" class="input" v-model="form.descripcion" />
        </div>

        <div class="actions span-2">
          <button type="button" class="row-action" @click="$emit('cancel')">✖ Cancelar</button>
          <button class="btn" type="submit">💾 Guardar</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.dialog-sheet {
  position: fixed;
  top: 80px;
  left:50%;
  transform: translateX(-50%);
  width:min(920px, 96vw);
  background:#fff;
  padding:1rem;
  border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.15);
  z-index:1001;
}
.label { font-size:.85rem; font-weight:600; color:#4b5563; margin-bottom:.3rem; }
.input { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:.5rem .75rem; }
.row { display:flex; gap:.4rem; flex-wrap:wrap; }
.btn.small { padding:.45rem .7rem; background:#2563eb; color:#fff; border-radius:8px; }
.mapwrap { display:flex; justify-content:center; }
.mapbox { width: min(100%,640px); height:320px; border-radius:10px; margin-top:.5rem; }
.actions { display:flex; justify-content:flex-end; gap:.5rem; margin-top:.7rem; }
.row-action { background:#f3f4f6; border:1px solid #e5e7eb; padding:.45rem .8rem; border-radius:8px; }
.btn { background:#2563eb; color:#fff; padding:.45rem .8rem; border-radius:8px; }
.emoji-pin { font-size:28px; }
</style>
