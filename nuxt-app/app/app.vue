<template>
  <ClientOnly>
    <n-config-provider>
      <n-message-provider>
        <NuxtLayout />
      </n-message-provider>
    </n-config-provider>
  </ClientOnly>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
</script>
