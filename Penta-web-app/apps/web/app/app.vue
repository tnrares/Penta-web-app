<script setup lang="ts">
import { VueQueryDevtools } from '@tanstack/vue-query-devtools'
</script>

<template>
    <div>
        <NuxtLoadingIndicator />
        <UApp>
            <NuxtLayout>
                <NuxtPage />
            </NuxtLayout>
        </UApp>
    </div>
</template>