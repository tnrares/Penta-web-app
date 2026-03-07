<script setup lang="ts">
import { ref, computed } from 'vue'

const { $authClient } = useNuxtApp()
const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const searchQuery = ref('')
const activeFilter = ref('All Jobs')

interface Job {
  id: number
  title: string
  address: string
  status: string
  createdAt: string
  quote?: { totalAmount: number } | null
  client?: {
    id: string
    name: string
    email: string
    image?: string | null
  }
}

const { data: jobs, pending } = await useFetch<Job[]>(`${serverUrl}/api/jobs`, {
  credentials: 'include'
})

const filters = computed(() => {
  const all = jobs.value?.length || 0
  const pendingVisit = jobs.value?.filter(j => j.status === 'PENDING_VISIT').length || 0
  const quoteSent = jobs.value?.filter(j => j.status === 'QUOTE_SENT').length || 0
  const quoteAccepted = jobs.value?.filter(j => j.status === 'QUOTE_ACCEPTED').length || 0
  const inProgress = jobs.value?.filter(j => j.status === 'IN_PROGRESS').length || 0
  const finalized = jobs.value?.filter(j => j.status === 'FINALIZED').length || 0
  const closedPaid = jobs.value?.filter(j => j.status === 'CLOSED_PAID').length || 0
  const canceled = jobs.value?.filter(j => j.status === 'CANCELED').length || 0

  return [
    { label: 'All Jobs', count: all, value: 'ALL' },
    { label: 'Pending Visit', count: pendingVisit, value: 'PENDING_VISIT' },
    { label: 'Quote Sent', count: quoteSent, value: 'QUOTE_SENT' },
    { label: 'Quote Accepted', count: quoteAccepted, value: 'QUOTE_ACCEPTED' },
    { label: 'In Progress', count: inProgress, value: 'IN_PROGRESS' },
    { label: 'Finalized', count: finalized, value: 'FINALIZED' },
    { label: 'Closed & Paid', count: closedPaid, value: 'CLOSED_PAID' },
    { label: 'Canceled', count: canceled, value: 'CANCELED' }
  ]
})

const filteredJobs = computed(() => {
  if (!jobs.value) return []
  let filtered = jobs.value

  if (activeFilter.value !== 'All Jobs') {
    const filterValue = filters.value.find(f => f.label === activeFilter.value)?.value
    filtered = filtered.filter(j => j.status === filterValue)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(j => 
      j.title.toLowerCase().includes(query) || 
      j.address.toLowerCase().includes(query)
    )
  }

  return filtered
})

const getStatusClasses = (status: string) => {
  const map: Record<string, string> = {
    'PENDING_VISIT': 'text-orange-400 bg-orange-400/10 ring-orange-400/20',
    'QUOTE_SENT': 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
    'QUOTE_ACCEPTED': 'text-indigo-400 bg-indigo-400/10 ring-indigo-400/20',
    'IN_PROGRESS': 'text-teal-400 bg-teal-400/10 ring-teal-400/20',
    'FINALIZED': 'text-green-400 bg-green-400/10 ring-green-400/20',
    'CLOSED_PAID': 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20',
    'CANCELED': 'text-red-400 bg-red-400/10 ring-red-400/20'
  }
  return map[status] || 'text-gray-400 bg-gray-400/10 ring-gray-400/20'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'PENDING_VISIT': 'Pending Visit',
    'QUOTE_SENT': 'Quote Sent',
    'QUOTE_ACCEPTED': 'Quote Accepted',
    'IN_PROGRESS': 'In Progress',
    'FINALIZED': 'Finalized',
    'CLOSED_PAID': 'Closed & Paid',
    'CANCELED': 'Canceled'
  }
  return map[status] || status
}
</script>

<template>
  <div class="h-full flex flex-col relative max-w-5xl mx-auto text-white">
    
    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-1">Jobs</h1>
        <p class="text-gray-400 text-sm">Manage and track all your projects</p>
      </div>
      <UButton icon="i-heroicons-adjustments-horizontal" bg="gray" variant="ghost" class="text-gray-300 ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800">
        Advanced Filters
      </UButton>
    </div>

    <div class="mb-6">
      <UInput
        v-model="searchQuery"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search by client name or address..."
        size="lg"
        :ui="{ root: 'w-full', base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500 ring-1 ring-gray-800 focus:ring-green-500' }"
      />
    </div>

    <div class="flex flex-wrap gap-3 mb-8">
      <button
        v-for="filter in filters"
        :key="filter.label"
        @click="activeFilter = filter.label"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1',
          activeFilter === filter.label 
            ? 'bg-green-600 text-white ring-green-600' 
            : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800'
        ]"
      >
        <span>{{ filter.label }}</span>
        <span 
          :class="[
            'px-2 py-0.5 rounded-full text-xs font-medium',
            activeFilter === filter.label ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-300'
          ]"
        >
          {{ filter.count }}
        </span>
      </button>
    </div>

    <div v-if="pending" class="text-center py-10 text-gray-500">Se încarcă...</div>

    <div v-else class="flex flex-col gap-4 pb-24">
      <NuxtLink v-for="job in filteredJobs" :key="job.id" :to="`/jobs/${job.id}`">
      <div 
        class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-5 hover:ring-gray-700 transition-all flex justify-between items-center group"
      >
        <div class="flex flex-col gap-2">
          <h3 class="text-lg font-semibold">{{ job.title }}</h3>
          
          <div class="flex flex-col gap-1.5 mt-1">
            <div class="flex items-center gap-2 text-gray-400 text-sm">
              <UIcon name="i-heroicons-map-pin" class="w-4 h-4 flex-shrink-0" />
              <span>{{ job.address }}</span>
            </div>
            <div class="flex items-center gap-2 text-gray-400 text-sm">
              <UIcon name="i-heroicons-calendar" class="w-4 h-4 flex-shrink-0" />
              <span>{{ new Date(job.createdAt).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col items-end justify-between h-full min-h-[80px]">
          <div class="flex items-center gap-4">
            <span :class="['px-3 py-1 rounded-full text-xs font-medium ring-2 ring-inset', getStatusClasses(job.status)]">
              {{ getStatusLabel(job.status) }}
            </span>
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <NuxtLink :to="`/jobs/${job.id}`">
                </NuxtLink>
            </div>
          </div>
          
          <div class="text-xl font-bold mt-auto">
            <NuxtLink :to="`/clients/${job.client?.id}`" class="flex items-center gap-3 px-2 py-2 hover:bg-gray-800/50 rounded-md transition-colors cursor-pointer w-full text-left">
          <UAvatar
            :src="job.client?.image || undefined"
            class="w-10 h-10"
          />
          <div class="flex flex-col">
            <h3 class="text-sm font-medium">{{ job.client?.name }}</h3>
            <p class="text-xs text-gray-500">{{ job.client?.email }}</p> 
          </div>
      </NuxtLink>
          </div>
        </div>
      </div>
    </NuxtLink>
      <div v-if="filteredJobs.length === 0" class="text-center py-10 text-gray-500">
        Nu s-au găsit lucrări conform filtrelor.
      </div>
    </div>

    <NuxtLink to="/jobs/new" class="fixed bottom-8 right-8 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg shadow-green-500/20 transition-transform hover:scale-105 flex items-center justify-center">
      <UIcon name="i-heroicons-plus" class="w-8 h-8" />
    </NuxtLink>
    
  </div>
</template>