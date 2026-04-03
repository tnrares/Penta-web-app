<script setup lang="ts">
import { defineAsyncComponent, defineComponent, h } from 'vue'

const DashboardChartsPanel = defineAsyncComponent({
  loader: () => import('~/components/charts/DashboardCharts.client.vue'),
  delay: 150,
  loadingComponent: defineComponent({
    setup() {
      return () =>
        h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8' }, [
          h('div', { class: 'h-80 rounded-xl bg-[#121212] ring-1 ring-gray-800 animate-pulse' }),
          h('div', { class: 'h-80 rounded-xl bg-[#121212] ring-1 ring-gray-800 animate-pulse' }),
        ])
    },
  }),
})

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const { $authClient } = useNuxtApp()
const session = $authClient.useSession()
const userRole = computed(
  () => (session.value?.data?.user as { role?: string } | undefined)?.role ?? ''
)
const isManager = computed(() => userRole.value === 'MANAGER')
const isClient = computed(() => userRole.value === 'CLIENT')
const isWorker = computed(() => userRole.value === 'WORKER')

const dashboardSubtitle = computed(() => {
  if (isManager.value) return "Here's what's happening with your business."
  if (isClient.value) {
    return "Here is an overview of your projects, payments, and updates."
  }
  return "Here's an overview of your projects and activity."
})

const dashboardHeading = computed(() => (isClient.value ? "Your dashboard" : "Dashboard"))

interface DashboardData {
  stats?: {
    monthlyRevenue: number
    monthlyRevenueChange: number
    monthlyRevenueDiff: number
    activeJobs: number
    activeJobsChange: number
    totalClients: number
    clientsChange: number
    newClientsThisMonth: number
    pendingIssues: number
    criticalIssues: number
  }
  revenueExpenses?: Array<{ label: string; revenue: number; expenses: number }>
  jobStatus?: Array<{ label: string; count: number; color: string }>
  recentJobs?: Array<{ id: number; title: string; date: string; value: number; status: string; dashboardStatus: string; progress: number; client?: { id: string; name: string; image?: string } }>
  alerts?: Array<{ type: string; title: string; message: string; timeAgo: string; severity: string }>
  topClients?: Array<{ id: string; name: string; jobs: number; revenue: number; growth: number }>
}

const { data: dashboard, pending } = await useFetch<DashboardData>(`${serverUrl}/api/dashboard`, {
  credentials: 'include'
})

/** Top priority items for the manager (alerts are pre-sorted by severity on the API). */
const priorityAlerts = computed(() => (dashboard.value?.alerts ?? []).slice(0, 4))

const today = computed(() => {
  const d = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
})

const stats = computed(() => dashboard.value?.stats ?? null)
const revenueExpenses = computed(() => dashboard.value?.revenueExpenses ?? [])
const jobStatus = computed(() => dashboard.value?.jobStatus ?? [])
const recentJobs = computed(() => dashboard.value?.recentJobs ?? [])
const alerts = computed(() => dashboard.value?.alerts ?? [])
const topClients = computed(() => dashboard.value?.topClients ?? [])

const revenueChartData = computed(() => ({
  labels: revenueExpenses.value.map((m: { label: string }) => m.label),
  datasets: [
    { label: 'Revenue', data: revenueExpenses.value.map((m: { revenue: number }) => m.revenue), backgroundColor: '#3b82f6' },
    { label: 'Expenses', data: revenueExpenses.value.map((m: { expenses: number }) => m.expenses), backgroundColor: '#ef4444' }
  ]
}))

const donutChartData = computed(() => ({
  labels: jobStatus.value.map((s: { label: string }) => s.label),
  datasets: [{
    data: jobStatus.value.map((s: { count: number }) => s.count),
    backgroundColor: jobStatus.value.map((s: { color: string }) => s.color),
    borderWidth: 0
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const }
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af' } },
    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
  }
}

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { position: 'bottom' as const }
  }
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    'Completed': 'penta-status-ok',
    'In Progress': 'text-blue-400 bg-blue-400/10',
    'Scheduled': 'text-purple-400 bg-purple-400/10',
    'Pending Quote': 'text-amber-400 bg-amber-400/10'
  }
  return map[status] || 'text-gray-400 bg-gray-400/10'
}

function getAlertBg(type: string) {
  if (type.includes('Stock')) return 'bg-amber-500/10 border-amber-500/30'
  if (type.includes('Out of Stock')) return 'bg-red-500/10 border-red-500/30'
  if (type.includes('Overdue')) return 'bg-orange-500/10 border-orange-500/30'
  if (type.includes('Deadline')) return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-gray-500/10 border-gray-500/30'
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/** Manager: no jobs, no clients, no recent activity (onboarding). */
const showManagerWorkspaceEmpty = computed(() => {
  if (pending.value || !isManager.value) return false
  const s = stats.value
  return (
    (s?.activeJobs ?? 0) === 0 &&
    (s?.totalClients ?? 0) === 0 &&
    recentJobs.value.length === 0
  )
})

/** Manager: show hero empty only when there are no priority alerts (otherwise show full dashboard + alerts). */
const showManagerEmptyBanner = computed(
  () => showManagerWorkspaceEmpty.value && priorityAlerts.value.length === 0
)

/** Client: no active pipeline and no jobs in list — friendly empty state (totalClients from API is always 1 for clients, so we cannot reuse manager logic). */
const showClientProjectsEmpty = computed(() => {
  if (pending.value || !isClient.value) return false
  return (stats.value?.activeJobs ?? 0) === 0 && recentJobs.value.length === 0
})

/** Worker: no jobs in dashboard scope yet. */
const showWorkerDashboardEmpty = computed(() => {
  if (pending.value || !isWorker.value) return false
  return (stats.value?.activeJobs ?? 0) === 0 && recentJobs.value.length === 0
})

/** Hide charts / summary / recent when a role-specific empty hero is shown. */
const hideMainDashboard = computed(
  () =>
    showManagerEmptyBanner.value ||
    showClientProjectsEmpty.value ||
    showWorkerDashboardEmpty.value
)
</script>

<template>
  <div class="min-h-full text-white">
    <!-- Header -->
    <div class="flex justify-between items-start mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-1">{{ dashboardHeading }}</h1>
        <p class="text-gray-400">Welcome back! {{ dashboardSubtitle }}</p>
      </div>
      <div class="text-right text-sm">
        <div class="text-gray-400">Today</div>
        <div>{{ today }}</div>
      </div>
    </div>

    <div v-if="pending" class="text-center py-20 text-gray-500">
      Loading dashboard...
    </div>

    <template v-else>
      <!-- Empty states: manager onboarding vs client vs worker -->
      <div
        v-if="showManagerEmptyBanner"
        class="mb-8 rounded-xl border border-dashed border-gray-700 bg-[#121212]/80 p-8 text-center ring-1 ring-gray-800/80"
      >
        <UIcon name="i-heroicons-rocket-launch" class="mx-auto mb-4 h-12 w-12 text-gray-500" />
        <h2 class="mb-2 text-xl font-semibold text-white">Get your workspace moving</h2>
        <p class="mx-auto mb-6 max-w-lg text-gray-400">
          Create your first job and add clients to see activity, charts, and alerts here. You can also open
          Workers or Inventory from the sidebar when you are ready.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton to="/jobs/new" class="penta-btn-primary">
            <UIcon name="i-heroicons-plus" class="mr-2 h-5 w-5" />
            Create job
          </UButton>
          <UButton to="/clients" variant="outline" class="ring-1 ring-gray-600 text-gray-200">
            View clients
          </UButton>
        </div>
      </div>

      <div
        v-else-if="showClientProjectsEmpty"
        class="mb-8 rounded-xl border border-dashed border-gray-700 bg-[#121212]/80 p-8 text-center ring-1 ring-gray-800/80"
      >
        <UIcon name="i-heroicons-building-office-2" class="mx-auto mb-4 h-12 w-12 text-gray-500" />
        <h2 class="mb-2 text-xl font-semibold text-white">No projects yet</h2>
        <p class="mx-auto mb-6 max-w-lg text-gray-400">
          When your contractor adds a project to your account, it will show up here with status, timeline, and documents.
          You do not need to create anything — your team will invite work as it is ready.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton to="/jobs" variant="outline" class="ring-1 ring-gray-600 text-gray-200">
            <UIcon name="i-heroicons-rectangle-stack" class="mr-2 h-5 w-5" />
            View jobs
          </UButton>
        </div>
      </div>

      <div
        v-else-if="showWorkerDashboardEmpty"
        class="mb-8 rounded-xl border border-dashed border-gray-700 bg-[#121212]/80 p-8 text-center ring-1 ring-gray-800/80"
      >
        <UIcon name="i-heroicons-wrench-screwdriver" class="mx-auto mb-4 h-12 w-12 text-gray-500" />
        <h2 class="mb-2 text-xl font-semibold text-white">No assigned jobs</h2>
        <p class="mx-auto mb-6 max-w-lg text-gray-400">
          Jobs you are assigned to will appear on this dashboard. Open the jobs list to see everything you can access.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton to="/jobs" class="penta-btn-primary">
            <UIcon name="i-heroicons-rectangle-stack" class="mr-2 h-5 w-5" />
            View jobs
          </UButton>
        </div>
      </div>

      <template v-if="!hideMainDashboard">
      <!-- Manager: priority alerts (plan B1 — needs attention first) -->
      <div
        v-if="isManager && priorityAlerts.length"
        class="mb-8 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 ring-1 ring-amber-500/20"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-white">Needs attention</h2>
          <NuxtLink to="/jobs" class="text-sm penta-text-accent hover:underline">View jobs</NuxtLink>
        </div>
        <ul class="space-y-2">
          <li
            v-for="(a, idx) in priorityAlerts"
            :key="idx"
            class="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-[#121212]/90 px-3 py-2.5 ring-1 ring-gray-800/80"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-white">{{ a.title }}</p>
              <p class="text-sm text-gray-400">{{ a.message }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span
                v-if="a.timeAgo"
                class="text-xs text-gray-500"
              >{{ a.timeAgo }}</span>
              <span
                class="rounded px-2 py-0.5 text-xs font-medium capitalize"
                :class="{
                  'bg-red-500/20 text-red-300': a.severity === 'critical',
                  'bg-orange-500/20 text-orange-300': a.severity === 'high',
                  'bg-amber-500/20 text-amber-200': a.severity === 'medium',
                  'bg-gray-700 text-gray-300': a.severity === 'low',
                }"
              >{{ a.severity }}</span>
            </div>
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-3 text-sm">
          <NuxtLink to="/inventory" class="text-gray-400 hover:text-white hover:underline">Inventory</NuxtLink>
          <NuxtLink to="/finance" class="text-gray-400 hover:text-white hover:underline">Finance</NuxtLink>
        </div>
      </div>

      <!-- Summary Cards: manager (4) vs client (2) -->
      <div
        v-if="isClient"
        class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
      >
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-blue-400" />
            </div>
            <span class="text-gray-400 text-sm">Active projects</span>
          </div>
          <div class="text-2xl font-bold">{{ stats?.activeJobs ?? 0 }}</div>
          <p class="text-gray-500 text-xs mt-2">Jobs in progress or scheduled with your contractor.</p>
        </div>
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full penta-avatar-subtle flex items-center justify-center">
              <UIcon name="i-heroicons-currency-dollar" class="w-5 h-5 penta-text-accent" />
            </div>
            <span class="text-gray-400 text-sm">Paid this month</span>
          </div>
          <div class="text-2xl font-bold">{{ formatCurrency(stats?.monthlyRevenue ?? 0) }}</div>
          <p class="text-gray-500 text-xs mt-2">Payments recorded on your invoices this month.</p>
        </div>
      </div>

      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full penta-avatar-subtle flex items-center justify-center">
              <UIcon name="i-heroicons-currency-dollar" class="w-5 h-5 penta-text-accent" />
            </div>
            <span class="text-gray-400 text-sm">Monthly Revenue</span>
          </div>
          <div class="text-2xl font-bold">{{ formatCurrency(stats?.monthlyRevenue ?? 0) }}</div>
          <div class="flex items-center gap-2 mt-1">
            <UIcon name="i-heroicons-arrow-trending-up" class="w-4 h-4 penta-text-accent" />
            <span class="penta-text-accent text-sm">{{ stats?.monthlyRevenueChange ?? 0 }}%</span>
            <span class="text-gray-500 text-xs">{{ (stats?.monthlyRevenueDiff ?? 0) >= 0 ? '+' : '' }}{{ formatCurrency(stats?.monthlyRevenueDiff ?? 0) }} from last month</span>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-blue-400" />
            </div>
            <span class="text-gray-400 text-sm">Active Jobs</span>
          </div>
          <div class="text-2xl font-bold">{{ stats?.activeJobs ?? 0 }}</div>
          <div class="flex items-center gap-2 mt-1">
            <UIcon name="i-heroicons-chart-bar" class="w-4 h-4 text-blue-400" />
            <span class="text-blue-400 text-sm">{{ stats?.activeJobsChange ?? 0 }}%</span>
            <span class="text-gray-500 text-xs">4 scheduled this week</span>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <UIcon name="i-heroicons-user-group" class="w-5 h-5 text-purple-400" />
            </div>
            <span class="text-gray-400 text-sm">Total Clients</span>
          </div>
          <div class="text-2xl font-bold">{{ stats?.totalClients ?? 0 }}</div>
          <div class="flex items-center gap-2 mt-1">
            <UIcon :name="(stats?.clientsChange ?? 0) >= 0 ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'" :class="[(stats?.clientsChange ?? 0) >= 0 ? 'penta-text-accent' : 'text-red-400']" class="w-4 h-4" />
            <span :class="[(stats?.clientsChange ?? 0) >= 0 ? 'penta-text-accent' : 'text-red-400']" class="text-sm">{{ stats?.clientsChange ?? 0 }}%</span>
            <span class="text-gray-500 text-xs">{{ stats?.newClientsThisMonth ?? 0 }} new this month</span>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-orange-400" />
            </div>
            <span class="text-gray-400 text-sm">Pending Issues</span>
          </div>
          <div class="text-2xl font-bold">{{ stats?.pendingIssues ?? 0 }}</div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-gray-500 text-xs">{{ stats?.criticalIssues ?? 0 }} critical items</span>
            <div class="flex items-center gap-1 text-orange-400">
              <UIcon name="i-heroicons-bell-alert" class="w-4 h-4" />
              <span class="text-xs">{{ alerts.length }} alerts</span>
            </div>
          </div>
        </div>
      </div>

      <DashboardChartsPanel
        v-if="!isClient"
        :revenue-chart-data="revenueChartData"
        :chart-options="chartOptions"
        :donut-chart-data="donutChartData"
        :donut-options="donutOptions"
        :has-revenue-data="revenueExpenses.length > 0"
        :has-job-status="jobStatus.length > 0"
      />
      <div
        v-else-if="jobStatus.length > 0"
        class="mb-8 rounded-xl bg-[#18181b] p-6 ring-1 ring-gray-800"
      >
        <h3 class="text-lg font-semibold mb-4">Your project status</h3>
        <div class="flex flex-wrap gap-3">
          <span
            v-for="row in jobStatus"
            :key="row.label"
            class="inline-flex items-center gap-2 rounded-lg bg-[#121212] px-3 py-2 text-sm ring-1 ring-gray-800"
          >
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: row.color }" />
            {{ row.label }}: {{ row.count }}
          </span>
        </div>
      </div>

      <!-- Recent Jobs + Alerts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">{{ isClient ? 'Your recent projects' : 'Recent Jobs' }}</h3>
            <NuxtLink to="/jobs" class="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1">
              View All <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>
          <div class="space-y-4">
            <NuxtLink
              v-for="job in recentJobs"
              :key="job.id"
              :to="`/jobs/${job.id}`"
              class="block bg-[#121212] ring-1 ring-gray-800 rounded-lg p-4 hover:ring-gray-700 transition-all"
            >
              <div class="flex justify-between items-start">
                <h4 class="font-medium">{{ job.title }}</h4>
                <span :class="['px-2 py-0.5 rounded text-xs font-medium', getStatusClass(job.dashboardStatus)]">
                  {{ job.dashboardStatus }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-gray-500 text-sm mt-1">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                {{ new Date(job.date).toLocaleDateString() }}
              </div>
              <div class="flex justify-between items-center mt-3">
                <span class="font-semibold penta-text-accent">{{ formatCurrency(job.value) }}</span>
                <div v-if="job.progress > 0" class="flex items-center gap-2">
                  <div class="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" :style="{ width: job.progress + '%' }" />
                  </div>
                  <span class="text-xs text-gray-400">{{ job.progress }}%</span>
                </div>
              </div>
            </NuxtLink>
            <div v-if="recentJobs.length === 0" class="text-center py-8 text-gray-500">
              No recent jobs
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">{{ isClient ? 'Your notices' : 'Alerts' }}</h3>
            <span v-if="alerts.length" class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-sm">{{ alerts.length }} new</span>
          </div>
          <div class="space-y-3">
            <div
              v-for="(alert, idx) in alerts"
              :key="idx"
              :class="['rounded-lg p-4 ring-1', getAlertBg(alert.type)]"
            >
              <div class="flex gap-3">
                <UIcon
                  v-if="alert.type.includes('Stock')"
                  name="i-heroicons-cube"
                  class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
                />
                <UIcon
                  v-else-if="alert.type.includes('Overdue')"
                  name="i-heroicons-currency-dollar"
                  class="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5"
                />
                <UIcon
                  v-else-if="alert.type.includes('Out of Stock')"
                  name="i-heroicons-cube-transparent"
                  class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                />
                <UIcon
                  v-else
                  name="i-heroicons-briefcase"
                  class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm">{{ alert.title }}</div>
                  <div class="text-gray-400 text-xs mt-0.5">{{ alert.message }}</div>
                  <div v-if="alert.timeAgo" class="text-gray-500 text-xs mt-1">{{ alert.timeAgo }}</div>
                </div>
              </div>
            </div>
            <div v-if="alerts.length === 0" class="text-center py-8 text-gray-500">
              No alerts
            </div>
          </div>
        </div>
      </div>

      <!-- Top Clients -->
      <div v-if="topClients.length" class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Top Clients</h3>
          <NuxtLink to="/clients" class="text-blue-400 text-sm hover:text-blue-300 flex items-center gap-1">
            View All Clients <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="client in topClients"
            :key="client.id"
            :to="`/clients/${client.id}`"
            class="bg-[#121212] ring-1 ring-gray-800 rounded-lg p-4 hover:ring-gray-700 transition-all"
          >
            <div class="flex items-center gap-3 mb-3">
              <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold">
                {{ getInitials(client.name) }}
              </div>
              <div>
                <div class="font-medium">{{ client.name }}</div>
                <div class="text-gray-500 text-sm">{{ client.jobs }} jobs</div>
              </div>
            </div>
            <div class="text-sm">
              <span class="text-gray-400">Revenue </span>
              <span class="font-semibold">{{ formatCurrency(client.revenue) }}</span>
            </div>
            <div :class="['text-sm mt-1', client.growth >= 0 ? 'penta-text-accent' : 'text-red-400']">
              Growth {{ client.growth >= 0 ? '+' : '' }}{{ client.growth }}%
              <UIcon :name="client.growth >= 0 ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'" class="w-4 h-4 inline" />
            </div>
          </NuxtLink>
        </div>
      </div>
      </template>
    </template>
  </div>
</template>
