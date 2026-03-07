<script setup lang="ts">
  import { useQuery } from '@tanstack/vue-query'
  
  const { $orpc } = useNuxtApp()
  const config = useRuntimeConfig()

  const healthCheck = useQuery({
    ...$orpc.healthCheck.queryOptions(),
    retry: 1,
    retryDelay: 1000,
  })

  // Debug logging
  watchEffect(() => {
    console.log('Health check status:', healthCheck.status.value)
    if (healthCheck.error.value) {
      console.error('Health check error:', healthCheck.error.value)
    }
    if (healthCheck.data.value) {
      console.log('Health check data:', healthCheck.data.value)
    }
  })
</script>

<template>
  <div class="container mx-auto max-w-3xl px-4 py-2">
    <div class="grid gap-6 mt-4">
      <section class="rounded-lg border p-4">
        <h2 class="mb-2 font-medium">API Status</h2>
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">
                <template v-if="healthCheck.status.value === 'pending'">
                  Checking...
                </template>
                <template v-else-if="healthCheck.status.value === 'success'">
                  Connected ({{ healthCheck.data.value }})
                </template>
                <template v-else-if="healthCheck.status.value === 'error'">
                  Error: {{ healthCheck.error.value?.message || 'Failed to connect' }}
                </template>
                 <template v-else>
                  Idle
                </template>
              </span>
            </div>
        </div>
      </section>
    </div>
  </div>
</template>
