<script setup lang="ts">
import { watch } from 'vue'

definePageMeta({
  middleware: ['no-client'],
})

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

type WorkerStatus = 'available' | 'on_job' | 'off_duty'

interface Worker {
  id: string
  name: string
  email: string
  phone?: string | null
  image?: string | null
  role: string
  skills: string[]
  teams: string[]
  rating: number
  status: 'available' | 'on_job' | 'off_duty'
  completedJobs: number
  activeJobs: number
  lastActive: string
}

interface WorkerDetail extends Worker {
  jobHistory: Array<{
    id: number
    title: string
    status: string
    client?: string
    value: number
    updatedAt: string
    rating: number
  }>
}

interface Team {
  id: string
  name: string
  color: string
  lead: string
  members: number
  activeJobs: number
  completed: number
}

// Mock workers when API returns empty (for demo)
const MOCK_WORKERS: Worker[] = [
  { id: 'm1', name: 'John Martinez', email: 'john.m@company.com', phone: '+1 (555) 111-2222', role: 'Lead Carpenter', skills: ['Carpentry', 'Framing', 'Cabinet Making'], teams: ['Construction A', 'Finishing Team'], rating: 4.8, status: 'on_job', completedJobs: 127, activeJobs: 2, lastActive: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
  { id: 'm2', name: 'Sarah Chen', email: 'sarah.c@company.com', role: 'Electrician', skills: ['Electrical', 'Wiring'], teams: ['Electrical Team'], rating: 4.9, status: 'available', completedJobs: 94, activeJobs: 0, lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: 'm3', name: 'Mike Thompson', email: 'mike.t@company.com', role: 'Plumber', skills: ['Plumbing', 'Pipe Fitting'], teams: ['Plumbing Team'], rating: 4.6, status: 'on_job', completedJobs: 82, activeJobs: 1, lastActive: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  { id: 'm4', name: 'Emily Rodriguez', email: 'emily.r@company.com', role: 'Painter', skills: ['Painting', 'Surface Prep'], teams: ['Finishing Team'], rating: 4.7, status: 'available', completedJobs: 56, activeJobs: 0, lastActive: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: 'm5', name: 'David Kim', email: 'david.k@company.com', phone: '+1 (555) 555-6666', role: 'Project Manager', skills: ['Project Management', 'Scheduling', 'Client Relations'], teams: ['Construction A', 'Management'], rating: 4.8, status: 'available', completedJobs: 64, activeJobs: 2, lastActive: new Date(Date.now() - 1 * 3600 * 1000).toISOString() },
  { id: 'm6', name: 'Lisa Anderson', email: 'lisa.a@company.com', role: 'General Contractor', skills: ['General Construction', 'Supervision', 'Quality Control'], teams: ['Construction A'], rating: 4.6, status: 'off_duty', completedJobs: 73, activeJobs: 0, lastActive: new Date(Date.now() - 3 * 86400 * 1000).toISOString() }
]

const MOCK_TEAMS: Team[] = [
  { id: 't1', name: 'Construction A', color: 'blue', lead: 'David Kim', members: 8, activeJobs: 3, completed: 45 },
  { id: 't2', name: 'Electrical Team', color: 'orange', lead: 'Sarah Chen', members: 8, activeJobs: 1, completed: 32 },
  { id: 't3', name: 'Finishing Team', color: 'purple', lead: 'Emily Rodriguez', members: 8, activeJobs: 2, completed: 28 },
  { id: 't4', name: 'Plumbing Team', color: 'green', lead: 'Mike Thompson', members: 8, activeJobs: 1, completed: 19 }
]

const MOCK_MESSAGES = [
  { id: '1', content: 'John Martinez joined the team on Jan 15, 2024', senderId: 'system', isSystem: true, createdAt: '2024-01-15T00:00:00Z' },
  { id: '2', content: 'Hey, I finished the framing work at Smith Residence. Ready for inspection.', senderId: 'worker', isOutgoing: false, createdAt: '2025-11-06T14:30:00Z' },
  { id: '3', content: "Great work! I'll come by tomorrow morning to check it out.", senderId: 'manager', isOutgoing: true, createdAt: '2025-11-06T15:15:00Z' },
  { id: '4', content: "Sounds good. Also, we might need more 2x4s for the Martinez project.", senderId: 'worker', isOutgoing: false, createdAt: '2025-11-07T09:00:00Z' }
]

const viewMode = ref<'workers' | 'teams'>('workers')
const searchQuery = ref('')
const statusFilter = ref<WorkerStatus | 'all'>('all')
const selectedWorkerId = ref<string | null>(null)
const selectedTeamId = ref<string | null>(null)
const activeTab = ref<'messages' | 'jobs'>('messages')
const chatInput = ref('')
const showAssignModal = ref(false)
const showCreateTeamModal = ref(false)
const teamMessages = ref<Array<{ id: string; content: string; senderId: string; isOutgoing: boolean; createdAt: string }>>([
  { id: 'tm1', content: 'Construction A team: Johnson Plaza electrical work starting Monday.', senderId: 'manager', isOutgoing: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'tm2', content: "We'll have the materials ready. Finishing crew standing by.", senderId: 'team', isOutgoing: false, createdAt: new Date(Date.now() - 86000000).toISOString() }
])

const { data: workersRaw, pending: workersPending } = await useFetch<Worker[]>(`${serverUrl}/api/workers`, { credentials: 'include' })
const workers = computed(() => {
  const list = workersRaw.value ?? []
  if (list.length === 0) return MOCK_WORKERS
  return list
})

const { data: teamsFromApi, refresh: refreshTeams } = await useFetch<Team[]>(`${serverUrl}/api/teams`, {
  credentials: 'include',
})

const workerDetail = ref<WorkerDetail | null>(null)
const workerDetailPending = ref(false)

/** Persisted teams from API; fallback to demo data only if the request did not return an array. */
const teams = computed(() => {
  const api = teamsFromApi.value
  if (Array.isArray(api)) return api
  return MOCK_TEAMS
})

// Auto-select first worker when list loads
watch(workers, (list) => {
  const first = list[0]
  if (first && !selectedWorkerId.value) {
    loadWorkerDetail(first.id)
  }
}, { immediate: true })

const filteredWorkers = computed(() => {
  let list = workers.value
  const q = searchQuery.value.toLowerCase().trim()
  if (q) list = list.filter(w => w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || w.email?.toLowerCase().includes(q))
  if (statusFilter.value === 'available') list = list.filter(w => w.status === 'available')
  else if (statusFilter.value === 'on_job') list = list.filter(w => w.status === 'on_job')
  else if (statusFilter.value === 'off_duty') list = list.filter(w => w.status !== 'available' && w.status !== 'on_job')
  return list
})

const selectedWorker = computed(() => {
  if (!selectedWorkerId.value) return null
  return workers.value.find(w => w.id === selectedWorkerId.value) ?? null
})

const selectedTeam = computed(() => {
  if (!selectedTeamId.value) return null
  return teams.value.find(t => t.id === selectedTeamId.value) ?? null
})

const messages = computed(() => {
  const id = selectedWorkerId.value
  if (!id) return []
  if (!messagesByWorker.value[id]) {
    messagesByWorker.value[id] = [...MOCK_MESSAGES]
  }
  return messagesByWorker.value[id] ?? []
})

// Messages per worker (key = workerId)
const messagesByWorker = ref<Record<string, typeof MOCK_MESSAGES>>({})

async function loadWorkerDetail(id: string) {
  selectedWorkerId.value = id
  workerDetailPending.value = true
  try {
    const res = await $fetch<WorkerDetail>(`${serverUrl}/api/workers/${id}`, { credentials: 'include' })
    workerDetail.value = res
  } catch {
    workerDetail.value = selectedWorker.value ? { ...selectedWorker.value, jobHistory: [] } : null
  } finally {
    workerDetailPending.value = false
  }
}

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'Just now'
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`
  return d.toLocaleDateString()
}

function formatMessageTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function getStatusColor(status: string) {
  if (status === 'available') return 'bg-[var(--penta-accent)]'
  if (status === 'on_job') return 'bg-blue-500'
  if (status === 'off_duty') return 'bg-gray-500'
  return 'bg-gray-500'
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getTeamColor(team: Team) {
  const map: Record<string, string> = { blue: 'bg-blue-500/20 text-blue-400', orange: 'bg-orange-500/20 text-orange-400', purple: 'bg-purple-500/20 text-purple-400', green: 'penta-bg-subtle penta-text-accent' }
  return map[team.color] || 'bg-gray-500/20 text-gray-400'
}

function sendMessage() {
  const content = chatInput.value.trim()
  if (!content) return
  const id = selectedWorkerId.value
  if (!id) return
  if (!messagesByWorker.value[id]) messagesByWorker.value[id] = [...MOCK_MESSAGES]
  messagesByWorker.value[id] = [
    ...messagesByWorker.value[id],
    { id: `msg-${Date.now()}`, content, senderId: 'manager', isOutgoing: true, createdAt: new Date().toISOString() } as any
  ]
  chatInput.value = ''
}

const teamChatInput = ref('')
const newTeamName = ref('')
const newTeamLeadId = ref<string | undefined>(undefined)
const creatingTeam = ref(false)

async function createTeamSubmit() {
  const name = newTeamName.value.trim()
  if (!name) return
  creatingTeam.value = true
  try {
    const leadId = newTeamLeadId.value
    await $fetch(`${serverUrl}/api/teams`, {
      method: 'POST',
      body: {
        name,
        color: 'blue',
        leadId: leadId || undefined,
        memberIds: leadId ? [leadId] : [],
      },
      credentials: 'include',
    })
    newTeamName.value = ''
    newTeamLeadId.value = undefined
    showCreateTeamModal.value = false
    await refreshTeams()
  } catch (e: any) {
    alert(e?.data?.error || 'Could not create team.')
  } finally {
    creatingTeam.value = false
  }
}

function sendTeamMessage() {
  const content = teamChatInput.value.trim()
  if (!content) return
  teamMessages.value.push({
    id: `tm-${Date.now()}`,
    content,
    senderId: 'manager',
    isOutgoing: true,
    createdAt: new Date().toISOString()
  })
  teamChatInput.value = ''
}

const jobHistory = computed(() => workerDetail.value?.jobHistory ?? [])
const currentAssignments = computed(() => jobHistory.value.filter(j => ['IN_PROGRESS', 'QUOTE_ACCEPTED', 'READY_FOR_REVIEW'].includes(j.status)))
const completedJobHistory = computed(() => jobHistory.value.filter(j => ['FINALIZED', 'CLOSED_PAID'].includes(j.status)))

function getJobStatusClass(status: string) {
  if (['IN_PROGRESS', 'QUOTE_ACCEPTED', 'READY_FOR_REVIEW'].includes(status)) return 'text-teal-400 bg-teal-400/10 ring-teal-400/20'
  if (['FINALIZED', 'CLOSED_PAID'].includes(status)) return 'penta-status-ok'
  return 'text-gray-400 bg-gray-400/10 ring-gray-400/20'
}
</script>

<template>
  <div class="h-full flex flex-col text-white  mx-auto">

    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-1">Team</h1>
        <p class="text-gray-400 text-sm">Manage workers and teams</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', viewMode === 'workers' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
          @click="viewMode = 'workers'"
        >
          <UIcon name="i-heroicons-user" class="w-5 h-5" />
          Workers
        </button>
        <button
          type="button"
          :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', viewMode === 'teams' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
          @click="viewMode = 'teams'"
        >
          <UIcon name="i-heroicons-user-group" class="w-5 h-5" />
          Teams
        </button>
      </div>
    </div>

    <!-- Workers View -->
    <div v-if="viewMode === 'workers'" class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
      <!-- Left Panel (same style as Jobs list) -->
      <div class="flex flex-col gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search workers..."
          size="lg"
          :ui="{ root: 'w-full', base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500 ring-1 ring-gray-800 focus:ring-[var(--penta-accent)]' }"
        />
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'All Workers', value: 'all' },
            { label: 'Available', value: 'available' },
            { label: 'On Job', value: 'on_job' },
            { label: 'Off Duty', value: 'off_duty' }
          ]"
          placeholder="All Workers"
          class="w-full"
          :ui="{ base: 'bg-[#18181b] ring-1 ring-gray-800' }"
        />
        <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
          <button
            v-for="worker in filteredWorkers"
            :key="worker.id"
            type="button"
            :class="[
              'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ring-1',
              selectedWorkerId === worker.id
                ? 'bg-[#121212] penta-list-selected hover:ring-[color-mix(in_srgb,var(--penta-accent)_60%,transparent)]'
                : 'bg-[#121212] ring-gray-800/60 hover:ring-gray-700'
            ]"
            @click="loadWorkerDetail(worker.id)"
          >
            <div class="relative flex-shrink-0">
              <div class="w-12 h-12 rounded-full penta-avatar-subtle flex items-center justify-center penta-text-accent font-semibold text-sm">
                {{ getInitials(worker.name) }}
              </div>
              <span :class="['absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-[#121212]', getStatusColor(worker.status)]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate text-white">{{ worker.name }}</div>
              <div class="text-sm text-gray-500 truncate">{{ worker.role }}</div>
              <div class="flex items-center gap-3 text-xs text-gray-400 mt-1">
                <div class="flex items-center gap-0.5">
                  <UIcon name="i-heroicons-star-16-solid" class="w-4 h-4 text-yellow-400"/>
                  <span> {{ worker.rating }}</span>
                </div>
                <div class="flex items-center gap-0.5">
                  <UIcon name="i-heroicons-briefcase-16-solid" class="w-4 h-4 text-gray-400"/>
                  <span>{{ worker.completedJobs }} jobs</span>
                </div>
                <div class="flex items-center gap-0.5">
                  <UIcon name="i-heroicons-clock-16-solid" class="w-4 h-4 text-gray-400"/>
                  <span>{{ formatTimeAgo(worker.lastActive) }}</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Right Panel - Worker Detail -->
      <div class="lg:col-span-2 flex flex-col min-h-0">
        <div v-if="!selectedWorkerId" class="flex-1 flex flex-col items-center justify-center text-gray-500 py-20">
          <div class="w-20 h-20 rounded-xl bg-[#18181b] ring-1 ring-gray-800 flex items-center justify-center mb-4">
            <UIcon name="i-heroicons-user" class="w-10 h-10 text-gray-500" />
          </div>
          <p class="text-lg">Select a worker to view details</p>
        </div>

        <template v-else>
          <div v-if="workerDetailPending" class="flex-1 flex items-center justify-center">
            <span class="text-gray-500">Loading...</span>
          </div>

          <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <!-- Header (dashboard-style card) -->
            <div class="flex items-start justify-between gap-6 mb-6 p-6 rounded-xl bg-[#18181b] ring-1 ring-gray-800">
              <div class="flex items-center gap-5">
                <div class="relative flex-shrink-0">
                  <div class="w-20 h-20 rounded-full penta-avatar-subtle flex items-center justify-center penta-text-accent font-bold text-2xl">
                    {{ getInitials(workerDetail?.name ?? '') }}
                  </div>
                  <span :class="['absolute bottom-0 right-0 w-5 h-5 rounded-full ring-2 ring-[#18181b]', getStatusColor(workerDetail?.status ?? 'available')]" />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-white">{{ workerDetail?.name }}</h2>
                  <p class="text-gray-400">{{ workerDetail?.role }}</p>
                  <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                    <span class="flex items-center gap-1.5">
                      <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                      {{ workerDetail?.email }}
                    </span>
                    <span v-if="workerDetail?.phone" class="flex items-center gap-1.5">
                      <UIcon name="i-heroicons-phone" class="w-4 h-4 text-gray-400" />
                      {{ workerDetail.phone }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <UButton size="sm" class="penta-btn-primary">
                  <UIcon name="i-heroicons-briefcase" class="w-4 h-4 mr-2" />
                  Assign Job
                </UButton>
                <UDropdownMenu
                  :items="[
                    [{ label: 'Edit Profile', icon: 'i-heroicons-pencil' }],
                    [{ label: 'View Schedule', icon: 'i-heroicons-calendar' }],
                    [{ label: 'Performance Review', icon: 'i-heroicons-chart-bar' }]
                  ]"
                >
                  <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="sm" class="text-gray-300 ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800" />
                </UDropdownMenu>
              </div>
            </div>

            <!-- Stats (dashboard-style cards) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                <span :class="['inline-flex px-3 py-1 rounded-full text-xs font-medium ring-2 ring-inset', workerDetail?.status === 'on_job' ? 'text-teal-400 bg-teal-400/10 ring-teal-400/20' : workerDetail?.status === 'off_duty' ? 'text-gray-400 bg-gray-400/10 ring-gray-400/20' : 'penta-status-ok']">
                  {{ workerDetail?.status === 'on_job' ? 'On Job' : workerDetail?.status === 'off_duty' ? 'Off Duty' : 'Available' }}
                </span>
              </div>
              <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-1">
                  <UIcon name="i-heroicons-star" class="w-5 h-5 text-amber-400" />
                  <span class="text-2xl font-bold">{{ workerDetail?.rating ?? 0 }}</span>
                </div>
                <div class="text-gray-500 text-sm">Rating</div>
              </div>
              <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-1">
                  <UIcon name="i-heroicons-check-circle" class="w-5 h-5 penta-text-accent" />
                  <span class="text-2xl font-bold">{{ workerDetail?.completedJobs ?? 0 }}</span>
                </div>
                <div class="text-gray-500 text-sm">Completed Jobs</div>
              </div>
              <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-1">
                  <UIcon name="i-heroicons-clock" class="w-5 h-5 text-blue-400" />
                  <span class="text-2xl font-bold">{{ workerDetail?.activeJobs ?? 0 }}</span>
                </div>
                <div class="text-gray-500 text-sm">Active Jobs</div>
              </div>
            </div>

            <!-- Skills & Teams (badges like Jobs status) -->
            <div class="flex flex-wrap gap-2 mb-6">
              <span v-for="skill in (workerDetail?.skills ?? [])" :key="skill" class="px-3 py-1 rounded-full text-sm font-medium text-purple-400 bg-purple-400/10 ring-2 ring-inset ring-purple-400/20">
                {{ skill }}
              </span>
              <span v-for="team in (workerDetail?.teams ?? [])" :key="team" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-indigo-400 bg-indigo-400/10 ring-2 ring-inset ring-indigo-400/20">
                <UIcon name="i-heroicons-user" class="w-3.5 h-3.5" />
                {{ team }}
              </span>
            </div>

            <!-- Tabs (same pill style as Jobs filters) -->
            <div class="flex gap-2 mb-4">
              <button
                type="button"
                :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'messages' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
                @click="activeTab = 'messages'"
              >
                <UIcon name="i-heroicons-chat-bubble-left-right" class="w-4 h-4" />
                Messages
              </button>
              <button
                type="button"
                :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'jobs' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
                @click="activeTab = 'jobs'"
              >
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
                Job History
              </button>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
              <!-- Messages Tab -->
              <div v-if="activeTab === 'messages'" class="flex-1 flex flex-col min-h-[280px] overflow-hidden">
                <div class="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 overscroll-contain">
                  <div
                    v-for="msg in messages"
                    :key="msg.id"
                    :class="[
                      (msg as any).isSystem ? 'text-center text-gray-500 text-xs py-2' : 'flex',
                      (msg as any).isOutgoing ? 'justify-end' : 'justify-start'
                    ]"
                  >
                    <div v-if="!(msg as any).isSystem" :class="[(msg as any).isOutgoing ? 'penta-chat-out' : 'bg-[#121212] text-gray-100 ring-1 ring-gray-800', 'max-w-[80%] rounded-xl px-4 py-3']">
                      <div class="text-sm leading-relaxed">{{ (msg as any).content }}</div>
                      <div class="text-xs opacity-75 mt-1.5">{{ formatMessageTime((msg as any).createdAt) }}</div>
                    </div>
                    <div v-else class="text-xs px-3 py-1.5 text-gray-500">{{ (msg as any).content }}</div>
                  </div>
                </div>
                <form
                  class="flex items-center gap-2 flex-shrink-0 pt-3 border-t border-gray-800"
                  @submit.prevent="sendMessage"
                >
                  <UButton type="button" icon="i-heroicons-paper-clip" variant="ghost" size="sm" class="text-gray-400 flex-shrink-0" />
                  <UInput
                    v-model="chatInput"
                    placeholder="Type a message..."
                    :ui="{ root: 'flex-1 min-w-0', base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 rounded-lg focus:ring-[var(--penta-accent)]' }"
                    @keydown.enter.prevent="sendMessage"
                  />
                  <UButton type="button" icon="i-heroicons-microphone" variant="ghost" size="sm" class="text-gray-400 flex-shrink-0" />
                  <UButton type="submit" size="sm" class="penta-btn-primary flex-shrink-0">
                    <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                  </UButton>
                </form>
              </div>

              <!-- Job History Tab -->
              <div v-else class="flex-1 overflow-y-auto">
                <div class="space-y-6">
                  <!-- Current Assignments -->
                  <div v-if="currentAssignments.length > 0">
                    <h3 class="text-white mb-3 flex items-center gap-2 text-sm font-medium">
                      <UIcon name="i-heroicons-clock" class="w-4 h-4 text-teal-400" />
                      Current Assignments
                    </h3>
                    <div class="space-y-3">
                      <NuxtLink
                        v-for="job in currentAssignments"
                        :key="job.id"
                        :to="`/jobs/${job.id}`"
                        class="block p-4 rounded-xl bg-[#121212] ring-1 ring-gray-800/60 hover:ring-gray-700 transition-all"
                      >
                        <div class="flex items-center justify-between">
                          <div>
                            <h4 class="font-semibold text-white">{{ job.title }}</h4>
                            <p class="text-sm text-gray-500 mt-0.5">{{ job.client }}</p>
                          </div>
                          <span class="px-3 py-1 rounded-full text-xs font-medium text-teal-400 bg-teal-400/10 ring-2 ring-inset ring-teal-400/20">
                            In Progress
                          </span>
                        </div>
                      </NuxtLink>
                    </div>
                  </div>

                  <!-- Job History -->
                  <div>
                    <h3 class="text-white mb-3 flex items-center gap-2 text-sm font-medium">
                      <UIcon name="i-heroicons-check-circle" class="w-4 h-4 penta-text-accent" />
                      Job History
                    </h3>
                    <div class="space-y-3">
                      <NuxtLink
                        v-for="job in completedJobHistory"
                        :key="job.id"
                        :to="`/jobs/${job.id}`"
                        class="block p-4 rounded-xl bg-[#121212] ring-1 ring-gray-800/60 hover:ring-gray-700 transition-all"
                      >
                        <div class="flex items-start justify-between gap-4">
                          <div class="flex-1">
                            <h4 class="font-semibold text-white">{{ job.title }}</h4>
                            <div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
                              <span class="flex items-center gap-1"><UIcon name="i-heroicons-user" class="w-4 h-4" />{{ job.client }}</span>
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <span v-if="job.rating" class="flex items-center gap-1 text-amber-400/90 text-sm">⭐ {{ job.rating }}</span>
                            <span class="px-3 py-1 rounded-full text-xs font-medium penta-status-ok">Completed</span>
                          </div>
                        </div>
                        <div v-if="job.value" class="mt-2 text-sm text-gray-400">${{ job.value.toLocaleString() }}</div>
                      </NuxtLink>
                      <div v-if="completedJobHistory.length === 0 && currentAssignments.length === 0" class="text-center py-12 text-gray-500 rounded-xl bg-[#121212] ring-1 ring-gray-800/60">
                        <UIcon name="i-heroicons-briefcase" class="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No job history</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Teams View -->
    <div v-else class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
      <div class="flex flex-col gap-4">
        <UButton class="w-full penta-btn-primary rounded-xl py-3" @click="showCreateTeamModal = true">
          <UIcon name="i-heroicons-plus" class="w-5 h-5 mr-2" />
          Create Team
        </UButton>
        <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
          <button
            v-for="team in teams"
            :key="team.id"
            type="button"
            :class="[
              'w-full p-4 rounded-xl text-left transition-all ring-1',
              selectedTeamId === team.id
                ? 'bg-[#121212] penta-list-selected'
                : 'bg-[#121212] ring-gray-800/60 hover:ring-gray-700'
            ]"
            @click="selectedTeamId = team.id"
          >
            <div class="flex items-start gap-4">
              <div :class="['w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', getTeamColor(team)]">
                <UIcon name="i-heroicons-user-group" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-white">{{ team.name }}</div>
                <div class="text-sm text-gray-500">Led by {{ team.lead }}</div>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span class="flex items-center gap-1"><UIcon name="i-heroicons-users" class="w-4 h-4" />{{ team.members }}</span>
                  <span class="flex items-center gap-1"><UIcon name="i-heroicons-clipboard-document" class="w-4 h-4" />{{ team.activeJobs }}</span>
                </div>
                <span class="inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium penta-status-ok">{{ team.completed }} completed</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Team detail + Chat -->
      <div class="lg:col-span-2 flex flex-col min-h-0">
        <template v-if="selectedTeam">
          <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div class="flex items-center gap-4 mb-6 p-6 rounded-xl bg-[#18181b] ring-1 ring-gray-800">
              <div :class="['w-16 h-16 rounded-xl flex items-center justify-center', getTeamColor(selectedTeam)]">
                <UIcon name="i-heroicons-user-group" class="w-8 h-8" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-white">{{ selectedTeam.name }}</h2>
                <p class="text-gray-500">Led by {{ selectedTeam.lead }}</p>
              </div>
            </div>
            <div class="flex-1 flex flex-col min-h-[300px] bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5 overflow-hidden">
              <h3 class="text-sm font-medium text-gray-400 mb-4">Team Chat</h3>
              <div class="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
                <div
                  v-for="msg in teamMessages"
                  :key="msg.id"
                  :class="['flex', msg.isOutgoing ? 'justify-end' : 'justify-start']"
                >
                  <div :class="[msg.isOutgoing ? 'penta-chat-out' : 'bg-[#121212] text-gray-100 ring-1 ring-gray-800', 'max-w-[85%] rounded-xl px-4 py-2.5']">
                    <div class="text-sm leading-relaxed">{{ msg.content }}</div>
                    <div class="text-xs opacity-70 mt-1">{{ formatMessageTime(msg.createdAt) }}</div>
                  </div>
                </div>
              </div>
              <form class="flex gap-2 flex-shrink-0 pt-2 border-t border-gray-800" @submit.prevent="sendTeamMessage">
                <UButton type="button" icon="i-heroicons-paper-clip" variant="ghost" size="sm" class="text-gray-400 flex-shrink-0" />
                <UInput
                  v-model="teamChatInput"
                  placeholder="Message the team..."
                  :ui="{ root: 'flex-1 min-w-0', base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 rounded-lg focus:ring-[var(--penta-accent)]' }"
                  @keydown.enter.prevent="sendTeamMessage"
                />
                <UButton type="submit" size="sm" class="penta-btn-primary flex-shrink-0">
                  <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                </UButton>
              </form>
            </div>
          </div>
        </template>
        <div v-else class="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div class="w-24 h-24 rounded-xl bg-[#18181b] ring-1 ring-gray-800 flex items-center justify-center mb-6">
            <UIcon name="i-heroicons-user-group" class="w-12 h-12 text-gray-500" />
          </div>
          <h3 class="text-xl font-bold text-white mb-2">Teams Overview</h3>
          <p class="text-gray-500 mb-6 max-w-md">Select a team to view details and send messages</p>
          <UButton class="penta-btn-primary" @click="showCreateTeamModal = true">
            <UIcon name="i-heroicons-plus" class="w-5 h-5 mr-2" />
            Create New Team
          </UButton>
        </div>
      </div>
    </div>

    <!-- Create Team Modal -->
    <UModal v-model:open="showCreateTeamModal" title="Create New Team">
      <template #body>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-2">Team Name</label>
            <UInput v-model="newTeamName" placeholder="e.g. Construction B" class="w-full" :ui="{ base: 'bg-[#18181b] ring-1 ring-gray-800 focus:ring-[var(--penta-accent)]' }" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-2">Team Lead</label>
            <USelect
              v-model="newTeamLeadId"
              :items="workers.map(w => ({ label: w.name, value: w.id }))"
              placeholder="Select team lead"
              class="w-full"
              :ui="{ base: 'bg-[#18181b] ring-1 ring-gray-800' }"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="showCreateTeamModal = false">Cancel</UButton>
        <UButton class="penta-btn-primary" :loading="creatingTeam" :disabled="!newTeamName.trim()" @click="createTeamSubmit">
          Create Team
        </UButton>
      </template>
    </UModal>
  </div>
</template>
