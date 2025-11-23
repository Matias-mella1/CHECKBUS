<script setup lang="ts">
import { reactive, watch } from 'vue'
interface ConductorInput { rut:string; nombre:string; telefono?:string; licencia?:string; activo:boolean }

const props = defineProps<{ initial?: Partial<ConductorInput> }>()
const emit = defineEmits<{ (e:'save', value:ConductorInput):void; (e:'cancel'):void }>()

const form = reactive<ConductorInput>({
  rut: props.initial?.rut ?? '',
  nombre: props.initial?.nombre ?? '',
  telefono: props.initial?.telefono,
  licencia: props.initial?.licencia,
  activo: props.initial?.activo ?? true
})

watch(() => props.initial, (v) => { if (v) Object.assign(form, { ...form, ...v }) }, { deep:true })

function onSubmit(){
  if(!form.rut || !form.nombre) return alert('Completa RUT y nombre')
  emit('save', { ...form })
}
</script>

<template>
  <div class="grid" style="grid-template-columns:1fr 1fr; gap:1rem">
    <div><label class="label">RUT</label><input class="input" v-model="form.rut" /></div>
    <div><label class="label">Nombre</label><input class="input" v-model="form.nombre" /></div>
    <div><label class="label">Teléfono</label><input class="input" v-model="form.telefono" /></div>
    <div><label class="label">Licencia</label><input class="input" v-model="form.licencia" /></div>
    <div style="grid-column:1/-1">
      <label class="label">Activo</label>
      <select class="select" v-model="form.activo">
        <option :value="true">Sí</option>
        <option :value="false">No</option>
      </select>
    </div>
  </div>
  <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:1rem">
    <button class="row-action" @click="emit('cancel')">✖</button>
    <button class="btn" @click="onSubmit">Guardar</button>
  </div>
</template>