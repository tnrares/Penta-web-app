<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

definePageMeta({ middleware: 'auth' })

const { $authClient } = useNuxtApp()
const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'
const route = useRoute()
const router = useRouter()
const jobId = route.params.id

const session = $authClient.useSession()

interface Job {
  id: number
  title: string
  address: string
  status: string
  estimatedStartDate?: string | null
  estimatedEndDate?: string | null
  clientId: string
}

const state = ref<Partial<Job>>({
  title: '',
  address: '',
  status: 'PENDING_VISIT',
  estimatedStartDate: null,
  estimatedEndDate: null
})

const isLoading = ref(false)
const isSaving = ref(false)

// Încarcă datele job-ului
const { data: job, pending } = await useFetch<Job>(`${serverUrl}/api/jobs/${jobId}`, {
  credentials: 'include'
})

const formatDateTimeLocal = (dateString: string | null | undefined): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

onMounted(() => {
  if (job.value) {
    state.value = {
      title: job.value.title,
      address: job.value.address,
      status: job.value.status,
      estimatedStartDate: formatDateTimeLocal(job.value.estimatedStartDate),
      estimatedEndDate: formatDateTimeLocal(job.value.estimatedEndDate)
    }
  }
})

const statusOptions = [
  { label: 'Pending Visit', value: 'PENDING_VISIT' },
  { label: 'Quote Sent', value: 'QUOTE_SENT' },
  { label: 'Quote Accepted', value: 'QUOTE_ACCEPTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Finalized', value: 'FINALIZED' },
  { label: 'Closed & Paid', value: 'CLOSED_PAID' },
  { label: 'Canceled', value: 'CANCELED' }
]

const updateJob = async () => {
  if (!state.value.title || !state.value.address) {
    alert('Titlul și adresa sunt obligatorii.')
    return
  }

  isSaving.value = true
  try {
    const updateData: any = {
      title: state.value.title,
      address: state.value.address
    }

    // Doar MANAGER-ii pot schimba statusul
    const userRole = (session.value?.data?.user as any)?.role
    if (userRole === 'MANAGER' && state.value.status) {
      updateData.status = state.value.status
    }

    if (state.value.estimatedStartDate) {
      updateData.estimatedStartDate = new Date(state.value.estimatedStartDate).toISOString()
    }

    if (state.value.estimatedEndDate) {
      updateData.estimatedEndDate = new Date(state.value.estimatedEndDate).toISOString()
    }

    const response = await fetch(`${serverUrl}/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData),
      credentials: 'include'
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Eroare la actualizarea lucrării')
    }
    
    router.push(`/jobs/${jobId}`)
  } catch (error: any) {
    alert(error.message || 'Eroare la actualizarea lucrării')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-10 text-white h-full">
    <div v-if="pending" class="flex justify-center items-center h-full text-gray-500">
      Se încarcă...
    </div>

    <div v-else-if="job" class="space-y-6">
      <div class="mb-8">
        <NuxtLink :to="`/jobs/${jobId}`" class="text-gray-400 hover:text-white flex items-center gap-2 mb-4 w-fit">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          Înapoi la Detalii
        </NuxtLink>
        <h1 class="text-3xl font-bold">Editare Lucrare #{{ job.id }}</h1>
        <p class="text-gray-400 mt-2">Modificați detaliile lucrării.</p>
      </div>
      
      <form @submit.prevent="updateJob" class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-8 space-y-6">
        
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-300">Titlu Lucrare</label>
          <UInput 
            v-model="state.title" 
            placeholder="ex: Renovare completă apartament 3 camere" 
            required 
            size="lg"
            :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-300">Adresă Execuție</label>
          <UTextarea 
            v-model="state.address" 
            placeholder="ex: Str. Primăverii nr. 10, Sector 1, București" 
            required 
            :rows="3"
            :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
          />
        </div>

        <div v-if="(session?.data?.user as any)?.role === 'MANAGER'" class="space-y-2">
          <label class="block text-sm font-medium text-gray-300">Status</label>
          <USelect
            v-model="state.status"
            :options="statusOptions"
            option-attribute="label"
            value-attribute="value"
            :ui="{ base: 'bg-[#18181b] border-gray-800 text-white focus:ring-blue-500' }"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-300">Data Estimată de Început</label>
            <UInput 
              v-model="state.estimatedStartDate" 
              type="datetime-local"
              :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-300">Data Estimată de Finalizare</label>
            <UInput 
              v-model="state.estimatedEndDate" 
              type="datetime-local"
              :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-600 focus:ring-blue-500' }" 
            />
          </div>
        </div>

        <USeparator class="bg-gray-800" />

        <div class="flex justify-end gap-4">
          <UButton :to="`/jobs/${jobId}`" bg="gray" variant="ghost" class="text-gray-400 hover:text-white hover:bg-gray-800">
            Anulare
          </UButton>
          <UButton type="submit" bg="blue" :loading="isSaving" class="px-6 font-medium">
            Salvează Modificările
          </UButton>
        </div>
        
      </form>
    </div>

    <div v-else class="text-center py-10 text-gray-500">
      Lucrarea nu a fost găsită.
    </div>
  </div>
</template>
