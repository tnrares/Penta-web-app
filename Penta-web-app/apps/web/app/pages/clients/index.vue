<script setup lang="ts">
const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'
const wsUrl = serverUrl.replace(/^http/, 'ws')

interface ClientSummary {
  id: string
  name: string
  email: string
  image?: string | null
  phone?: string | null
  createdAt: string
  totalJobs: number
  totalPaid: number
  outstanding: number
  status: 'Paid' | 'Pending' | 'Overdue'
}

interface ClientDetail extends ClientSummary {
  companyName?: string | null
  jobs: { id: number; title: string; address?: string; status: string; createdAt: string; quoteTotal?: number; invoice?: unknown }[]
}

interface Conversation {
  id: string
  clientId: string
  managerId: string
  client: { id: string; name: string; email: string; image?: string | null; phone?: string | null }
  manager: { id: string; name: string; email: string; image?: string | null }
  lastMessage: { id: string; content: string; senderId: string; createdAt: string } | null
  updatedAt: string
}

interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  sender: { id: string; name: string }
}

const searchQuery = ref('')
const selectedClientId = ref<string | null>(null)
const selectedConversationId = ref<string | null>(null)
const activeTab = ref<'communication' | 'jobs' | 'invoices'>('communication')

const { data: clients, pending: clientsPending, refresh: refreshClients } = await useFetch<ClientSummary[]>(`${serverUrl}/api/clients`, { credentials: 'include' })
const clientDetail = ref<ClientDetail | null>(null)
const clientDetailPending = ref(false)

const { data: conversations, refresh: refreshConversations } = await useFetch<Conversation[]>(`${serverUrl}/api/chat/conversations`, { credentials: 'include' })

const { $authClient } = useNuxtApp()
const session = $authClient.useSession()
type SessionUser = { role?: string }
const userRole = computed<string>(() => {
  const user = session?.value?.data?.user
  return (user as SessionUser)?.role ?? 'CLIENT'
})
const isManager = computed(() => userRole.value === 'MANAGER')
const isClient = computed(() => userRole.value === 'CLIENT')

const filteredClients = computed(() => {
  if (!clients.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return clients.value
  return clients.value.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)))
})

const filteredConversations = computed(() => {
  if (!conversations.value) return []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return conversations.value
  return conversations.value.filter(c =>
    (c.manager?.name && c.manager.name.toLowerCase().includes(q)) ||
    (c.manager?.email && c.manager.email.toLowerCase().includes(q))
  )
})

const selectedClient = computed(() => {
  if (!selectedClientId.value || !clients.value) return null
  return clients.value.find(c => c.id === selectedClientId.value) ?? null
})

const conversationForClient = computed(() => {
  if (!selectedClientId.value || !conversations.value) return null
  return conversations.value.find(c => c.clientId === selectedClientId.value) ?? null
})

const conversationForSelected = computed(() => {
  if (!conversations.value) return null
  if (isManager.value) return conversationForClient.value
  return conversations.value.find(c => c.id === selectedConversationId.value) ?? null
})

const hasSelection = computed(() => isManager.value ? !!selectedClientId.value : !!selectedConversationId.value)

const rightPanelParty = computed(() => {
  if (isManager.value && clientDetail.value) return { name: clientDetail.value.name, email: clientDetail.value.email, image: clientDetail.value.image, phone: clientDetail.value.phone }
  const conv = conversationForSelected.value
  if (conv?.manager) return { name: conv.manager.name, email: conv.manager.email, image: conv.manager.image, phone: null }
  return null
})

const messages = ref<ChatMessage[]>([])
const messagesPending = ref(false)
const chatInput = ref('')
const ws = ref<WebSocket | null>(null)
const currentUserId = computed(() => (session?.value?.data?.user as { id: string })?.id ?? '')

async function loadClientDetail(id: string) {
  selectedClientId.value = id
  clientDetailPending.value = true
  try {
    const res = await $fetch<ClientDetail>(`${serverUrl}/api/clients/${id}`, { credentials: 'include' })
    clientDetail.value = res
  } catch {
    clientDetail.value = null
  } finally {
    clientDetailPending.value = false
  }
}

async function loadMessages(conversationId: string) {
  messagesPending.value = true
  try {
    const list = await $fetch<ChatMessage[]>(`${serverUrl}/api/chat/messages?conversationId=${conversationId}`, { credentials: 'include' })
    messages.value = list
  } catch {
    messages.value = []
  } finally {
    messagesPending.value = false
  }
}

function connectWs(conversationId: string) {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  const url = `${wsUrl}/api/chat/ws?conversationId=${encodeURIComponent(conversationId)}`
  const socket = new WebSocket(url)
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string)
      if (data.type === 'new_message' && data.message) {
        messages.value = [...messages.value, data.message as ChatMessage]
      }
    } catch (_) {}
  }
  socket.onclose = () => { ws.value = null }
  ws.value = socket
}

watch(conversationForSelected, (conv) => {
  if (conv) {
    loadMessages(conv.id)
    connectWs(conv.id)
  } else {
    messages.value = []
    if (ws.value) { ws.value.close(); ws.value = null }
  }
}, { immediate: true })

watch(selectedClientId, () => {
  const conv = conversationForClient.value
  if (conv) {
    loadMessages(conv.id)
    connectWs(conv.id)
  }
})

function selectConversation(conv: Conversation) {
  selectedConversationId.value = conv.id
}

onUnmounted(() => {
  if (ws.value) ws.value.close()
})

async function sendMessage() {
  const content = chatInput.value.trim()
  if (!content) return
  const conv = conversationForSelected.value
  const mid = currentUserId.value
  if (!mid) return

  const socket = ws.value
  const canSendWs = socket && socket.readyState === WebSocket.OPEN && conv
  if (canSendWs) {
    socket.send(JSON.stringify({ type: 'message', content }))
    chatInput.value = ''
    return
  }

  try {
    if (conv) {
      await $fetch(`${serverUrl}/api/chat/messages`, {
        method: 'POST',
        body: { conversationId: conv.id, content },
        credentials: 'include'
      })
      chatInput.value = ''
      await loadMessages(conv.id)
      return
    }
    if (isManager.value && selectedClientId.value) {
      await $fetch(`${serverUrl}/api/chat/messages`, {
        method: 'POST',
        body: { clientId: selectedClientId.value, managerId: mid, content },
        credentials: 'include'
      })
      chatInput.value = ''
      await refreshConversations()
      const newConv = conversations.value?.find(x => x.clientId === selectedClientId.value)
      if (newConv) {
        await loadMessages(newConv.id)
        connectWs(newConv.id)
      }
      return
    }
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    alert(err?.data?.error || 'Failed to send')
  }
}

function getStatusClass(s: string) {
  if (s === 'Paid') return 'penta-status-ok'
  if (s === 'Overdue') return 'text-red-400 bg-red-400/10 ring-red-400/20'
  return 'text-amber-400 bg-amber-400/10 ring-amber-400/20'
}

function getJobStatusClass(s: string) {
  const map: Record<string, string> = {
    'PENDING_VISIT': 'text-orange-400 bg-orange-400/10 ring-orange-400/20',
    'QUOTE_SENT': 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
    'QUOTE_ACCEPTED': 'text-indigo-400 bg-indigo-400/10 ring-indigo-400/20',
    'IN_PROGRESS': 'text-teal-400 bg-teal-400/10 ring-teal-400/20',
    'READY_FOR_REVIEW': 'text-cyan-400 bg-cyan-400/10 ring-cyan-400/20',
    'FINALIZED': 'penta-status-ok',
    'CLOSED_PAID': 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20',
    'CANCELED': 'text-red-400 bg-red-400/10 ring-red-400/20'
  }
  return map[s] || 'text-gray-400 bg-gray-400/10 ring-gray-400/20'
}

function getJobStatusLabel(s: string) {
  const map: Record<string, string> = {
    'PENDING_VISIT': 'Pending Visit', 'QUOTE_SENT': 'Quote Sent', 'QUOTE_ACCEPTED': 'Quote Accepted',
    'IN_PROGRESS': 'In Progress', 'READY_FOR_REVIEW': 'Ready for review', 'FINALIZED': 'Finalized', 'CLOSED_PAID': 'Closed & Paid', 'CANCELED': 'Canceled'
  }
  return map[s] || s
}

function lastInteraction(conv: Conversation) {
  const t = conv.lastMessage?.createdAt ?? conv.updatedAt
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days >= 7) return `${Math.floor(days / 7)} week(s) ago`
  if (days >= 1) return `${days} day(s) ago`
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `${hours} hour(s) ago`
  const mins = Math.floor(diff / 60000)
  return mins < 1 ? 'Just now' : `${mins} min ago`
}

function formatDate(d: string) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
</script>

<template>
  <div class="h-full flex flex-col text-white  mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-1">{{ isManager ? 'Clients' : 'Chat' }}</h1>
        <p class="text-gray-400 text-sm">{{ isManager ? 'Manage clients and communication' : 'Chat with your manager' }}</p>
      </div>
    </div>

    <!-- 3-column layout -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
      <!-- Left Panel: list -->
      <div class="flex flex-col gap-4">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          :placeholder="isManager ? 'Search clients...' : 'Search managers...'"
          size="lg"
          :ui="{ root: 'w-full', base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500 ring-1 ring-gray-800 focus:ring-[var(--penta-accent)]' }"
        />

        <!-- Manager: clients list -->
        <template v-if="isManager">
          <div v-if="clientsPending" class="p-4 text-gray-500 text-sm">Loading...</div>
          <div v-else-if="!clients?.length" class="p-4 text-gray-500 text-sm">No clients.</div>
          <div v-else class="flex-1 overflow-y-auto space-y-2 min-h-0">
            <button
              v-for="c in filteredClients"
              :key="c.id"
              type="button"
              :class="[
                'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ring-1',
                selectedClientId === c.id
                  ? 'bg-[#121212] penta-list-selected'
                  : 'bg-[#121212] ring-gray-800/60 hover:ring-gray-700'
              ]"
              @click="loadClientDetail(c.id)"
            >
              <div class="relative flex-shrink-0">
                <UAvatar v-if="c.image" :src="c.image" :alt="c.name" class="w-12 h-12" />
                <div v-else class="w-12 h-12 rounded-full penta-avatar-subtle flex items-center justify-center penta-text-accent font-semibold text-sm">
                  {{ getInitials(c.name) }}
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate text-white">{{ c.name }}</div>
                <div class="text-sm text-gray-500 truncate">{{ c.email }}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span :class="['text-xs px-2 py-0.5 rounded-full ring-2 ring-inset font-medium', getStatusClass(c.status)]">
                    {{ c.status }}
                  </span>
                  <span v-if="conversations?.find(x => x.clientId === c.id)" class="text-xs text-gray-500">
                    {{ lastInteraction(conversations!.find(x => x.clientId === c.id)!) }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </template>

        <!-- Client: conversations list -->
        <template v-else>
          <div v-if="!conversations?.length" class="p-4 text-gray-500 text-sm">No conversations yet.</div>
          <div v-else class="flex-1 overflow-y-auto space-y-2 min-h-0">
            <button
              v-for="conv in filteredConversations"
              :key="conv.id"
              type="button"
              :class="[
                'w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ring-1',
                selectedConversationId === conv.id
                  ? 'bg-[#121212] penta-list-selected'
                  : 'bg-[#121212] ring-gray-800/60 hover:ring-gray-700'
              ]"
              @click="selectConversation(conv)"
            >
              <UAvatar :src="conv.manager?.image || undefined" :alt="conv.manager?.name" class="w-12 h-12 flex-shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate text-white">{{ conv.manager?.name }}</div>
                <div class="text-sm text-gray-500 truncate">{{ conv.manager?.email }}</div>
                <span class="text-xs text-gray-500">{{ lastInteraction(conv) }}</span>
              </div>
            </button>
          </div>
        </template>
      </div>

      <!-- Right Panel: detail -->
      <div class="lg:col-span-2 flex flex-col min-h-0">
        <!-- Empty state -->
        <template v-if="!hasSelection">
          <div class="flex-1 flex flex-col items-center justify-center text-gray-500 py-20">
            <div class="w-20 h-20 rounded-xl bg-[#18181b] ring-1 ring-gray-800 flex items-center justify-center mb-4">
              <UIcon :name="isManager ? 'i-heroicons-user-group' : 'i-heroicons-chat-bubble-left-right'" class="w-10 h-10 text-gray-500" />
            </div>
            <p class="text-lg">{{ isManager ? 'Select a client from the list' : 'Select a conversation to open chat' }}</p>
          </div>
        </template>

        <!-- Client view: manager header + chat -->
        <template v-else-if="isClient && rightPanelParty">
          <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between gap-4 mb-6 p-6 rounded-xl bg-[#18181b] ring-1 ring-gray-800">
              <div class="flex items-center gap-4">
                <UAvatar :src="rightPanelParty.image || undefined" :alt="rightPanelParty.name" class="w-14 h-14" />
                <div>
                  <h2 class="text-xl font-bold">{{ rightPanelParty.name }}</h2>
                  <p class="text-gray-400 text-sm">{{ rightPanelParty.email }}</p>
                </div>
              </div>
              <UButton v-if="rightPanelParty.email" :href="`mailto:${rightPanelParty.email}`" icon="i-heroicons-envelope" variant="ghost" class="text-gray-300 ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800" />
            </div>

            <!-- Chat -->
            <div class="flex-1 flex flex-col min-h-0 bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5 overflow-hidden">
              <div class="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
                <div v-if="messagesPending" class="text-gray-500 text-sm">Loading messages...</div>
                <div v-else-if="!messages.length" class="text-gray-500 text-sm py-4">No messages yet. Send one below.</div>
                <template v-else>
                  <div
                    v-for="msg in messages"
                    :key="msg.id"
                    class="flex"
                    :class="msg.senderId === currentUserId ? 'justify-end' : 'justify-start'"
                  >
                    <div
                      :class="[msg.senderId === currentUserId ? 'penta-chat-out' : 'bg-[#121212] text-gray-100 ring-1 ring-gray-800', 'max-w-[80%] rounded-xl px-4 py-3']"
                    >
                      <p class="text-sm">{{ msg.content }}</p>
                      <p class="text-xs opacity-70 mt-1">{{ formatDate(msg.createdAt) }}</p>
                    </div>
                  </div>
                </template>
              </div>
              <form class="flex gap-2 flex-shrink-0 pt-3 border-t border-gray-800" @submit.prevent="sendMessage()">
                <UInput
                  v-model="chatInput"
                  placeholder="Type a message..."
                  :ui="{ root: 'flex-1 min-w-0', base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 rounded-lg focus:ring-[var(--penta-accent)]' }"
                  @keydown.enter.prevent="sendMessage()"
                />
                <UButton type="submit" class="penta-btn-primary flex-shrink-0">
                  <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                </UButton>
              </form>
            </div>
          </div>
        </template>

        <!-- Manager view: client detail + tabs -->
        <template v-else>
          <template v-if="clientDetailPending">
            <div class="p-6 text-gray-500">Loading...</div>
          </template>
          <template v-else-if="clientDetail">
            <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
              <!-- Header -->
              <div class="flex items-start justify-between gap-4 mb-6 p-6 rounded-xl bg-[#18181b] ring-1 ring-gray-800">
                <div class="flex items-center gap-4">
                  <UAvatar v-if="clientDetail.image" :src="clientDetail.image" :alt="clientDetail.name" class="w-16 h-16" />
                  <div v-else class="w-16 h-16 rounded-full penta-avatar-subtle flex items-center justify-center penta-text-accent font-bold text-xl">
                    {{ getInitials(clientDetail.name) }}
                  </div>
                  <div>
                    <h2 class="text-xl font-bold">{{ clientDetail.name }}</h2>
                    <div class="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-500">
                      <span class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-gray-400" />
                        {{ clientDetail.email }}
                      </span>
                      <span v-if="clientDetail.phone" class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-phone" class="w-4 h-4 text-gray-400" />
                        {{ clientDetail.phone }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <UButton v-if="clientDetail.phone" :href="`tel:${clientDetail.phone}`" icon="i-heroicons-phone" variant="ghost" class="text-gray-300 ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800" />
                  <UButton v-if="clientDetail.email" :href="`mailto:${clientDetail.email}`" icon="i-heroicons-envelope" variant="ghost" class="text-gray-300 ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800" />
                </div>
              </div>

              <!-- Summary cards -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-blue-400" />
                    <span class="text-2xl font-bold">{{ clientDetail.totalJobs }}</span>
                  </div>
                  <div class="text-gray-500 text-sm">Total Jobs</div>
                </div>
                <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon name="i-heroicons-banknotes" class="w-5 h-5 penta-text-accent" />
                    <span class="text-2xl font-bold penta-text-accent">{{ clientDetail.totalPaid }}</span>
                  </div>
                  <div class="text-gray-500 text-sm">Total Paid (RON)</div>
                </div>
                <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon name="i-heroicons-clock" class="w-5 h-5 text-amber-400" />
                    <span class="text-2xl font-bold text-amber-400">{{ clientDetail.outstanding }}</span>
                  </div>
                  <div class="text-gray-500 text-sm">Outstanding (RON)</div>
                </div>
                <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon :name="clientDetail.outstanding === 0 ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'" :class="clientDetail.outstanding === 0 ? 'penta-text-accent' : 'text-amber-400'" class="w-5 h-5" />
                    <span :class="['text-2xl font-bold', clientDetail.outstanding === 0 ? 'penta-text-accent' : 'text-amber-400']">
                      {{ clientDetail.outstanding === 0 ? 'Paid' : 'Pending' }}
                    </span>
                  </div>
                  <div class="text-gray-500 text-sm">Status</div>
                </div>
              </div>

              <!-- Tabs (pill style like Jobs) -->
              <div class="flex gap-2 mb-4">
                <button
                  type="button"
                  :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'communication' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
                  @click="activeTab = 'communication'"
                >
                  <UIcon name="i-heroicons-chat-bubble-left-right" class="w-4 h-4" />
                  Communication
                </button>
                <button
                  type="button"
                  :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'jobs' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
                  @click="activeTab = 'jobs'"
                >
                  <UIcon name="i-heroicons-briefcase" class="w-4 h-4" />
                  Job History
                </button>
                <button
                  type="button"
                  :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'invoices' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
                  @click="activeTab = 'invoices'"
                >
                  <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                  Invoices
                </button>
              </div>

              <!-- Tab Content -->
              <div class="flex-1 overflow-hidden flex flex-col min-h-0">
                <!-- Communication -->
                <div v-show="activeTab === 'communication'" class="flex-1 flex flex-col min-h-0 bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5 overflow-hidden">
                  <div class="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
                    <div v-if="messagesPending" class="text-gray-500 text-sm">Loading messages...</div>
                    <div v-else-if="!messages.length" class="text-gray-500 text-sm py-4">
                      No conversation yet. Send a message below to start.
                    </div>
                    <template v-else>
                      <div
                        v-for="msg in messages"
                        :key="msg.id"
                        class="flex"
                        :class="msg.senderId === currentUserId ? 'justify-end' : 'justify-start'"
                      >
                        <div
                          :class="[msg.senderId === currentUserId ? 'penta-chat-out' : 'bg-[#121212] text-gray-100 ring-1 ring-gray-800', 'max-w-[80%] rounded-xl px-4 py-3']"
                        >
                          <p class="text-sm">{{ msg.content }}</p>
                          <p class="text-xs opacity-70 mt-1">{{ formatDate(msg.createdAt) }}</p>
                        </div>
                      </div>
                    </template>
                  </div>
                  <form class="flex gap-2 flex-shrink-0 pt-3 border-t border-gray-800" @submit.prevent="sendMessage()">
                    <UInput
                      v-model="chatInput"
                      placeholder="Type a message..."
                      :ui="{ root: 'flex-1 min-w-0', base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 rounded-lg focus:ring-[var(--penta-accent)]' }"
                      @keydown.enter.prevent="sendMessage()"
                    />
                    <UButton type="submit" class="penta-btn-primary flex-shrink-0">
                      <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                    </UButton>
                  </form>
                </div>

                <!-- Job History -->
                <div v-show="activeTab === 'jobs'" class="flex-1 overflow-y-auto space-y-3">
                  <div v-if="!clientDetail.jobs?.length" class="text-center py-12 text-gray-500 rounded-xl bg-[#121212] ring-1 ring-gray-800/60">
                    <UIcon name="i-heroicons-briefcase" class="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No jobs</p>
                  </div>
                  <NuxtLink
                    v-for="j in clientDetail.jobs"
                    :key="j.id"
                    :to="`/jobs/${j.id}`"
                    class="block p-5 rounded-xl bg-[#121212] ring-1 ring-gray-800/60 hover:ring-gray-700 transition-all"
                  >
                    <div class="flex justify-between items-start">
                      <div>
                        <h4 class="font-semibold text-white">{{ j.title }}</h4>
                        <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
                          <UIcon name="i-heroicons-calendar" class="w-4 h-4 flex-shrink-0" />
                          <span>{{ formatDate(j.createdAt) }}</span>
                        </div>
                      </div>
                      <span :class="['px-3 py-1 rounded-full text-xs font-medium ring-2 ring-inset', getJobStatusClass(j.status)]">
                        {{ getJobStatusLabel(j.status) }}
                      </span>
                    </div>
                  </NuxtLink>
                </div>

                <!-- Invoices -->
                <div v-show="activeTab === 'invoices'" class="flex-1 flex items-center justify-center">
                  <div class="text-center py-12 text-gray-500">
                    <UIcon name="i-heroicons-document-text" class="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Invoices are shown per job in Job History.</p>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
