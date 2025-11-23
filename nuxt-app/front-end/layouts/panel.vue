<template>
  <div class="layout">
    <aside class="sidebar">
      <Sidebar />
    </aside>

    <header class="topbar">
      <Topbar />
    </header>

    <main class="main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
import Topbar from '~/components/TopBar.vue'
</script>
