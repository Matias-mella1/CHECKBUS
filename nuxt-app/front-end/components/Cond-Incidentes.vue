<script setup lang="ts">
import { ref, reactive, watchEffect, onMounted, onBeforeUnmount } from 'vue'

/* =========================
   Tipos y Props/Emits
========================= */
type BusOpt = { id:number; label:string }
type CatOpt = { id:number; nombre:string }

type Initial = {
  id?: number
  id_bus?: number | null
  fecha?: string
  urgencia?: string
  ubicacion?: string
  descripcion?: string
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

/* =========================
   Urgencias (select)
========================= */
const URGENCIAS = ['BAJA','MEDIA','ALTA','CRÍTICA'] as const
type Urgencia = typeof URGENCIAS[number]

/* =========================
   Helpers
========================= */
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
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]) as Promise<T>
}

/* =========================
   Form
========================= */
type FormState = {
  id?: number
  id_bus: number | ''
  fecha: string
  urgencia: Urgencia | ''
  ubicacion: string
  descripcion: string
  id_tipo_incidente: number | ''
  error: string
}

const form = reactive<FormState>({
  id: props.initial?.id ?? undefined,
  id_bus: (props.initial?.id_bus ?? '') as number | '',
  fecha: ymdOrEmpty(props.initial?.fecha),
  urgencia: ((props.initial?.urgencia ?? '') as Urgencia | ''),
  ubicacion: props.initial?.ubicacion ?? '',
  descripcion: props.initial?.descripcion ?? '',
  id_tipo_incidente: (props.initial?.id_tipo_incidente ?? '') as number | '',
  error: ''
})

watchEffect(() => {
  form.id = props.initial?.id ?? undefined
  form.id_bus = (props.initial?.id_bus ?? '') as number | ''
  form.fecha = ymdOrEmpty(props.initial?.fecha)
  const u = (props.initial?.urgencia ?? '').toUpperCase()
  form.urgencia = (URGENCIAS.includes(u as Urgencia) ? (u as Urgencia) : '') as Urgencia | ''
  form.ubicacion = props.initial?.ubicacion ?? ''
  form.descripcion = props.initial?.descripcion ?? ''

  let tipoId = props.initial?.id_tipo_incidente ?? ''
  if ((tipoId === '' || tipoId == null) && props.initial?.tipoNombreOId != null) {
    tipoId = findTipoIdByNameOrId(props.tipos, props.initial.tipoNombreOId) ?? ''
  }
  form.id_tipo_incidente = tipoId as number | ''
})

function validate(): string | null {
  if (!form.id_bus) return 'Debes seleccionar un Bus.'
  if (!form.id_tipo_incidente) return 'Debes seleccionar un Tipo.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) return 'La fecha debe tener formato YYYY-MM-DD.'
  return null
}
function onSave() {
  const err = validate()
  if (err) { form.error = err; return }
  emit('save', {
    id: form.id ?? undefined,
    id_bus: Number(form.id_bus),
    fecha: form.fecha,
    urgencia: form.urgencia || undefined,
    ubicacion: form.ubicacion || undefined,
    descripcion: form.descripcion || undefined,
    id_tipo_incidente: Number(form.id_tipo_incidente),
  })
}

/* =========================
   Leaflet + Nominatim + Overpass
========================= */
const mapEl = ref<HTMLDivElement|null>(null)
let L: any = null
let map: any = null
let marker: any = null
let accuracyCircle: any = null
let mapReady = false
let geocodeSeq = 0
const addrCache = new Map<string, string>()
let ro: ResizeObserver | null = null

// Centro: Concepción
const defaultLat = -36.833195
const defaultLng = -73.049469
const zoom = 13

// Helpers dirección
type ShortAddr = { text: string; street?: string; house?: string; city?: string }
function shortAddress(addr: any): ShortAddr {
  const street = addr?.road || addr?.residential || addr?.pedestrian || addr?.path || addr?.street || addr?.footway
  const house  = addr?.house_number
  const city   = addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || addr?.suburb || addr?.neighbourhood
  let text = ''
  if (street && city) text = house ? `${street} ${house}, ${city}` : `${street}, ${city}`
  else if (street)    text = house ? `${street} ${house}` : `${street}`
  else if (city)      text = `${city}`
  return { text: text.trim(), street, house, city }
}
function composeShort(street?:string, house?:string, city?:string) {
  if (street && house && city) return `${street} ${house}, ${city}`
  if (street && house)         return `${street} ${house}`
  if (street && city)          return `${street}, ${city}`
  if (street)                  return `${street}`
  if (city)                    return `${city}`
  return ''
}
function cacheKey(lat:number, lng:number) { return `${lat.toFixed(5)},${lng.toFixed(5)}` }

// Nominatim
const NOMINATIM_EMAIL = 'tu-correo@ejemplo.com' // reemplázalo
const USER_AGENT = 'IncidentesApp/1.0 (contact: tu-correo@ejemplo.com)'

async function reverseGeocode(lat:number, lng:number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&email=${encodeURIComponent(NOMINATIM_EMAIL)}&t=${Date.now()}`
    const res = await withTimeout(fetch(url, {
      headers: { 'Accept-Language': 'es', 'User-Agent': USER_AGENT }
    }), 1200)
    return await res.json()
  } catch { return null }
}
async function geocodeAddress(q: string): Promise<{lat:number,lng:number} | null> {
  const query = q.trim()
  if (!query) return null
  try {
    const viewbox = '-73.20,-36.60,-72.90,-36.95'
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=cl&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(query)}&email=${encodeURIComponent(NOMINATIM_EMAIL)}&t=${Date.now()}`
    const res = await withTimeout(fetch(url, {
      headers: { 'Accept-Language': 'es', 'User-Agent': USER_AGENT }
    }), 1500)
    const arr = await res.json()
    if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) {
      return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
    }
  } catch {}
  return null
}

// Overpass (número cercano)
function haversine(a:{lat:number,lng:number}, b:{lat:number,lng:number}) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI/180
  const dLng = (b.lng - a.lng) * Math.PI/180
  const lat1 = a.lat * Math.PI/180
  const lat2 = b.lat * Math.PI/180
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(x))
}
async function overpassNearestHouse(lat:number, lng:number): Promise<{house:string; street?:string} | null> {
  const radius = 120
  const q = `
    [out:json][timeout:10];
    (
      node(around:${radius},${lat},${lng})["addr:housenumber"];
      way(around:${radius},${lat},${lng})["addr:housenumber"];
      relation(around:${radius},${lat},${lng})["addr:housenumber"];
    );
    out center tags qt;`.trim()

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
  ]

  const jobs = endpoints.map(ep =>
    withTimeout(fetch(ep, { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } }), 1500)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  )
  const results = await Promise.all(jobs)
  const here = { lat, lng }

  for (const data of results) {
    const els: any[] = Array.isArray(data?.elements) ? data.elements : []
    if (!els.length) continue
    const best = els.map(el => {
      const c = el.center ?? { lat: el.lat, lon: el.lon }
      const p = { lat: Number(c?.lat), lng: Number(c?.lon) }
      return { el, dist: haversine(here, p) }
    }).filter(x => Number.isFinite(x.dist)).sort((a,b) => a.dist - b.dist)[0]
    if (!best) continue
    const tags = best.el.tags || {}
    const house = tags['addr:housenumber']
    const street = tags['addr:street']
    if (house) return { house: String(house), street: street ? String(street) : undefined }
  }
  return null
}

/* =========================
   Marcador SIEMPRE visible con divIcon (emoji 📍)
========================= */
function createEmojiIcon() {
  return L.divIcon({
    className: 'emoji-pin',
    html: '📍',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  })
}

// Dirección a partir de lat/lng (con cache y anti-race)
async function setLocationFromLatLng(lat:number, lng:number) {
  const mySeq = ++geocodeSeq

  if (mapReady && map && marker) {
    map.setView([lat, lng], Math.max(map.getZoom(), 16))
    marker.setLatLng([lat, lng])
  }
  if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null }

  const ck = cacheKey(lat, lng)
  const cached = addrCache.get(ck)
  form.ubicacion = cached ?? 'Buscando dirección…'

  const pRev  = reverseGeocode(lat, lng)
  const pOver = overpassNearestHouse(lat, lng)

  // 1) Nominatim primero (rápido)
  pRev.then(rev => {
    if (mySeq !== geocodeSeq) return
    const { text, street, house, city }: ShortAddr =
      rev?.address ? shortAddress(rev.address) : { text:'', street:undefined, house:undefined, city:undefined }
    let firstText = text || (street ? composeShort(street, 'S/N', city) : '')
    if (!firstText) firstText = 'Dirección no disponible'
    form.ubicacion = firstText
    if (mapReady && marker) marker.bindPopup(firstText).openPopup()
  }).catch(() => {})

  // 2) Overpass para añadir número si existe
  const near = await pOver.catch(() => null)
  if (mySeq !== geocodeSeq) return
  if (near) {
    const rev = await pRev.catch(() => null)
    const sa: ShortAddr =
      rev?.address ? shortAddress(rev.address) : { text:'', street:undefined, house:undefined, city:undefined }
    const chosenStreet = sa.street || near.street
    const refined = composeShort(chosenStreet, near.house, sa.city)
    if (refined) {
      form.ubicacion = refined
      addrCache.set(ck, refined)
      if (mapReady && marker) marker.bindPopup(refined).openPopup()
    }
  } else if (!cached && form.ubicacion) {
    addrCache.set(ck, form.ubicacion)
  }
}

/* =========================
   Inicialización del mapa
========================= */
const addressInput = ref<HTMLInputElement|null>(null)

async function ensureLeafletCss() {
  const cssId = 'leaflet-css'
  if (document.getElementById(cssId)) return
  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.id = cssId
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    link.onload = () => resolve()
    link.onerror = () => reject(new Error('No se pudo cargar Leaflet CSS'))
    document.head.appendChild(link)
  })
}

async function initMap() {
  if (typeof window === 'undefined' || !mapEl.value) return

  await ensureLeafletCss()

  const leaflet = await import('leaflet')
  L = leaflet.default || leaflet

  map = L.map(mapEl.value).setView([defaultLat, defaultLng], zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

  // Marcador con emoji 📍
  marker = L.marker([defaultLat, defaultLng], { draggable: true, icon: createEmojiIcon() }).addTo(map)

  // Arregla montajes en contenedor oculto
  setTimeout(() => map.invalidateSize(), 0)

  map.on('click', async (e: any) => {
    const { lat, lng } = e.latlng
    await setLocationFromLatLng(lat, lng)
  })
  marker.on('dragend', async () => {
    const pos = marker.getLatLng()
    await setLocationFromLatLng(pos.lat, pos.lng)
  })

  mapReady = true

  // Invalida tamaño cuando cambia el diálogo (evita recortes)
  const sheet = document.querySelector('.dialog-sheet') as HTMLElement | null
  ro = new ResizeObserver(() => { if (map) map.invalidateSize() })
  if (sheet) ro.observe(sheet)
}

/* =========================
   Acciones UI
========================= */
async function useMyLocation() {
  if (!navigator.geolocation) return alert('Geolocalización no soportada por el navegador.')
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords
    if (mapReady && map) {
      if (accuracyCircle) accuracyCircle.remove()
      accuracyCircle = L.circle([lat, lng], {
        radius: accuracy, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.15, weight: 1,
      }).addTo(map)
    }
    await setLocationFromLatLng(lat, lng)
  }, (err) => {
    console.error(err)
    alert('No se pudo obtener tu ubicación.')
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
}

async function searchAddress() {
  const input = form.ubicacion.trim()
  if (!input) { addressInput.value?.focus(); return }
  const res = await geocodeAddress(input)
  if (!res) { alert('No se encontró esa dirección. Usa “calle número, ciudad” o marca en el mapa.'); return }
  await setLocationFromLatLng(res.lat, res.lng)
}

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
  if (ro) { ro.disconnect(); ro = null }
  accuracyCircle = null
})
</script>

<template>
  <!-- Hoja/diálogo que respeta el topbar -->
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
          <input class="input" type="date" v-model="form.fecha" />
        </div>

        <div>
          <label class="label">Tipo *</label>
          <select class="input" v-model="form.id_tipo_incidente">
            <option :value="''" disabled>Selecciona tipo…</option>
            <option v-for="t in tipos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
          </select>
        </div>

        <div>
          <label class="label">Urgencia</label>
          <select class="input" v-model="form.urgencia">
            <option :value="''" disabled>Selecciona urgencia…</option>
            <option v-for="u in URGENCIAS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>

        <!-- Ubicación -->
        <div class="span-2">
          <label class="label">Ubicación</label>

          <div class="row loc-row">
            <input
              ref="addressInput"
              class="input"
              v-model="form.ubicacion"
              placeholder='Escribe "calle número, ciudad" o usa el mapa'
              @keyup.enter.prevent="searchAddress"
            />
            <button class="btn small" type="button" @click="searchAddress">🔎 Buscar</button>
            <button class="btn small" type="button" @click="useMyLocation">📍 Mi ubicación</button>
          </div>

          <div class="mapwrap">
            <div ref="mapEl" class="mapbox"></div>
          </div>

          <small class="hint center-hint">
            Se mostrará <strong>“Calle Nº, Ciudad”</strong> cuando sea posible.
            Si no hay numeración, se mostrará <strong>“Calle S/N, Ciudad”</strong>.
          </small>
        </div>

        <div class="span-2">
          <label class="label">Descripción</label>
          <textarea class="input" rows="4" v-model="form.descripcion" placeholder="Detalle del incidente…"></textarea>
        </div>

        <p v-if="form.error" class="error span-2">⚠️ {{ form.error }}</p>

        <div class="actions span-2">
          <button type="button" class="row-action" @click="$emit('cancel')">✖ Cancelar</button>
          <button type="submit" class="btn">💾 Guardar</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
:root{ --header-h: 64px; }

/* Hoja de diálogo para que no la tape el topbar */
.dialog-sheet{
  position: fixed;
  top: calc(var(--header-h) + 16px);
  left: 50%;
  transform: translateX(-50%);
  width: min(920px, 95vw);
  max-height: calc(100vh - var(--header-h) - 32px);
  overflow: auto;
  background:#fff;
  border-radius:12px;
  box-shadow: 0 10px 30px rgba(0,0,0,.14);
  padding: 1rem;
  z-index: 1001;
}

.label { display:block; font-size:.85rem; color:#4b5563; margin-bottom:.35rem; font-weight:600; }
.input, textarea.input, select.input { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:.5rem .75rem; outline:none; }
.input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.25); }
.grid { display:grid; }
.span-2 { grid-column: span 2 / span 2; }
.row { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
.btn.small { padding:.4rem .6rem; border-radius:8px; background:#2563eb; color:#fff; border:none; cursor:pointer; }
.btn.small:hover { background:#1d4ed8; }

/* Centrado mapa */
.loc-row { justify-content: center; }
.mapwrap { display:flex; justify-content:center; width:100%; }
.mapbox { width: min(100%, 640px); height: 320px; margin-top:.5rem; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
.center-hint { display:block; text-align:center; }

.actions { display:flex; gap:.5rem; justify-content:flex-end; margin-top:.75rem; }
.row-action { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:.45rem .8rem; cursor:pointer; font-weight:600; font-size:.9rem; min-width:100px; text-align:center; }
.row-action:hover { background:#e5e7eb; }
.btn { background:#2563eb; color:#fff; border:none; border-radius:8px; padding:.45rem .8rem; font-weight:600; cursor:pointer; font-size:.9rem; min-width:100px; text-align:center; }
.btn:hover { background:#1d4ed8; }
.btn:disabled { opacity:.6; cursor:not-allowed; }
.error { color:#dc2626; margin-top:.5rem; }
.hint { color:#6b7280; font-size:.85rem; display:block; margin-top:.35rem; }

/* ====== FIXES Leaflet y marker visible ====== */
:deep(.leaflet-container img) { max-width: none !important; }
:deep(.leaflet-pane) { z-index: 0; }
:deep(.leaflet-marker-pane) { z-index: 400; }
:deep(.leaflet-popup-pane) { z-index: 500; }

/* Estilo del divIcon con emoji 📍 */
:deep(.emoji-pin) {
  font-size: 28px;
  line-height: 30px;
  text-shadow: 0 0 2px rgba(0,0,0,.25);
}
</style>
