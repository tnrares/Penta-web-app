<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

useSeoMeta({
  title: 'PentaWebApp — Jobs, clients & finances',
  description:
    'Construction and project operations in one workspace: jobs, workers, inventory, clients, and billing.',
  ogTitle: 'PentaWebApp',
  ogDescription:
    'Run jobs, clients, and finances in one workspace. Track work from quote to completion.',
})

const { $authClient, $orpc } = useNuxtApp()
const session = $authClient.useSession()

const healthCheck = useQuery({
  ...$orpc.healthCheck.queryOptions(),
  staleTime: 15_000,
  retry: 1,
  retryDelay: 1000,
  enabled: computed(() => !!session.value?.data?.user),
})
</script>

<template>
  <div>
    <div
      v-if="!session.isPending && !session.data"
      class="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-16 text-center sm:px-8 sm:py-20"
    >
      <p class="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500 sm:text-base">
        Construction &amp; project operations
      </p>
      <h1 class="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        <span class="penta-gradient-text">Run jobs, clients, and finances</span>
        <span class="text-white"> in one workspace.</span>
      </h1>
      <p class="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
        PentaWebApp helps teams track work from quote to completion—jobs, workers, inventory,
        and billing—so nothing falls through the cracks.
      </p>
      <div class="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
        <UButton
          to="/login"
          size="lg"
          class="penta-btn-primary min-h-12 justify-center px-8 text-base sm:min-h-[2.75rem] sm:text-lg"
        >
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
          Sign in
        </UButton>
        <UButton
          to="/register"
          size="lg"
          variant="outline"
          class="min-h-12 justify-center px-8 text-base ring-1 ring-gray-600 text-gray-200 sm:min-h-[2.75rem] sm:text-lg"
        >
          Create an account
        </UButton>
      </div>

      <footer class="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-800 pt-10 text-sm text-gray-500">
        <NuxtLink to="/privacy" class="hover:text-gray-300">Privacy</NuxtLink>
        <NuxtLink to="/terms" class="hover:text-gray-300">Terms</NuxtLink>
      </footer>
    </div>
    <div v-else-if="session.data" class="container mx-auto max-w-3xl px-4 py-2">
      <div class="mb-6 rounded-xl border border-gray-800 bg-[#18181b] p-6 ring-1 ring-gray-800/80">
        <p class="mb-1 text-sm text-gray-500">Welcome back</p>
        <p class="text-lg font-medium text-white">
          {{ session.data.user?.name || session.data.user?.email }}
        </p>
        <NuxtLink
          to="/dashboard"
          class="mt-4 inline-flex items-center gap-2 text-sm penta-text-accent hover:underline"
        >
          Open dashboard
          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
        </NuxtLink>
      </div>
      <div class="grid gap-6 mt-4">
        <section class="rounded-lg border border-gray-800 bg-[#18181b] p-4 ring-1 ring-gray-800/60">
          <h2 class="mb-2 font-medium">API status</h2>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">
              <template v-if="healthCheck.status.value === 'pending'">Checking…</template>
              <template v-else-if="healthCheck.status.value === 'success'">
                Connected ({{ healthCheck.data.value }})
              </template>
              <template v-else-if="healthCheck.status.value === 'error'">
                Error: {{ healthCheck.error.value?.message || 'Failed to connect' }}
              </template>
              <template v-else>Idle</template>
            </span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
