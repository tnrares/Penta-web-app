<script setup lang="ts">
import { defineAsyncComponent, defineComponent, h } from 'vue'

const FinanceChartsPanel = defineAsyncComponent({
  loader: () => import('~/components/charts/FinanceCharts.client.vue'),
  delay: 150,
  loadingComponent: defineComponent({
    setup() {
      return () =>
        h('div', { class: 'space-y-6' }, [
          h('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6' }, [
            h('div', { class: 'lg:col-span-2 h-[340px] rounded-xl bg-[#121212] ring-1 ring-gray-800 animate-pulse' }),
            h('div', { class: 'h-[340px] rounded-xl bg-[#121212] ring-1 ring-gray-800 animate-pulse' }),
          ]),
          h('div', { class: 'h-[340px] rounded-xl bg-[#121212] ring-1 ring-gray-800 animate-pulse' }),
        ])
    },
  }),
})

interface Invoice {
  id: string
  invoiceNumber: string
  client: string
  project: string
  amount: number
  status: 'paid' | 'pending' | 'overdue' | 'draft'
  issueDate: string
  dueDate: string
  paidDate?: string
  items: Array<{
    description: string
    quantity: number
    rate: number
    amount: number
  }>
}

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  vendor: string
  paymentMethod: string
  status: 'paid' | 'pending'
  project?: string
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2025-001',
    client: 'Smith Residence',
    project: 'Kitchen Remodel',
    amount: 45000,
    status: 'paid',
    issueDate: '2025-10-15',
    dueDate: '2025-11-15',
    paidDate: '2025-11-10',
    items: [
      { description: 'Labor - Carpentry', quantity: 120, rate: 85, amount: 10200 },
      { description: 'Materials - Cabinets', quantity: 1, rate: 15000, amount: 15000 },
      { description: 'Materials - Countertops', quantity: 1, rate: 8500, amount: 8500 },
      { description: 'Labor - Installation', quantity: 80, rate: 95, amount: 7600 },
      { description: 'Plumbing Work', quantity: 1, rate: 3700, amount: 3700 }
    ]
  },
  {
    id: '2',
    invoiceNumber: 'INV-2025-002',
    client: 'Johnson Commercial Plaza',
    project: 'Office Renovation',
    amount: 128500,
    status: 'pending',
    issueDate: '2025-11-01',
    dueDate: '2025-12-01',
    items: [
      { description: 'Labor - General Construction', quantity: 320, rate: 95, amount: 30400 },
      { description: 'Materials - Flooring', quantity: 1, rate: 42000, amount: 42000 },
      { description: 'Electrical Work', quantity: 1, rate: 28500, amount: 28500 },
      { description: 'HVAC Installation', quantity: 1, rate: 27600, amount: 27600 }
    ]
  },
  {
    id: '3',
    invoiceNumber: 'INV-2025-003',
    client: 'Wilson Office Building',
    project: 'Lobby Modernization',
    amount: 67800,
    status: 'overdue',
    issueDate: '2025-09-15',
    dueDate: '2025-10-15',
    items: [
      { description: 'Labor - Renovation', quantity: 180, rate: 90, amount: 16200 },
      { description: 'Materials - Marble', quantity: 1, rate: 35000, amount: 35000 },
      { description: 'Lighting Installation', quantity: 1, rate: 16600, amount: 16600 }
    ]
  },
  {
    id: '4',
    invoiceNumber: 'INV-2025-004',
    client: 'Martinez Retail Store',
    project: 'Store Buildout',
    amount: 89200,
    status: 'paid',
    issueDate: '2025-10-01',
    dueDate: '2025-11-01',
    paidDate: '2025-10-28',
    items: [
      { description: 'Labor - Construction', quantity: 240, rate: 85, amount: 20400 },
      { description: 'Materials - Fixtures', quantity: 1, rate: 42000, amount: 42000 },
      { description: 'Electrical & Lighting', quantity: 1, rate: 26800, amount: 26800 }
    ]
  },
  {
    id: '5',
    invoiceNumber: 'INV-2025-005',
    client: 'Brown Medical Center',
    project: 'Facility Upgrade',
    amount: 156000,
    status: 'draft',
    issueDate: '2025-11-08',
    dueDate: '2025-12-08',
    items: [
      { description: 'Labor - Medical Grade Construction', quantity: 400, rate: 110, amount: 44000 },
      { description: 'Materials - Medical Fixtures', quantity: 1, rate: 68000, amount: 68000 },
      { description: 'HVAC & Clean Room', quantity: 1, rate: 44000, amount: 44000 }
    ]
  }
]

const mockExpenses: Expense[] = [
  { id: '1', category: 'Materials', description: 'Lumber & Building Materials', amount: 8500, date: '2025-11-05', vendor: 'Home Depot', paymentMethod: 'Business Credit Card', status: 'paid', project: 'Smith Residence' },
  { id: '2', category: 'Equipment', description: 'Power Tools & Equipment Rental', amount: 2400, date: '2025-11-03', vendor: 'United Rentals', paymentMethod: 'Business Credit Card', status: 'paid', project: 'Johnson Commercial Plaza' },
  { id: '3', category: 'Labor', description: 'Subcontractor Payment - Electrical', amount: 12000, date: '2025-11-01', vendor: 'ABC Electrical Co.', paymentMethod: 'Check', status: 'paid', project: 'Wilson Office Building' },
  { id: '4', category: 'Transportation', description: 'Fuel & Vehicle Maintenance', amount: 680, date: '2025-11-07', vendor: 'Shell Gas Station', paymentMethod: 'Business Credit Card', status: 'paid' },
  { id: '5', category: 'Insurance', description: 'General Liability Insurance', amount: 3200, date: '2025-11-01', vendor: 'State Farm Business', paymentMethod: 'ACH Transfer', status: 'paid' },
  { id: '6', category: 'Materials', description: 'Plumbing Supplies', amount: 1850, date: '2025-11-06', vendor: 'Ferguson Plumbing', paymentMethod: 'Business Credit Card', status: 'paid', project: 'Brown Medical Center' },
  { id: '7', category: 'Office', description: 'Office Supplies & Software', amount: 420, date: '2025-11-02', vendor: 'Staples', paymentMethod: 'Business Credit Card', status: 'paid' }
]

const revenueData = [
  { month: 'May', revenue: 85000, expenses: 52000, profit: 33000 },
  { month: 'Jun', revenue: 92000, expenses: 58000, profit: 34000 },
  { month: 'Jul', revenue: 78000, expenses: 48000, profit: 30000 },
  { month: 'Aug', revenue: 105000, expenses: 63000, profit: 42000 },
  { month: 'Sep', revenue: 118000, expenses: 71000, profit: 47000 },
  { month: 'Oct', revenue: 134000, expenses: 79000, profit: 55000 },
  { month: 'Nov', revenue: 196300, expenses: 29050, profit: 167250 }
]

const expensesByCategory = [
  { name: 'Materials', value: 10350, color: '#22c55e' },
  { name: 'Labor', value: 12000, color: '#a855f7' },
  { name: 'Equipment', value: 2400, color: '#f59e0b' },
  { name: 'Transportation', value: 680, color: '#14b8a6' },
  { name: 'Insurance', value: 3200, color: '#ef4444' },
  { name: 'Office', value: 420, color: '#06b6d4' }
]

const searchQuery = ref('')
const activeTab = ref<'overview' | 'invoices' | 'expenses'>('overview')
const invoiceFilter = ref('all')
const selectedInvoice = ref<Invoice | null>(null)
const invoiceModalOpen = computed({
  get: () => selectedInvoice.value !== null,
  set: (v: boolean) => { if (!v) selectedInvoice.value = null }
})

const totalRevenue = computed(() =>
  mockInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
)

const pendingPayments = computed(() =>
  mockInvoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)
)

const totalExpenses = computed(() => mockExpenses.reduce((sum, exp) => sum + exp.amount, 0))

const profit = computed(() => totalRevenue.value - totalExpenses.value)
const profitMargin = computed(() =>
  totalRevenue.value > 0 ? ((profit.value / totalRevenue.value) * 100).toFixed(1) : '0'
)

const overdueInvoices = computed(() => mockInvoices.filter(inv => inv.status === 'overdue'))

const pendingOrOverdueCount = computed(() =>
  mockInvoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue').length
)

const filteredInvoices = computed(() => {
  return mockInvoices.filter((invoice) => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      invoice.client.toLowerCase().includes(q) ||
      invoice.invoiceNumber.toLowerCase().includes(q) ||
      invoice.project.toLowerCase().includes(q)
    const matchesFilter = invoiceFilter.value === 'all' || invoice.status === invoiceFilter.value
    return matchesSearch && matchesFilter
  })
})

const largestExpense = computed(() => {
  if (!mockExpenses.length) return { amount: 0, description: '–' }
  const max = mockExpenses.reduce((a, b) => (a.amount >= b.amount ? a : b))
  return { amount: max.amount, description: max.description }
})

const topCategory = computed(() => {
  const map = new Map<string, number>()
  for (const e of mockExpenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  }
  let top = '–'
  let max = 0
  for (const [k, v] of map) {
    if (v > max) {
      max = v
      top = k
    }
  }
  const pct = totalExpenses.value > 0 ? ((max / totalExpenses.value) * 100).toFixed(0) : '0'
  return { name: top, pct }
})

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + ' RON'
}

function getStatusClass(status: string) {
  switch (status) {
    case 'paid':
      return 'penta-status-ok'
    case 'pending':
      return 'text-amber-400 bg-amber-400/10 ring-amber-400/20'
    case 'overdue':
      return 'text-red-400 bg-red-400/10 ring-red-400/20'
    case 'draft':
      return 'text-gray-400 bg-gray-400/10 ring-gray-400/20'
    default:
      return 'text-gray-400 bg-gray-400/10 ring-gray-400/20'
  }
}

function statusLabel(status: Invoice['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function openInvoice(inv: Invoice) {
  selectedInvoice.value = inv
}

const chartPlugins = {
  legend: { labels: { color: '#9ca3af', usePointStyle: true, padding: 16 } },
  tooltip: {
    backgroundColor: '#18181b',
    borderColor: '#374151',
    borderWidth: 1,
    titleColor: '#f3f4f6',
    bodyColor: '#d1d5db'
  }
}

const lineChartData = computed(() => ({
  labels: revenueData.map(d => d.month),
  datasets: [
    {
      label: 'Revenue',
      data: revenueData.map(d => d.revenue),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      tension: 0.35,
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 5
    },
    {
      label: 'Expenses',
      data: revenueData.map(d => d.expenses),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      tension: 0.35,
      fill: false,
      pointRadius: 3
    },
    {
      label: 'Profit',
      data: revenueData.map(d => d.profit),
      borderColor: '#14b8a6',
      backgroundColor: 'rgba(20, 184, 166, 0.08)',
      tension: 0.35,
      fill: false,
      pointRadius: 3
    }
  ]
}))

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: chartPlugins,
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(255,255,255,0.06)' },
      ticks: { color: '#9ca3af' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#9ca3af' }
    }
  }
}

const barChartData = computed(() => ({
  labels: revenueData.map(d => d.month),
  datasets: [
    { label: 'Revenue', data: revenueData.map(d => d.revenue), backgroundColor: '#22c55e' },
    { label: 'Expenses', data: revenueData.map(d => d.expenses), backgroundColor: '#ef4444' },
    { label: 'Profit', data: revenueData.map(d => d.profit), backgroundColor: '#14b8a6' }
  ]
}))

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: chartPlugins,
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(255,255,255,0.06)' },
      ticks: { color: '#9ca3af' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#9ca3af' }
    }
  }
}

const doughnutData = computed(() => ({
  labels: expensesByCategory.map(e => e.name),
  datasets: [{
    data: expensesByCategory.map(e => e.value),
    backgroundColor: expensesByCategory.map(e => e.color),
    borderWidth: 0,
    hoverOffset: 6
  }]
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    ...chartPlugins,
    legend: { position: 'bottom' as const, labels: { color: '#9ca3af', padding: 12, usePointStyle: true } }
  }
}

function expenseStatusClass(s: string) {
  return s === 'paid'
    ? 'penta-status-ok'
    : 'text-amber-400 bg-amber-400/10 ring-amber-400/20'
}

function categoryBadgeClass(cat: string) {
  const map: Record<string, string> = {
    Materials: 'penta-status-ok',
    Equipment: 'text-amber-400 bg-amber-400/10 ring-amber-400/25',
    Labor: 'text-purple-400 bg-purple-400/10 ring-purple-400/25',
    Transportation: 'text-teal-400 bg-teal-400/10 ring-teal-400/25',
    Insurance: 'text-red-400 bg-red-400/10 ring-red-400/25',
    Office: 'text-cyan-400 bg-cyan-400/10 ring-cyan-400/25'
  }
  return map[cat] || 'text-gray-400 bg-gray-400/10 ring-gray-400/25'
}

function stubAction(label: string) {
  // Placeholder until API / PDF export
  alert(`${label} — coming soon`)
}
</script>

<template>
  <div class="flex flex-col text-white max-w-6xl mx-auto w-full min-h-0">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold mb-1">Finance</h1>
        <p class="text-gray-400 text-sm">
          Invoices, expenses, and financial performance
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          variant="ghost"
          class="ring-1 ring-gray-700 bg-[#18181b] hover:bg-gray-800 text-gray-300"
          @click="stubAction('Export report')"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-2" />
          Export Report
        </UButton>
        <UButton class="penta-btn-primary" @click="stubAction('New invoice')">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          New Invoice
        </UButton>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        type="button"
        :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'overview' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
        @click="activeTab = 'overview'"
      >
        <UIcon name="i-heroicons-chart-pie" class="w-4 h-4" />
        Overview
      </button>
      <button
        type="button"
        :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'invoices' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
        @click="activeTab = 'invoices'"
      >
        <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
        Invoices
        <span
          v-if="overdueInvoices.length"
          class="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
        >
          {{ overdueInvoices.length }}
        </span>
      </button>
      <button
        type="button"
        :class="['flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ring-1', activeTab === 'expenses' ? 'penta-pill-active' : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:bg-gray-800']"
        @click="activeTab = 'expenses'"
      >
        <UIcon name="i-heroicons-wallet" class="w-4 h-4" />
        Expenses
      </button>
    </div>

    <!-- Overview -->
    <div v-show="activeTab === 'overview'" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="w-11 h-11 rounded-xl penta-bg-subtle flex items-center justify-center">
              <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6 penta-text-accent" />
            </div>
            <span class="text-xs penta-text-accent flex items-center gap-0.5">
              <UIcon name="i-heroicons-arrow-up-right" class="w-3.5 h-3.5" />
              +12.5%
            </span>
          </div>
          <p class="text-gray-500 text-sm mb-1">Total Revenue</p>
          <p class="text-2xl font-bold">{{ formatMoney(totalRevenue) }}</p>
          <p class="text-gray-600 text-xs mt-2">This month (demo)</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-arrow-trending-down" class="w-6 h-6 text-red-400" />
            </div>
            <span class="text-xs text-red-400 flex items-center gap-0.5">
              <UIcon name="i-heroicons-arrow-down-right" class="w-3.5 h-3.5" />
              −8.2%
            </span>
          </div>
          <p class="text-gray-500 text-sm mb-1">Total Expenses</p>
          <p class="text-2xl font-bold">{{ formatMoney(totalExpenses) }}</p>
          <p class="text-gray-600 text-xs mt-2">This month (demo)</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="w-11 h-11 rounded-xl bg-teal-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-currency-dollar" class="w-6 h-6 text-teal-400" />
            </div>
            <span class="text-xs penta-text-accent flex items-center gap-0.5">
              <UIcon name="i-heroicons-arrow-up-right" class="w-3.5 h-3.5" />
              +18.3%
            </span>
          </div>
          <p class="text-gray-500 text-sm mb-1">Net Profit</p>
          <p class="text-2xl font-bold">{{ formatMoney(profit) }}</p>
          <p class="text-gray-600 text-xs mt-2">Margin: {{ profitMargin }}%</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-start justify-between mb-3">
            <div class="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-clock" class="w-6 h-6 text-amber-400" />
            </div>
            <span
              v-if="overdueInvoices.length"
              class="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
            >
              {{ overdueInvoices.length }} overdue
            </span>
          </div>
          <p class="text-gray-500 text-sm mb-1">Pending Payments</p>
          <p class="text-2xl font-bold">{{ formatMoney(pendingPayments) }}</p>
          <p class="text-gray-600 text-xs mt-2">{{ pendingOrOverdueCount }} invoices</p>
        </div>
      </div>

      <FinanceChartsPanel
        :line-chart-data="lineChartData"
        :line-chart-options="lineChartOptions"
        :doughnut-data="doughnutData"
        :doughnut-options="doughnutOptions"
        :bar-chart-data="barChartData"
        :bar-chart-options="barChartOptions"
      />

      <div
        v-if="overdueInvoices.length"
        class="bg-red-500/5 ring-1 ring-red-500/25 rounded-xl p-5"
      >
        <div class="flex items-start gap-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold mb-1">Overdue Invoices</h3>
            <p class="text-gray-400 text-sm mb-4">
              You have {{ overdueInvoices.length }} overdue invoice(s) totaling
              {{ formatMoney(overdueInvoices.reduce((s, inv) => s + inv.amount, 0)) }}.
            </p>
            <div class="space-y-2">
              <div
                v-for="inv in overdueInvoices"
                :key="inv.id"
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#121212] rounded-xl p-4 ring-1 ring-gray-800/80"
              >
                <div>
                  <span class="text-white font-medium">{{ inv.client }}</span>
                  <span class="text-gray-500 text-sm ml-2">{{ inv.invoiceNumber }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <span class="text-red-400 font-medium">{{ formatMoney(inv.amount) }}</span>
                  <span class="text-gray-500 text-sm">Due {{ new Date(inv.dueDate).toLocaleDateString('en-US') }}</span>
                  <UButton size="sm" class="penta-btn-primary" @click="stubAction('Send reminder')">
                    <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4 mr-1" />
                    Remind
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoices -->
    <div v-show="activeTab === 'invoices'" class="space-y-6">
      <div class="flex flex-col sm:flex-row gap-3">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search invoices..."
          class="flex-1"
          size="lg"
          :ui="{ root: 'w-full', base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500 ring-1 ring-gray-800 focus:ring-[var(--penta-accent)]' }"
        />
        <USelect
          v-model="invoiceFilter"
          :items="[
            { label: 'All Invoices', value: 'all' },
            { label: 'Paid', value: 'paid' },
            { label: 'Pending', value: 'pending' },
            { label: 'Overdue', value: 'overdue' },
            { label: 'Draft', value: 'draft' }
          ]"
          placeholder="Filter"
          class="w-full sm:w-52"
          :ui="{ base: 'bg-[#18181b] ring-1 ring-gray-800' }"
        />
      </div>

      <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px]">
            <thead>
              <tr class="bg-[#121212] text-left text-gray-500 text-sm border-b border-gray-800">
                <th class="px-4 py-3 font-medium">Invoice #</th>
                <th class="px-4 py-3 font-medium">Client</th>
                <th class="px-4 py-3 font-medium">Project</th>
                <th class="px-4 py-3 font-medium">Amount</th>
                <th class="px-4 py-3 font-medium">Issue</th>
                <th class="px-4 py-3 font-medium">Due</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/80">
              <tr
                v-for="invoice in filteredInvoices"
                :key="invoice.id"
                class="hover:bg-[#121212]/80 transition-colors cursor-pointer"
                @click="openInvoice(invoice)"
              >
                <td class="px-4 py-3">
                  <span class="penta-text-accent font-medium">{{ invoice.invoiceNumber }}</span>
                </td>
                <td class="px-4 py-3 text-white">{{ invoice.client }}</td>
                <td class="px-4 py-3 text-gray-400">{{ invoice.project }}</td>
                <td class="px-4 py-3 text-white">{{ formatMoney(invoice.amount) }}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">{{ new Date(invoice.issueDate).toLocaleDateString('en-US') }}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">{{ new Date(invoice.dueDate).toLocaleDateString('en-US') }}</td>
                <td class="px-4 py-3">
                  <span :class="['inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-2 ring-inset', getStatusClass(invoice.status)]">
                    <UIcon
                      :name="invoice.status === 'paid' ? 'i-heroicons-check-circle' : invoice.status === 'pending' ? 'i-heroicons-clock' : invoice.status === 'overdue' ? 'i-heroicons-exclamation-circle' : 'i-heroicons-document-text'"
                      class="w-3.5 h-3.5"
                    />
                    {{ statusLabel(invoice.status) }}
                  </span>
                </td>
                <td class="px-4 py-3" @click.stop>
                  <div class="flex items-center gap-0.5">
                    <UButton size="xs" variant="ghost" icon="i-heroicons-eye" class="text-gray-400 hover:text-white" @click="openInvoice(invoice)" />
                    <UButton size="xs" variant="ghost" icon="i-heroicons-paper-airplane" class="text-gray-400 hover:text-white" @click="stubAction('Send to client')" />
                    <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray" class="text-gray-400 hover:text-white" @click="stubAction('Download PDF')" />
                    <UButton
                      v-if="invoice.status !== 'paid'"
                      size="xs"
                      variant="ghost"
                      icon="i-heroicons-check-circle"
                      class="text-gray-400 hover:text-[var(--penta-accent)]"
                      @click="stubAction('Mark as paid')"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Expenses -->
    <div v-show="activeTab === 'expenses'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-wallet" class="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">Total Expenses</p>
              <p class="text-xl font-bold">{{ formatMoney(totalExpenses) }}</p>
            </div>
          </div>
          <p class="text-gray-600 text-xs">This month (demo)</p>
        </div>
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-credit-card" class="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">Largest Expense</p>
              <p class="text-xl font-bold">{{ formatMoney(largestExpense.amount) }}</p>
            </div>
          </div>
          <p class="text-gray-600 text-xs truncate">{{ largestExpense.description }}</p>
        </div>
        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <UIcon name="i-heroicons-chart-pie" class="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p class="text-gray-500 text-sm">Top Category</p>
              <p class="text-xl font-bold">{{ topCategory.name }}</p>
            </div>
          </div>
          <p class="text-gray-600 text-xs">{{ topCategory.pct }}% of expenses</p>
        </div>
      </div>

      <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h3 class="text-lg font-semibold">Recent Expenses</h3>
          <UButton size="sm" class="penta-btn-primary w-fit" @click="stubAction('Add expense')">
            <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
            Add Expense
          </UButton>
        </div>
        <div class="space-y-3">
          <div
            v-for="expense in mockExpenses"
            :key="expense.id"
            class="bg-[#121212] rounded-xl p-4 ring-1 ring-gray-800/60 hover:ring-gray-700 transition-all"
          >
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-medium ring-2 ring-inset', categoryBadgeClass(expense.category)]">
                    {{ expense.category }}
                  </span>
                  <span v-if="expense.project" class="text-gray-500 text-sm">• {{ expense.project }}</span>
                </div>
                <h4 class="text-white font-medium mb-2">{{ expense.description }}</h4>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                    {{ new Date(expense.date).toLocaleDateString('en-US') }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <UIcon name="i-heroicons-credit-card" class="w-4 h-4" />
                    {{ expense.paymentMethod }}
                  </span>
                  <span>Vendor: {{ expense.vendor }}</span>
                </div>
              </div>
              <div class="text-left sm:text-right flex-shrink-0">
                <p class="text-xl font-bold text-white mb-2">{{ formatMoney(expense.amount) }}</p>
                <span :class="['inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-2 ring-inset', expenseStatusClass(expense.status)]">
                  <UIcon :name="expense.status === 'paid' ? 'i-heroicons-check-circle' : 'i-heroicons-clock'" class="w-3.5 h-3.5" />
                  {{ expense.status === 'paid' ? 'Paid' : 'Pending' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoice detail modal -->
    <UModal v-model:open="invoiceModalOpen" :title="selectedInvoice ? `Invoice ${selectedInvoice.invoiceNumber}` : 'Invoice'">
      <template #body>
        <div v-if="selectedInvoice" class="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-gray-500 text-sm">Invoice</p>
              <p class="text-xl font-bold">{{ selectedInvoice.invoiceNumber }}</p>
            </div>
            <span :class="['inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ring-2 ring-inset', getStatusClass(selectedInvoice.status)]">
              <UIcon
                :name="selectedInvoice.status === 'paid' ? 'i-heroicons-check-circle' : selectedInvoice.status === 'pending' ? 'i-heroicons-clock' : selectedInvoice.status === 'overdue' ? 'i-heroicons-exclamation-circle' : 'i-heroicons-document-text'"
                class="w-4 h-4"
              />
              {{ statusLabel(selectedInvoice.status) }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#121212] ring-1 ring-gray-800">
            <div>
              <p class="text-gray-500 text-sm mb-1">Bill to</p>
              <p class="text-white font-medium">{{ selectedInvoice.client }}</p>
              <p class="text-gray-400 text-sm mt-1">{{ selectedInvoice.project }}</p>
            </div>
            <div class="sm:text-right space-y-3">
              <div>
                <p class="text-gray-500 text-sm mb-1">Issue date</p>
                <p class="text-white">{{ new Date(selectedInvoice.issueDate).toLocaleDateString('en-US') }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-sm mb-1">Due date</p>
                <p class="text-white">{{ new Date(selectedInvoice.dueDate).toLocaleDateString('en-US') }}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 class="font-semibold mb-3">Line items</h4>
            <div class="rounded-xl overflow-hidden ring-1 ring-gray-800">
              <table class="w-full text-sm">
                <thead class="bg-[#121212] text-gray-500">
                  <tr>
                    <th class="text-left px-3 py-2 font-medium">Description</th>
                    <th class="text-right px-3 py-2 font-medium">Qty</th>
                    <th class="text-right px-3 py-2 font-medium">Rate</th>
                    <th class="text-right px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800">
                  <tr v-for="(item, idx) in selectedInvoice.items" :key="idx">
                    <td class="px-3 py-2.5 text-white">{{ item.description }}</td>
                    <td class="px-3 py-2.5 text-right text-gray-400">{{ item.quantity }}</td>
                    <td class="px-3 py-2.5 text-right text-gray-400">{{ formatMoney(item.rate) }}</td>
                    <td class="px-3 py-2.5 text-right font-medium">{{ formatMoney(item.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex justify-end">
            <div class="w-full max-w-xs space-y-2 text-sm">
              <div class="flex justify-between py-2 border-b border-gray-800">
                <span class="text-gray-500">Subtotal</span>
                <span class="text-white">{{ formatMoney(selectedInvoice.amount) }}</span>
              </div>
              <div class="flex justify-between py-2 border-b border-gray-800">
                <span class="text-gray-500">Tax (0%)</span>
                <span class="text-white">0 RON</span>
              </div>
              <div class="flex justify-between pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{{ formatMoney(selectedInvoice.amount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <template v-if="selectedInvoice">
          <UButton variant="ghost" class="ring-1 ring-gray-700" @click="selectedInvoice = null">
            Close
          </UButton>
          <UButton class="penta-btn-primary" @click="stubAction('Download PDF')">
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-2" />
            Download PDF
          </UButton>
          <UButton class="penta-btn-primary" @click="stubAction('Send to client')">
            <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4 mr-2" />
            Send to Client
          </UButton>
        </template>
      </template>
    </UModal>
  </div>
</template>
