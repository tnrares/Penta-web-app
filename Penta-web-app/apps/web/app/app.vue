<script setup lang="ts">
useHead({
	htmlAttrs: { lang: "en" },
});
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