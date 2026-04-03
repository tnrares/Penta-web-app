<script setup lang="ts">
const { $authClient } = useNuxtApp()
const session = $authClient.useSession()
</script>

<template>
  <div class="min-h-screen w-full bg-background text-white">
    <template v-if="session.isPending">
      <div class="flex h-screen items-center justify-center">
        <Loader />
      </div>
    </template>

    <template v-else-if="session.data">
      <div class="grid h-screen w-full grid-cols-[auto_1fr]">
        <Header />
        <main class="min-h-0 overflow-y-auto p-6">
          <slot />
        </main>
      </div>
    </template>

    <template v-else>
      <main class="min-h-screen overflow-y-auto">
        <slot />
      </main>
    </template>
  </div>
</template>
