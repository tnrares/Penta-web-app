<script setup lang="ts">
const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

interface Supplier {
  id: number
  name: string
  contactEmail?: string
  phone?: string | null
}

interface InventoryItem {
  id: number
  name: string
  unit: string
  unitCost: number
  currentStock: number
  minStockAlert: number
  supplierId?: number | null
  supplier?: Supplier | null
  jobMaterials?: Array<{ quantityUsed: number; job: { id: number; title: string; updatedAt: string } }>
  updatedAt?: string
}

const searchQuery = ref('')
const selectedId = ref<number | null>(null)
const addModalOpen = ref(false)
const stockModalOpen = ref(false)
const stockAction = ref<'use' | 'restock'>('use')
const stockQuantity = ref<number>(0)

const { data: items, refresh } = await useFetch<InventoryItem[]>(`${serverUrl}/api/inventory`, { credentials: 'include' })
const detailItem = ref<InventoryItem | null>(null)
const detailLoading = ref(false)

const filteredItems = computed(() => {
  const list = items.value ?? []
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return list
  return list.filter(i => i.name.toLowerCase().includes(q))
})

const stats = computed(() => {
  const list = items.value ?? []
  const inStock = list.filter(i => i.currentStock > i.minStockAlert).length
  const lowStock = list.filter(i => i.currentStock > 0 && i.currentStock <= i.minStockAlert).length
  const outOfStock = list.filter(i => i.currentStock === 0).length
  const totalValue = list.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0)
  return {
    total: list.length,
    inStock,
    lowStock,
    outOfStock,
    totalValue
  }
})

const selectedItem = computed(() => {
  if (!selectedId.value || !items.value) return null
  return items.value.find(i => i.id === selectedId.value) ?? null
})

function getStatus(item: InventoryItem) {
  if (item.currentStock === 0) return { label: 'Out of Stock', class: 'text-red-400 bg-red-400/10' }
  if (item.currentStock <= item.minStockAlert) return { label: 'Low Stock', class: 'text-amber-400 bg-amber-400/10' }
  return { label: 'In Stock', class: 'penta-status-ok' }
}

async function selectItem(id: number) {
  selectedId.value = id
  detailLoading.value = true
  detailItem.value = null
  try {
    const res = await $fetch<InventoryItem>(`${serverUrl}/api/inventory/${id}`, { credentials: 'include' })
    detailItem.value = res
  } catch {
    detailItem.value = null
  } finally {
    detailLoading.value = false
  }
}

watch(selectedId, (id) => {
  if (id) selectItem(id)
})

const newItem = ref({
  name: '',
  unit: 'Buc',
  unitCost: 0,
  currentStock: 0,
  minStockAlert: 5
})

const addPending = ref(false)
async function addItem() {
  if (!newItem.value.name.trim()) return
  addPending.value = true
  try {
    await $fetch(`${serverUrl}/api/inventory`, {
      method: 'POST',
      body: newItem.value,
      credentials: 'include'
    })
    newItem.value = { name: '', unit: 'Buc', unitCost: 0, currentStock: 0, minStockAlert: 5 }
    addModalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    alert(err?.data?.error ?? 'Eroare la adăugare')
  } finally {
    addPending.value = false
  }
}

function openStockModal(action: 'use' | 'restock') {
  stockAction.value = action
  stockQuantity.value = action === 'restock' ? 100 : 0
  stockModalOpen.value = true
}

async function submitStockChange() {
  if (!selectedId.value) return
  const q = stockAction.value === 'use' ? -Math.abs(stockQuantity.value) : Math.abs(stockQuantity.value)
  if (q === 0) return
  try {
    await $fetch(`${serverUrl}/api/inventory/${selectedId.value}/stock`, {
      method: 'PATCH',
      body: { quantity: q },
      credentials: 'include'
    })
    stockModalOpen.value = false
    await refresh()
    if (detailItem.value) await selectItem(selectedId.value)
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    alert(err?.data?.error ?? 'Eroare la actualizare stoc')
  }
}

async function deleteItem(id: number) {
  if (!confirm('Sigur ștergi acest articol?')) return
  try {
    await $fetch(`${serverUrl}/api/inventory/${id}`, { method: 'DELETE', credentials: 'include' })
    if (selectedId.value === id) selectedId.value = null
    detailItem.value = null
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { error?: string } }
    alert(err?.data?.error ?? 'Nu s-a putut șterge.')
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' })
}
</script>

<template>
  <div class="h-full flex flex-col text-white mx-auto">
    <header class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">Inventory</h1>
        <p class="text-gray-400 text-sm mt-1">Manage materials, tools, and equipment</p>
      </div>
      <UButton
        icon="i-heroicons-plus"
        label="Add Item"
        class="penta-btn-primary"
        @click="addModalOpen = true"
      />
    </header>

    <!-- Summary cards cu icoane ca în referință -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
      <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800 flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-0.5">Total Items</p>
          <p class="text-xl font-semibold">{{ stats.total }}</p>
        </div>
      </div>
      <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800 flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg penta-bg-subtle flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 penta-text-accent" />
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-0.5">In Stock</p>
          <p class="text-xl font-semibold penta-text-accent">{{ stats.inStock }}</p>
        </div>
      </div>
      <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800 flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-0.5">Low Stock</p>
          <p class="text-xl font-semibold text-amber-400">{{ stats.lowStock }}</p>
        </div>
      </div>
      <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800 flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-minus-circle" class="w-5 h-5 text-red-400" />
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-0.5">Out of Stock</p>
          <p class="text-xl font-semibold text-red-400">{{ stats.outOfStock }}</p>
        </div>
      </div>
      <div class="bg-[#18181b] rounded-xl p-4 ring-1 ring-gray-800 flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-gray-700/80 flex items-center justify-center shrink-0">
          <UIcon name="i-heroicons-currency-dollar" class="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-0.5">Total Value</p>
          <p class="text-xl font-semibold">{{ stats.totalValue.toFixed(0) }} RON</p>
        </div>
      </div>
    </div>

    <!-- Search + filter row ca în referință -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="searchQuery"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search inventory..."
        size="md"
        class="flex-1 min-w-[200px]"
        :ui="{ base: 'bg-[#18181b] border-gray-800 text-white placeholder-gray-500 ring-1 ring-gray-800' }"
      />
      <span class="text-sm text-gray-500">All Items</span>
    </div>

    <!-- List + Detail -->
    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
      <!-- Left: list -->
      <div class="bg-[#18181b] rounded-xl ring-1 ring-gray-800 overflow-hidden flex flex-col min-h-0">
        <div class="p-3 border-b border-gray-800 text-sm text-gray-500 font-medium">Items</div>
        <div class="flex-1 overflow-y-auto">
          <button
            v-for="item in filteredItems"
            :key="item.id"
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            :class="{ 'bg-gray-800/50': selectedId === item.id }"
            @click="selectItem(item.id)"
          >
            <div class="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-cube" class="w-5 h-5 text-gray-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ item.name }}</p>
              <p class="text-xs text-gray-500">{{ item.currentStock }} {{ item.unit }} · {{ item.unitCost }} RON</p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 shrink-0">Materials</span>
            <span :class="['text-xs px-2 py-0.5 rounded-full ring-1 ring-inset shrink-0', getStatus(item).class]">
              {{ getStatus(item).label }}
            </span>
          </button>
          <p v-if="!filteredItems.length" class="p-4 text-gray-500 text-sm">No items.</p>
        </div>
      </div>

      <!-- Right: detail -->
      <div class="bg-[#18181b] rounded-xl ring-1 ring-gray-800 overflow-hidden flex flex-col min-h-0">
        <template v-if="!selectedId">
          <div class="flex-1 flex items-center justify-center text-gray-500 p-6">
            Select an item from the list
          </div>
        </template>
        <template v-else-if="detailLoading">
          <div class="flex-1 flex items-center justify-center text-gray-500 p-6">Loading...</div>
        </template>
        <template v-else-if="detailItem">
          <div class="p-4 border-b border-gray-800 flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-semibold">{{ detailItem.name }}</h2>
              <span :class="['text-xs px-2 py-0.5 rounded-full ring-1 ring-inset', getStatus(detailItem).class]">
                {{ getStatus(detailItem).label }}
              </span>
            </div>
            <div class="flex gap-2">
              <UButton size="sm" variant="outline" color="primary" @click="openStockModal('use')">
                Use Stock
              </UButton>
              <UButton size="sm" class="penta-btn-primary" @click="openStockModal('restock')">
                Restock
              </UButton>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-5">
            <!-- Progress bar pentru stoc (ca în referință) -->
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-500">Current Stock</span>
                <span class="font-medium penta-text-accent">{{ detailItem.currentStock }} {{ detailItem.unit }}</span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="detailItem.currentStock <= detailItem.minStockAlert ? 'bg-amber-500' : 'bg-[var(--penta-accent)]'"
                  :style="{ width: `${Math.min(100, (detailItem.currentStock / Math.max(detailItem.minStockAlert * 2, 1)) * 100)}%` }"
                />
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">Minimum Stock</p>
              <p class="text-lg">{{ detailItem.minStockAlert }} {{ detailItem.unit }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">Unit Price</p>
              <p class="text-lg">{{ detailItem.unitCost }} RON</p>
            </div>
            <div v-if="detailItem.supplier">
              <p class="text-xs text-gray-500 mb-1">Supplier</p>
              <p class="text-lg">{{ detailItem.supplier!.name }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">Total Value</p>
              <p class="text-lg font-medium">{{ (detailItem.currentStock * detailItem.unitCost).toFixed(2) }} RON</p>
            </div>
            <div v-if="detailItem.jobMaterials?.length">
              <p class="text-xs text-gray-500 mb-2">Recent usage</p>
              <ul class="space-y-2">
                <li
                  v-for="(jm, idx) in detailItem.jobMaterials"
                  :key="idx"
                  class="flex justify-between text-sm"
                >
                  <span>{{ jm.job.title }}</span>
                  <span class="text-red-400">-{{ jm.quantityUsed }} {{ detailItem.unit }}</span>
                </li>
              </ul>
            </div>
            <div class="pt-4 border-t border-gray-800">
              <UButton color="error" variant="ghost" size="sm" @click="deleteItem(detailItem.id)">
                Delete item
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Add Item modal - folosind #body și #footer ca în jobs -->
    <UModal v-model:open="addModalOpen" title="Add Item">
      <template #body>
        <form class="space-y-4" @submit.prevent="addItem">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Name</label>
            <UInput v-model="newItem.name" placeholder="Material name" required :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Unit cost (RON)</label>
              <UInput v-model.number="newItem.unitCost" type="number" step="0.01" :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Current stock</label>
              <UInput v-model.number="newItem.currentStock" type="number" :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Unit</label>
              <select v-model="newItem.unit" class="w-full rounded-lg border border-gray-700 bg-[#18181b] text-white px-3 py-2">
                <option>Buc</option>
                <option>kg</option>
                <option>L</option>
                <option>m</option>
                <option>m2</option>
                <option>sheets</option>
                <option>pieces</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Min stock alert</label>
              <UInput v-model.number="newItem.minStockAlert" type="number" :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }" />
            </div>
          </div>
        </form>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="addModalOpen = false">Cancel</UButton>
        <UButton :loading="addPending" class="penta-btn-primary" @click="addItem">Add</UButton>
      </template>
    </UModal>

    <!-- Use Stock / Restock modal -->
    <UModal v-model:open="stockModalOpen" :title="stockAction === 'restock' ? 'Restock' : 'Use Stock'">
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Quantity</label>
            <UInput
              v-model.number="stockQuantity"
              type="number"
              :min="stockAction === 'use' ? 0 : 1"
              :placeholder="stockAction === 'restock' ? 'Quantity to add' : 'Quantity to use'"
              :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="stockModalOpen = false">Cancel</UButton>
        <UButton class="penta-btn-primary" @click="submitStockChange">Confirm</UButton>
      </template>
    </UModal>
  </div>
</template>
