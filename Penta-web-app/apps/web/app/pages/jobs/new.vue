<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'
const router = useRouter()

const state = ref({
  title: '',
  address: ''
})
const isLoading = ref(false)

const submitJob = async () => {
  isLoading.value = true
  try {
    const response = await fetch(`${serverUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state.value),
      credentials: 'include'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create job')
    }
    
    router.push('/dashboard')
  } catch (error: any) {
    alert(error.message)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-10 text-white h-full">
    <div class="mb-8">
      <NuxtLink to="/dashboard" class="text-gray-400 hover:text-white flex items-center gap-2 mb-4 w-fit">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to dashboard
      </NuxtLink>
      <h1 class="text-3xl font-bold">New job</h1>
      <p class="text-gray-400 mt-2">Enter the basics to register a new job request.</p>
    </div>
    
    <form @submit.prevent="submitJob" class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-8 space-y-6">
      
      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-300">Job title</label>
        <UInput 
          v-model="state.title" 
          placeholder="e.g. Full renovation of a 3-room apartment" 
          required 
          size="lg"
          :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-gray-300">Site address</label>
        <UTextarea 
          v-model="state.address" 
          placeholder="e.g. 10 Spring St, City, State" 
          required 
          :rows="3"
          :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
        />
      </div>

      <USeparator class="bg-gray-800" />

      <div class="flex justify-end gap-4">
        <UButton to="/dashboard" bg="gray" variant="ghost" class="text-gray-400 hover:text-white hover:bg-gray-800">
          Cancel
        </UButton>
        <UButton type="submit" bg="blue" :loading="isLoading" class="px-6 font-medium">
          Save job
        </UButton>
      </div>
      
    </form>
  </div>
</template>