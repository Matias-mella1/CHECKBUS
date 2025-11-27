

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ address?: string }>()

const mapEl = ref<HTMLDivElement|null>(null)
let L: any = null
let map: any = null
let marker: any = null
let ready = false

const defaultLat = -36.833195 // Concepción
const defaultLng = -73.049469
const zoom = 14

function detectLatLng(text?: string): { lat: number; lng: number } | null {
  if (!text) return null
  const m = String(text).trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (!m) return null

  const [, latStr, lngStr] = m
  const lat = parseFloat(m[1]!)
const lng = parseFloat(m[2]!)

  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

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

function emojiIcon() {
  return L.divIcon({ className: 'emoji-pin', html: '📍', iconSize: [30,30], iconAnchor: [15,30], popupAnchor: [0,-28] })
}

async function geocodeAddress(q: string): Promise<{lat:number,lng:number} | null> {
  const query = q.trim()
  if (!query) return null
  try {
    const viewbox = '-73.20,-36.60,-72.90,-36.95' // Área Concepción
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=cl&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'IncidentesApp/1.0 (contact: correo@ejemplo.com)' } })
    const arr = await res.json()
    if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) }
  } catch {}
  return null
}

async function init() {
  if (!mapEl.value) return
  await ensureLeafletCss()
  const leaflet = await import('leaflet')
  L = leaflet.default || leaflet

  map = L.map(mapEl.value).setView([defaultLat, defaultLng], zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
  marker = L.marker([defaultLat, defaultLng], { icon: emojiIcon() }).addTo(map)

  const ll = detectLatLng(props.address)
  let p = ll
  if (!p && props.address) p = await geocodeAddress(props.address)
  if (p) {
    map.setView([p.lat, p.lng], 16)
    marker.setLatLng([p.lat, p.lng]).bindPopup(props.address || '').openPopup()
  }
  ready = true
}

onMounted(() => { init() })
onBeforeUnmount(() => { if (map) { map.remove(); map = null } })
</script>

<template>
  <div>
    <div v-if="!address" class="empty">No hay dirección para este incidente.</div>
    <div v-else ref="mapEl" class="mapbox"></div>
  </div>
</template>

<style scoped>
.mapbox { width: 100%; height: 420px; border:1px solid #e5e7eb; border-radius:12px; margin-top:.5rem; overflow:hidden; }
:deep(.leaflet-container img) { max-width: none !important; }
:deep(.leaflet-marker-pane) { z-index: 400; }
:deep(.leaflet-popup-pane) { z-index: 500; }
:deep(.emoji-pin) { font-size: 28px; line-height: 30px; text-shadow: 0 0 2px rgba(0,0,0,.25); }
.empty { padding:.75rem; background:#f9fafb; border:1px dashed #e5e7eb; border-radius:10px; color:#6b7280; }
</style>
```
