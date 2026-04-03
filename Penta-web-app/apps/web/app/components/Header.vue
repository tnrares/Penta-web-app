<script setup lang="ts">
import ModeToggle from './ModeToggle.vue'
import UserMenu from './UserMenu.vue'
import { UAvatar } from '#components'

const { $authClient } = useNuxtApp()
const session = $authClient.useSession()

const avatarLoadFailed = ref(false)
watch(
  () => session?.value?.data?.user?.image,
  () => {
    avatarLoadFailed.value = false
  }
)
const avatarSrc = computed(() => {
  if (avatarLoadFailed.value) return undefined
  const img = session?.value?.data?.user?.image
  return img || undefined
})

function onAvatarError() {
  avatarLoadFailed.value = true
}

const userRole = computed(() => (session?.value?.data?.user as { role?: string })?.role)

const links = computed(() => {
  if (userRole.value === "CLIENT") {
    return [
      { to: "/dashboard", label: "Dashboard", icon: "i-heroicons-chart-bar-square" },
      { to: "/jobs", label: "Jobs", icon: "i-heroicons-briefcase" },
      { to: "/team", label: "Your team", icon: "i-heroicons-user-group" },
      { to: "/clients", label: "Messages", icon: "i-heroicons-chat-bubble-left-right" },
      { to: "/finance", label: "Finances", icon: "i-heroicons-banknotes" },
      { to: "/settings", label: "Settings", icon: "i-heroicons-cog-6-tooth" },
    ]
  }
  return [
    { to: "/dashboard", label: "Dashboard", icon: "i-heroicons-chart-bar-square" },
    { to: "/jobs", label: "Jobs", icon: "i-heroicons-briefcase" },
    { to: "/clients", label: "Clients", icon: "i-heroicons-chat-bubble-left-right" },
    { to: "/workers", label: "Workers", icon: "i-heroicons:wrench-screwdriver" },
    { to: "/inventory", label: "Inventory", icon: "i-heroicons-building-office" },
    { to: "/finance", label: "Finances", icon: "i-heroicons-banknotes" },
    { to: "/settings", label: "Settings", icon: "i-heroicons-cog-6-tooth" },
  ]
})
</script>

<template>
  <div>
    <div class="flex flex-col items-center justify-between h-full px-4 py-6 border-r border-gray-200 bg-background">
      <NuxtLink to="/" class="flex items-center gap-3 px-2 py-2 hover:bg-gray-800/50 rounded-md transition-colors cursor-pointer w-full text-left">
        <UIcon name="i-heroicons:paint-brush" class="w-6 h-6 mr-1 align-middle" />
        <h1 class="text-2xl font-bold penta-gradient-text">PentaWebApp</h1>
    </NuxtLink>

    <USeparator class="bg-gray-800" />
      <nav class="flex flex-col gap-6 text-lg">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="text-gray-300 hover:text-white px-3 py-2 rounded-md transition-colors"
          active-class="penta-nav-active font-semibold bg-gray-800/50"
        >
        <UIcon :name="link.icon" class="w-6 h-6 mr-1 align-middle" />
          {{ link.label }}
        </NuxtLink>
      </nav>
      <div class="flex flex-col gap-4 mt-auto">

        <USeparator class="bg-gray-800 align-bottom" />
        <NuxtLink to="/settings" class="flex items-center gap-3 px-2 py-2 hover:bg-gray-800/50 rounded-md transition-colors cursor-pointer w-full text-left">
          <UAvatar
            :src="avatarSrc"
            class="w-10 h-10"
            @error="onAvatarError"
          />
          <div class="flex flex-col">
            <h3 class="text-sm font-medium">{{ session?.data?.user?.name }}</h3>
            <p class="text-xs text-gray-500">{{ session?.data?.user?.email }}</p> 
          </div>
      </NuxtLink>
      <USeparator class="bg-gray-800" />
      <div class="flex items-center gap-3 px-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </div>
    </div>
  </div>
</template>