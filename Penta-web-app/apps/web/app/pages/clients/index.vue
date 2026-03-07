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
    alert(err?.data?.error || 'Eroare la trimitere')
  }
}

function getStatusClass(s: string) {
  if (s === 'Paid') return 'text-green-400 bg-green-400/10 ring-green-400/20'
  if (s === 'Overdue') return 'text-red-400 bg-red-400/10 ring-red-400/20'
  return 'text-amber-400 bg-amber-400/10 ring-amber-400/20'
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

</script>

<template>
  <div class="h-full flex text-white max-w-7xl mx-auto">
    <!-- Sidebar: Manager = clients list, Client = conversations (managers) -->
    <div class="w-80 flex-shrink-0 border-r border-gray-800 bg-[#0f0f0f] flex flex-col">
      <div class="p-4 border-b border-gray-800">
        <h2 class="text-xl font-semibold mb-3">{{ isManager ? 'Clients' : 'Chat' }}</h2>
        <UInput
          v-if="isManager"
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search clients..."
          size="sm"
          :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500' }"
        />
        <UInput
          v-else
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search managers..."
          size="sm"
          :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500' }"
        />
      </div>
      <!-- Manager: list of clients -->
      <template v-if="isManager">
        <div v-if="clientsPending" class="p-4 text-gray-500 text-sm">Loading...</div>
        <div v-else-if="!clients?.length" class="p-4 text-gray-500 text-sm">No clients.</div>
        <div v-else class="flex-1 overflow-y-auto">
          <button
            v-for="c in filteredClients"
            :key="c.id"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            :class="{ 'bg-gray-800/50': selectedClientId === c.id }"
            @click="loadClientDetail(c.id)"
          >
            <UAvatar :src="c.image || undefined" :alt="c.name" class="w-10 h-10 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ c.name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ c.email }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span :class="['text-xs px-2 py-0.5 rounded-full ring-1 ring-inset', getStatusClass(c.status)]">
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
      <!-- Client: list of conversations (managers) -->
      <template v-else>
        <div v-if="!conversations?.length" class="p-4 text-gray-500 text-sm">No conversations yet. Start a job to chat with a manager.</div>
        <div v-else class="flex-1 overflow-y-auto">
          <button
            v-for="conv in filteredConversations"
            :key="conv.id"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            :class="{ 'bg-gray-800/50': selectedConversationId === conv.id }"
            @click="selectConversation(conv)"
          >
            <UAvatar :src="conv.manager?.image || undefined" :alt="conv.manager?.name" class="w-10 h-10 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ conv.manager?.name }}</p>
              <p class="text-xs text-gray-500 truncate">{{ conv.manager?.email }}</p>
              <span class="text-xs text-gray-500">{{ lastInteraction(conv) }}</span>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0 bg-[#121212]">
      <template v-if="!hasSelection">
        <div class="flex-1 flex items-center justify-center text-gray-500">
          {{ isManager ? 'Select a client from the list' : 'Select a conversation to open chat' }}
        </div>
      </template>
      <!-- Client view: manager header + chat only -->
      <template v-else-if="isClient && rightPanelParty">
        <div class="p-6 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <UAvatar :src="rightPanelParty.image || undefined" :alt="rightPanelParty.name" class="w-14 h-14" />
            <div>
              <h1 class="text-2xl font-bold">{{ rightPanelParty.name }}</h1>
              <p class="text-gray-400 text-sm">{{ rightPanelParty.email }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <UButton v-if="rightPanelParty.email" :href="`mailto:${rightPanelParty.email}`" icon="i-heroicons-envelope" variant="ghost" class="text-gray-400" />
          </div>
        </div>
        <div class="flex-1 overflow-hidden flex flex-col p-6">
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
                  class="max-w-[75%] rounded-lg px-4 py-2"
                  :class="msg.senderId === currentUserId ? 'bg-green-600/80 text-white' : 'bg-gray-700 text-gray-100'"
                >
                  <p class="text-sm">{{ msg.content }}</p>
                  <p class="text-xs opacity-70 mt-1">{{ formatDate(msg.createdAt) }}</p>
                </div>
              </div>
            </template>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <UInput
              v-model="chatInput"
              placeholder="Type a message..."
              class="flex-1"
              :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
              @keydown.enter.prevent="sendMessage()"
            />
            <UButton icon="i-heroicons-paper-airplane" class="bg-green-600 hover:bg-green-500" @click="sendMessage()" />
          </div>
        </div>
      </template>
      <!-- Manager view: client detail + tabs -->
      <template v-else>
        <template v-if="clientDetailPending">
          <div class="p-6 text-gray-500">Loading...</div>
        </template>
        <template v-else-if="clientDetail">
          <!-- Header -->
          <div class="p-6 border-b border-gray-800 flex flex-wrap items-start justify-between gap-4">
            <div class="flex items-center gap-4">
              <UAvatar :src="clientDetail.image || undefined" :alt="clientDetail.name" class="w-14 h-14" />
              <div>
                <h1 class="text-2xl font-bold">{{ clientDetail.name }}</h1>
                <p class="text-gray-400 text-sm">{{ clientDetail.email }}</p>
                <p class="text-gray-400 text-sm">{{ clientDetail.phone || '–' }}</p>
                <p class="text-gray-400 text-sm">{{ clientDetail.jobs?.[0]?.address || '–' }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <UButton v-if="clientDetail.phone" :href="`tel:${clientDetail.phone}`" icon="i-heroicons-phone" variant="ghost" class="text-gray-400" />
              <UButton v-if="clientDetail.email" :href="`mailto:${clientDetail.email}`" icon="i-heroicons-envelope" variant="ghost" class="text-gray-400" />
            </div>
          </div>

          <!-- Summary cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b border-gray-800">
            <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800">
              <p class="text-xs text-gray-500 mb-1">Total Jobs</p>
              <p class="text-xl font-semibold">{{ clientDetail.totalJobs }}</p>
            </div>
            <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800">
              <p class="text-xs text-gray-500 mb-1">Total Paid</p>
              <p class="text-xl font-semibold text-green-400">{{ clientDetail.totalPaid }} RON</p>
            </div>
            <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800">
              <p class="text-xs text-gray-500 mb-1">Outstanding</p>
              <p class="text-xl font-semibold text-amber-400">{{ clientDetail.outstanding }} RON</p>
            </div>
            <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800">
              <p class="text-xs text-gray-500 mb-1">Status</p>
              <p :class="['text-xl font-semibold', clientDetail.outstanding === 0 ? 'text-green-400' : 'text-amber-400']">
                {{ clientDetail.outstanding === 0 ? 'Excellent' : 'Pending' }}
              </p>
            </div>
          </div>

          <!-- Tabs -->
          <div class="border-b border-gray-800 px-6">
            <div class="flex gap-6">
              <button
                type="button"
                class="py-3 border-b-2 transition-colors"
                :class="activeTab === 'communication' ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'"
                @click="activeTab = 'communication'"
              >
                Communication
              </button>
              <button
                type="button"
                class="py-3 border-b-2 transition-colors"
                :class="activeTab === 'jobs' ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'"
                @click="activeTab = 'jobs'"
              >
                Job History
              </button>
              <button
                type="button"
                class="py-3 border-b-2 transition-colors"
                :class="activeTab === 'invoices' ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'"
                @click="activeTab = 'invoices'"
              >
                Invoices
              </button>
            </div>
          </div>

          <!-- Tab content -->
          <div class="flex-1 overflow-hidden flex flex-col p-6">
            <!-- Communication -->
            <div v-show="activeTab === 'communication'" class="flex-1 flex flex-col min-h-0">
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
                    class="max-w-[75%] rounded-lg px-4 py-2"
                    :class="msg.senderId === currentUserId ? 'bg-green-600/80 text-white' : 'bg-gray-700 text-gray-100'"
                  >
                    <p class="text-sm">{{ msg.content }}</p>
                    <p class="text-xs opacity-70 mt-1">{{ formatDate(msg.createdAt) }}</p>
                  </div>
                </div>
              </template>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <UInput
                v-model="chatInput"
                placeholder="Type a message..."
                class="flex-1"
                :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
                @keydown.enter.prevent="sendMessage()"
              />
              <UButton icon="i-heroicons-paper-airplane" class="bg-green-600 hover:bg-green-500" @click="sendMessage()" />
            </div>
            </div>

            <!-- Job History -->
            <div v-show="activeTab === 'jobs'" class="space-y-3">
              <div v-if="!clientDetail.jobs?.length" class="text-gray-500 text-sm">No jobs.</div>
              <NuxtLink
                v-for="j in clientDetail.jobs"
                :key="j.id"
                :to="`/jobs/${j.id}`"
                class="block p-3 rounded-lg bg-[#18181b] ring-1 ring-gray-800 hover:ring-gray-700"
              >
                <p class="font-medium">{{ j.title }}</p>
                <p class="text-xs text-gray-500">{{ j.status }} · {{ formatDate(j.createdAt) }}</p>
              </NuxtLink>
            </div>

            <!-- Invoices -->
            <div v-show="activeTab === 'invoices'" class="space-y-3">
              <div class="text-gray-500 text-sm">Invoices are shown per job in Job History.</div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
