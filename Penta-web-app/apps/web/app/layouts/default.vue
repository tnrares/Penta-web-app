<script setup>
</script>

<template>
    <div class="grid grid-cols-[auto_1fr] h-screen w-full">
        <Header/>
        <main class="overflow-y-auto p-6">
            <slot />
        </main>
    </div>
</template>
