<script setup lang="ts">
import StatusBadge from '../components/StatusBadge.vue'

export interface BusRow {
  id:number; code:number; plate:string; model:string; year:number; km:number;
  estado:'OPERATIVO'|'MANTENIMIENTO'|'FUERA DE SERVICIO'
}

const props = defineProps<{ rows: BusRow[] }>()
</script>

<template>
  <div class="card">
    <h3 style="margin:0 0 .75rem 0">Listado de Buses</h3>

    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Código</th>
          <th>Patente</th>
          <th>Modelo</th>
          <th>Año</th>
          <th>KM</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in props.rows" :key="r.id">
          <td>{{ r.id }}</td>
          <td>{{ r.code }}</td>
          <td>{{ r.plate }}</td>
          <td>{{ r.model }}</td>
          <td>{{ r.year }}</td>
          <td>{{ r.km.toLocaleString() }} km</td>
          <td><StatusBadge :status="r.estado" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table { width:100%; border-collapse:collapse }
.table thead th { text-align:left; font-size:.9rem; color:#374151; background:#f3f4f6; padding:.65rem .75rem; }
.table tbody td { border-top:1px solid #e5e7eb; padding:.65rem .75rem; }
.table tbody tr:hover { background:#f9fafb; }
</style>
