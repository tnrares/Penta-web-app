<script setup lang="ts">
import { useRoute } from 'vue-router'

definePageMeta({ middleware: 'auth' })

const { $authClient } = useNuxtApp()
const session = $authClient.useSession()
const route = useRoute()
const jobId = route.params.id
const isDeleting = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showMaterialModal = ref(false)
const showAssignWorkerModal = ref(false)
const lightboxPhoto = ref<{ id: string; url: string } | null>(null)
const addMaterialMode = ref<'inventory' | 'custom'>('inventory')
const materialForm = ref<{ itemId: number | undefined; quantityUsed: number }>({ itemId: undefined, quantityUsed: 1 })
const customMaterialForm = ref({ materialName: '', quantityUsed: 1, unit: 'buc', unitCostAtTime: 0 })
const editingMaterialItemId = ref<number | null>(null)
const editingCustomId = ref<string | null>(null)
const editingQuantity = ref('')
const editingUnitCost = ref('')
const photoInput = ref<HTMLInputElement | null>(null)
const isUploadingPhoto = ref(false)

interface InventoryItem { id: number; name: string; unit: string; unitCost: number }
interface WorkerOption { id: string; name: string; email: string }
const inventoryItems = ref<InventoryItem[]>([])
const inventorySelectItems = computed(() =>
  inventoryItems.value.map((i) => ({ label: `${i.name} (${i.unit})`, value: i.id }))
)
const workersList = ref<WorkerOption[]>([])
const selectedWorkerId = ref('')

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const deleteJob = async () => {
  if (!confirm("Do you want to delete this job? This action is irreversible.")) return;
  
  isDeleting.value = true;
  try {
    const response = await fetch(`${serverUrl}/api/jobs/${jobId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Error deleting the job.");
    }
    
    await navigateTo('/dashboard');
  } catch (error: any) {
    alert(error.message || "Could not delete the job. Check your permissions.");
  } finally {
    isDeleting.value = false;
  }
}
interface JobMaterial {
  jobId: number
  itemId: number
  quantityUsed: number
  unitCostAtTime: number
  item: { id: number; name: string; unit: string; unitCost: number }
}
interface JobCustomMaterial {
  id: string
  jobId: number
  materialName: string
  quantityUsed: number
  unit: string
  unitCostAtTime: number
}
interface QuoteItem { id: string; description: string; quantity: number; unitPrice: number; total: number }
interface Job {
  id: number
  title: string
  status: string
  address: string
  createdAt: string
  updatedAt?: string
  estimatedStartDate?: string | null
  estimatedEndDate?: string | null
  actualStartDate?: string | null
  actualEndDate?: string | null
  managerId?: string | null
  client?: { id: string; name: string; email: string; phone?: string | null; image?: string | null }
  manager?: { id: string; name: string; email?: string }
  worker?: { id: string; name: string; email?: string }
  quote?: { id: number; totalAmount: number; items: QuoteItem[]; isAccepted: boolean; createdAt?: string } | null
  materials?: JobMaterial[]
  customMaterials?: JobCustomMaterial[]
  photos?: { id: string; url: string; createdAt?: string }[]
  documents?: {
    id: string
    url: string
    fileName: string
    fileSize?: number | null
    mimeType?: string | null
    createdAt: string
  }[]
  invoice?: {
    id: number; totalAmount: number; amountPaid: number; status: string; issueDate: string; dueDate: string
  } | null
}

const { data: job, refresh, pending } = await useFetch<Job>(`${serverUrl}/api/jobs/${jobId}`, {
  credentials: 'include'
})

// Load inventory for materials dropdown (manager/worker only need when adding)
onMounted(async () => {
  try {
    const [invRes, workersRes] = await Promise.all([
      fetch(`${serverUrl}/api/inventory`, { credentials: 'include' }),
      fetch(`${serverUrl}/api/jobs/workers`, { credentials: 'include' })
    ])
    if (invRes.ok) inventoryItems.value = await invRes.json()
    if (workersRes.ok) workersList.value = await workersRes.json()
  } catch (_) {}
})

type MaterialRow = (JobMaterial & { type: 'inventory' }) | (JobCustomMaterial & { type: 'custom' })
const allMaterials = computed<MaterialRow[]>(() => {
  const inv = (job.value?.materials ?? []).map(m => ({ ...m, type: 'inventory' as const }))
  const custom = (job.value?.customMaterials ?? []).map(m => ({ ...m, type: 'custom' as const }))
  return [...inv, ...custom]
})
const materialsTotalCost = computed(() => {
  return allMaterials.value.reduce((sum, m) => sum + m.quantityUsed * m.unitCostAtTime, 0)
})
const progressPercent = computed(() => {
  const status = job.value?.status
  const map: Record<string, number> = {
    PENDING_VISIT: 0, QUOTE_SENT: 20, QUOTE_ACCEPTED: 40, IN_PROGRESS: 60,
    FINALIZED: 80, CLOSED_PAID: 100, CANCELED: 0
  }
  return map[status ?? ''] ?? 0
})
const jobDurationDays = computed(() => {
  const j = job.value
  if (!j) return null
  const start = j.actualStartDate ? new Date(j.actualStartDate) : (j.createdAt ? new Date(j.createdAt) : null)
  const end = j.actualEndDate ? new Date(j.actualEndDate) : (j.estimatedEndDate ? new Date(j.estimatedEndDate) : null)
  if (!start || !end) return null
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return days >= 0 ? days : null
})
const lastUpdatedText = computed(() => {
  const u = job.value?.updatedAt
  if (!u) return 'N/A'
  const d = new Date(u)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  if (diffM < 60) return `${diffM} min ago`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `${diffH} hours ago`
  return d.toLocaleDateString()
})

const generateInvoice = async () => {
  if (!confirm("Generezi factura fiscala? Statusul lucrarii va deveni FINALIZED.")) return;
  try {
    await $fetch(`${serverUrl}/api/invoices/generate`, { 
      method: 'POST', 
      body: { jobId: job.value?.id },
      credentials: 'include'
    });
    await refresh();
  } catch (e: any) { 
    alert(e?.data?.error || "Eroare la generare factură."); 
  }
}

const emailClient = () => {
  if (!job.value?.client?.email) {
    alert("Clientul nu are adresă de email.");
    return;
  }
  
  const subject = encodeURIComponent(`Lucrare #${job.value.id} - ${job.value.title}`);
  const body = encodeURIComponent(
    `Bună ziua,\n\n` +
    `Vă contactăm în legătură cu lucrarea #${job.value.id}: ${job.value.title}\n\n` +
    `Adresă: ${job.value.address}\n` +
    `Status: ${getStatusLabel(job.value.status)}\n\n` +
    `Vă rugăm să ne contactați pentru mai multe detalii.\n\n` +
    `Cu respect,\nEchipa PentaWebApp`
  );
  
  window.location.href = `mailto:${job.value.client.email}?subject=${subject}&body=${body}`;
}

const scheduleVisit = async () => {
  const visitDate = prompt("Introdu data și ora vizitei (format: YYYY-MM-DD HH:MM):");
  if (!visitDate) return;
  
  try {
    const dateObj = new Date(visitDate);
    if (isNaN(dateObj.getTime())) {
      alert("Data introdusă nu este validă.");
      return;
    }
    
    await $fetch(`${serverUrl}/api/jobs/${job.value?.id}/schedule-visit`, {
      method: 'PATCH',
      body: { 
        estimatedStartDate: dateObj.toISOString(),
        status: 'PENDING_VISIT'
      },
      credentials: 'include'
    });
    
    await refresh();
    alert("Vizita a fost programată cu succes!");
  } catch (e: any) {
    alert(e?.data?.error || "Eroare la programarea vizitei.");
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  if (!job.value?.id) {
    alert("Eroare: Job ID nu este disponibil.");
    return;
  }

  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${serverUrl}/api/uploads/documents/${job.value.id}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Eroare la încărcarea documentului.");
    }

    await refresh();
    
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  } catch (error: any) {
    alert(error.message || "Eroare la încărcarea documentului.");
  } finally {
    isUploading.value = false;
  }
}

const downloadDocument = (doc: { url: string; fileName: string }) => {
  const downloadUrl = `${serverUrl}${doc.url}`;
  window.open(downloadUrl, '_blank');
}

const deleteDocument = async (documentId: string) => {
  if (!confirm("Ești sigur că vrei să ștergi acest document?")) return;
  
  try {
    const response = await fetch(`${serverUrl}/api/uploads/documents/${documentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Eroare la ștergerea documentului.");
    }

    await refresh();
  } catch (error: any) {
    alert(error.message || "Eroare la ștergerea documentului.");
  }
}

const markAsPaid = async () => {
  if (!job.value?.invoice) return;
  if (!confirm("Confirmi ca ai incasat banii integral?")) return;
  try {
    await $fetch(`${serverUrl}/api/invoices/${job.value.invoice.id}/pay`, { 
      method: 'PATCH',
      credentials: 'include'
    });
    await refresh();
  } catch(e: any) { 
    alert(e?.data?.error || "Eroare la plată."); 
  }
}

const getStatusColor = (status: string) => {
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

// Materials CRUD
const openAddMaterial = () => {
  addMaterialMode.value = 'inventory'
  materialForm.value = { itemId: undefined, quantityUsed: 1 }
  customMaterialForm.value = { materialName: '', quantityUsed: 1, unit: 'buc', unitCostAtTime: 0 }
  showMaterialModal.value = true
}
const addMaterial = async () => {
  if (!job.value?.id) return
  try {
    if (addMaterialMode.value === 'inventory') {
      const itemId = Number(materialForm.value.itemId)
      const qty = Number(materialForm.value.quantityUsed)
      if (!itemId) { alert('Alege un material din listă.'); return }
      if (isNaN(qty) || qty <= 0) { alert('Cantitatea trebuie > 0'); return }
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials`, {
        method: 'POST',
        body: { itemId, quantityUsed: qty },
        credentials: 'include'
      })
    } else {
      const { materialName, quantityUsed: qty, unit, unitCostAtTime } = customMaterialForm.value
      if (!materialName?.trim()) { alert('Numele materialului este obligatoriu.'); return }
      const q = Number(qty)
      const cost = Number(unitCostAtTime)
      if (isNaN(q) || q <= 0) { alert('Cantitatea trebuie > 0'); return }
      if (isNaN(cost) || cost < 0) { alert('Cost unitar invalid.'); return }
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials`, {
        method: 'POST',
        body: { materialName: materialName.trim(), quantityUsed: q, unit: (unit || 'buc').trim(), unitCostAtTime: cost },
        credentials: 'include'
      })
    }
    await refresh()
    showMaterialModal.value = false
  } catch (e: any) {
    alert(e?.data?.error || 'Eroare la adăugarea materialului.')
  }
}
const startEditMaterial = (m: MaterialRow) => {
  if (m.type === 'inventory') {
    editingMaterialItemId.value = m.itemId
    editingCustomId.value = null
    editingQuantity.value = String(m.quantityUsed)
  } else {
    editingCustomId.value = m.id
    editingMaterialItemId.value = null
    editingQuantity.value = String(m.quantityUsed)
    editingUnitCost.value = String(m.unitCostAtTime)
  }
}
const saveEditMaterial = async () => {
  if (!job.value?.id) return
  if (editingCustomId.value) {
    const qty = Number(editingQuantity.value)
    const cost = Number(editingUnitCost.value)
    if (isNaN(qty) || qty < 0) { alert('Cantitatea >= 0'); return }
    if (isNaN(cost) || cost < 0) { alert('Cost unitar >= 0'); return }
    try {
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/custom/${editingCustomId.value}`, {
        method: 'PATCH',
        body: { quantityUsed: qty, unitCostAtTime: cost },
        credentials: 'include'
      })
      await refresh()
      editingCustomId.value = null
    } catch (e: any) {
      alert(e?.data?.error || 'Eroare la actualizare.')
    }
    return
  }
  if (editingMaterialItemId.value == null) return
  const qty = Number(editingQuantity.value)
  if (isNaN(qty) || qty < 0) { alert('Cantitatea trebuie >= 0'); return }
  try {
    await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/${editingMaterialItemId.value}`, {
      method: 'PATCH',
      body: { quantityUsed: qty },
      credentials: 'include'
    })
    await refresh()
    editingMaterialItemId.value = null
  } catch (e: any) {
    alert(e?.data?.error || 'Eroare la actualizare.')
  }
}
const cancelEditMaterial = () => { editingMaterialItemId.value = null; editingCustomId.value = null }
const removeMaterial = async (m: MaterialRow) => {
  if (!confirm('Ștergi acest material din lucrare?')) return
  if (!job.value?.id) return
  try {
    if (m.type === 'custom') {
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/custom/${m.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
    } else {
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/${m.itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
    }
    await refresh()
  } catch (e: any) {
    alert(e?.data?.error || 'Eroare la ștergere.')
  }
}

// Photo upload / delete
const triggerPhotoUpload = () => photoInput.value?.click()
const handlePhotoUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !job.value?.id) return
  if (!file.type.startsWith('image/')) { alert('Selectează o imagine.'); return }
  isUploadingPhoto.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${serverUrl}/api/uploads/${job.value.id}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Eroare upload')
    await refresh()
    input.value = ''
  } catch (err: any) {
    alert(err?.message || 'Eroare la încărcarea pozei.')
  } finally {
    isUploadingPhoto.value = false
  }
}
const deletePhoto = async (photoId: string) => {
  if (!confirm('Ștergi această poză?')) return
  try {
    const res = await fetch(`${serverUrl}/api/uploads/${photoId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Eroare')
    await refresh()
    if (lightboxPhoto.value?.id === photoId) lightboxPhoto.value = null
  } catch (err: any) {
    alert(err?.message || 'Eroare la ștergere.')
  }
}

// Assign worker (manager only)
const assignWorker = async () => {
  if (!selectedWorkerId.value || !job.value?.id) return
  try {
    await $fetch(`${serverUrl}/api/jobs/${job.value.id}/assign-worker`, {
      method: 'PATCH',
      body: { workerId: selectedWorkerId.value },
      credentials: 'include'
    })
    await refresh()
    showAssignWorkerModal.value = false
    selectedWorkerId.value = ''
  } catch (e: any) {
    alert(e?.data?.error || 'Eroare la asignarea worker-ului.')
  }
}
const isLightboxOpen = computed({
  get: () => !!lightboxPhoto.value,
  set: (v) => { if (!v) lightboxPhoto.value = null }
})
</script>

<template>
  <div v-if="pending" class="flex justify-center items-center h-full text-gray-500">Se încarcă detaliile...</div>
  
  <div v-else-if="job" class="max-w-7xl mx-auto pb-24 text-white">
    <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
      <div class="flex items-start gap-4">
        <NuxtLink to="/dashboard" class="mt-2 text-gray-400 hover:text-white transition-colors">
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <div>
          <h1 class="text-3xl font-bold">{{ job.title }}</h1>
          <p class="text-gray-400 text-sm mt-1">Job ID: #{{ String(job.id).padStart(6, '0') }}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
  <span :class="['px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset', getStatusColor(job.status)]">
    {{ getStatusLabel(job.status) }}
  </span>
  <UButton :to="`/jobs/${job.id}/edit`" icon="i-heroicons-pencil-square" bg="green" variant="ghost" class="text-green-400 ring-1 ring-green-900/50 bg-green-950/20 hover:bg-green-900/40">
    Edit Job
  </UButton> 
  <UButton @click="deleteJob" :loading="isDeleting" icon="i-heroicons-trash" bg="red" variant="ghost" class="text-red-400 ring-1 ring-red-900/50 bg-red-950/20 hover:bg-red-900/40">
    Delete
  </UButton>
</div>
    </div>

    <div class="mb-8">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-400">Project Progress</span>
        <span class="text-gray-300 font-medium">{{ progressPercent }}%</span>
      </div>
      <div class="w-full bg-gray-800 rounded-full h-1.5">
        <div class="bg-green-500 h-1.5 rounded-full transition-all duration-300" :style="{ width: `${progressPercent}%` }"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div class="lg:col-span-2 space-y-6">
        
        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Client Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex gap-3">
              <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-gray-400">Address</p>
                <p class="text-sm mt-1">{{ job.address }}</p>
              </div>
            </div>
            <div class="flex gap-3">
              <UIcon name="i-heroicons-envelope" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-gray-400">Email</p>
                <p class="text-sm mt-1">{{ job.client?.email || 'N/A' }}</p>
              </div>
            </div>
            <div class="flex gap-3">
              <UIcon name="i-heroicons-phone" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-gray-400">Phone</p>
                <p class="text-sm mt-1">{{ job.client?.phone || '+40 000 000 000' }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Job Details</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-800 pb-6 mb-6">
            <div>
              <p class="text-sm text-gray-400">Start Date</p>
              <div class="flex items-center gap-2 mt-1 text-sm">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-500" />
                {{ new Date(job.createdAt).toLocaleDateString() }}
              </div>
            </div>
            <div>
              <p class="text-sm text-gray-400">Expected Completion</p>
              <div class="flex items-center gap-2 mt-1 text-sm">
                <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-gray-500" />
                {{ job.estimatedEndDate ? new Date(job.estimatedEndDate).toLocaleDateString() : 'N/A' }}
              </div>
            </div>
          </div>
          
          <div class="mb-6">
            <p class="text-sm text-gray-400 mb-2">Description</p>
            <p class="text-sm leading-relaxed text-gray-300">
              Job registered. Detailed information about execution will be completed by the project manager after the visit.
            </p>
          </div>

          <div>
            <p class="text-sm text-gray-400 mb-3">Scope of Work</p>
            <ul class="space-y-2">
              <li class="flex items-center gap-2 text-sm text-gray-300">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" /> Initial site assessment and planning
              </li>
              <li class="flex items-center gap-2 text-sm text-gray-300">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" /> Execution
              </li>
            </ul>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Materials Used</h3>
            <UButton icon="i-heroicons-plus" size="sm" @click="openAddMaterial" class="bg-green-600 hover:bg-green-500 text-white">
              Add Material
            </UButton>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-400 border-b border-gray-800">
                  <th class="pb-2 pr-4">Material</th>
                  <th class="pb-2 pr-4">Qty</th>
                  <th class="pb-2 pr-4">Unit</th>
                  <th class="pb-2 pr-4">Unit cost</th>
                  <th class="pb-2">Total</th>
                  <th v-if="allMaterials.length" class="w-20"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!allMaterials.length" class="text-gray-500">
                  <td colspan="6" class="py-4">No materials recorded.</td>
                </tr>
                <tr v-for="m in allMaterials" :key="m.type === 'inventory' ? `inv-${m.itemId}` : `custom-${m.id}`" class="border-b border-gray-800/60">
                  <td class="py-2 pr-4 font-medium">{{ m.type === 'inventory' ? m.item.name : m.materialName }}</td>
                  <td class="py-2 pr-4">
                    <template v-if="(m.type === 'inventory' && editingMaterialItemId === m.itemId) || (m.type === 'custom' && editingCustomId === m.id)">
                      <input v-model="editingQuantity" type="number" min="0" step="any" class="w-20 bg-gray-800 rounded px-2 py-1 text-white text-sm" />
                      <input v-if="m.type === 'custom'" v-model="editingUnitCost" type="number" min="0" step="0.01" class="w-20 bg-gray-800 rounded px-2 py-1 text-white text-sm mt-1" placeholder="Cost" />
                      <div class="flex gap-1 mt-1">
                        <UButton size="xs" @click="saveEditMaterial">Save</UButton>
                        <UButton size="xs" variant="ghost" @click="cancelEditMaterial">Cancel</UButton>
                      </div>
                    </template>
                    <span v-else>{{ m.quantityUsed }}</span>
                  </td>
                  <td class="py-2 pr-4">{{ m.type === 'inventory' ? m.item.unit : m.unit }}</td>
                  <td class="py-2 pr-4">{{ m.unitCostAtTime }} RON</td>
                  <td class="py-2 pr-4">{{ (m.quantityUsed * m.unitCostAtTime).toFixed(2) }} RON</td>
                  <td class="py-2">
                    <template v-if="(m.type === 'inventory' && editingMaterialItemId !== m.itemId) || (m.type === 'custom' && editingCustomId !== m.id)">
                      <UButton icon="i-heroicons-pencil" size="xs" variant="ghost" class="text-gray-400" @click="startEditMaterial(m)" />
                      <UButton icon="i-heroicons-trash" size="xs" variant="ghost" class="text-red-400" @click="removeMaterial(m)" />
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="allMaterials.length" class="mt-3 text-sm text-gray-400">
            Total materials: <span class="font-medium text-white">{{ materialsTotalCost.toFixed(2) }} RON</span>
          </p>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Photos</h3>
            <div>
              <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handlePhotoUpload" />
              <UButton icon="i-heroicons-photo" size="sm" :loading="isUploadingPhoto" @click="triggerPhotoUpload" class="bg-green-600 hover:bg-green-500 text-white">
                Upload
              </UButton>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="photo in (job.photos ?? [])"
              :key="photo.id"
              class="relative group aspect-square rounded-lg overflow-hidden ring-1 ring-gray-800 bg-gray-900"
            >
              <img :src="`${serverUrl}${photo.url}`" :alt="'Photo'" class="w-full h-full object-cover cursor-pointer" @click="lightboxPhoto = photo" />
              <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <UButton icon="i-heroicons-trash" size="sm" color="error" @click.stop="deletePhoto(photo.id)" />
              </div>
            </div>
            <p v-if="!job.photos?.length" class="col-span-full text-gray-500 text-sm py-4">No photos yet.</p>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-6">Project Timeline</h3>
          <div class="relative pl-4 border-l-2 border-gray-800 space-y-8">
            <div class="relative">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 text-green-500" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Pending Visit
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'Done' : '-' }}
                </span>
              </div>
              </div>
            <div class="relative">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 text-green-500" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Quote Sent
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'Done' : '-' }}
                </span>
              </div>
            </div>
            <div class="relative" v-if="['QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['QUOTE_ACCEPTED', 'IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 text-green-500" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span class="text-sm text-gray-300">Quote Accepted</span>
                <span class="text-xs text-gray-500">Done</span>
              </div>
            </div>
            <div class="relative">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 text-green-500" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Work Started
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['IN_PROGRESS', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? (job.actualStartDate ? new Date(job.actualStartDate).toLocaleDateString() : 'Done') : '-' }}
                </span>
              </div>
            </div>
            <div class="relative" v-if="['FINALIZED', 'CLOSED_PAID'].includes(job.status)">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
              </div>
              <div class="flex justify-between items-center pl-2">
                <span class="text-sm text-gray-300">Finalized</span>
                <span class="text-xs text-gray-500">
                  {{ job.actualEndDate ? new Date(job.actualEndDate).toLocaleDateString() : 'Done' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Documents</h3>
            <label>
              <input 
                type="file" 
                ref="fileInput" 
                @change="handleFileUpload" 
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                class="hidden"
                :disabled="isUploading"
              />
              <UButton 
                as="span"
                icon="i-heroicons-plus" 
                bg="green" 
                :loading="isUploading"
                class="bg-green-500 hover:bg-green-600 text-white cursor-pointer"
              >
                {{ isUploading ? 'Se încarcă...' : 'Upload' }}
              </UButton>
            </label>
          </div>
          <div class="space-y-3">
            <div v-if="job.documents && job.documents.length === 0" class="text-center py-6 text-gray-500 text-sm">
              Nu există documente încărcate.
            </div>
            <div 
              v-for="doc in job.documents" 
              :key="doc.id" 
              class="flex justify-between items-center p-3 ring-1 ring-gray-800 rounded-lg bg-[#18181b]"
            >
              <div class="flex items-center gap-3">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-green-500" />
                <div>
                  <p class="text-sm font-medium">{{ doc.fileName }}</p>
                  <p class="text-xs text-gray-500">
                    {{ doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'N/A' }} • 
                    {{ new Date(doc.createdAt).toLocaleDateString() }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton 
                  @click="downloadDocument(doc)" 
                  icon="i-heroicons-arrow-down-tray" 
                  bg="gray" 
                  variant="ghost" 
                  class="text-gray-400 hover:text-white"
                  title="Descarcă"
                />
                <UButton 
                  @click="deleteDocument(doc.id)" 
                  icon="i-heroicons-trash" 
                  bg="red" 
                  variant="ghost" 
                  class="text-red-400 hover:text-red-300"
                  title="Șterge"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      <div class="space-y-6">
        
        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Financial Summary</h3>
          <div class="mb-6">
            <p class="text-sm text-gray-400 mb-1">
              <UIcon name="i-heroicons-currency-dollar" class="w-4 h-4 inline mr-1" />Total Quote
            </p>
            <p class="text-3xl font-bold">{{ job.quote?.totalAmount || '0.00' }} RON</p>
          </div>
          
          <div class="space-y-3 text-sm border-t border-gray-800 pt-4 mb-6">
            <div class="flex justify-between">
              <span class="text-gray-400">Paid to Date</span>
              <span class="text-green-500">{{ job.invoice?.amountPaid || '0' }} RON</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Outstanding</span>
              <span class="text-orange-400">{{ (job.invoice?.totalAmount || 0) - (job.invoice?.amountPaid || 0) }} RON</span>
            </div>
          </div>

          <UButton 
            v-if="job.invoice && job.invoice.status !== 'PAID'"
            @click="markAsPaid" 
            icon="i-heroicons-currency-dollar" 
            block 
            class="bg-green-500 hover:bg-green-600 text-white py-2.5"
          >
            Record Payment
          </UButton>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Team</h3>
          <div class="space-y-4">
            <div v-if="job.manager" class="p-3 ring-1 ring-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Manager</p>
              <p class="font-medium">{{ job.manager.name }}</p>
              <p class="text-sm text-gray-400">{{ job.manager.email }}</p>
              <UButton v-if="job.manager.email" size="xs" variant="ghost" class="mt-2 text-green-400" :href="`mailto:${job.manager.email}`">
                Contact Manager
              </UButton>
            </div>
            <div v-else class="p-3 ring-1 ring-gray-800 rounded-lg text-gray-500 text-sm">No manager assigned.</div>
            <div v-if="job.worker" class="p-3 ring-1 ring-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Worker</p>
              <p class="font-medium">{{ job.worker.name }}</p>
              <p class="text-sm text-gray-400">{{ job.worker.email }}</p>
              <UButton v-if="job.worker.email" size="xs" variant="ghost" class="mt-2 text-green-400" :href="`mailto:${job.worker.email}`">
                Contact Worker
              </UButton>
            </div>
            <div v-else class="p-3 ring-1 ring-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Worker</p>
              <p class="text-gray-500 text-sm mb-2">No worker assigned.</p>
              <UButton v-if="workersList.length > 0" size="xs" @click="showAssignWorkerModal = true" class="bg-green-600 hover:bg-green-500 text-white">
                Assign Worker
              </UButton>
            </div>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Quick Actions</h3>
          <div class="space-y-2">
            <UButton 
              v-if="!job.invoice"
              @click="generateInvoice" 
              icon="i-heroicons-document-text" 
              block 
              bg="gray" 
              variant="ghost" 
              class="justify-start ring-1 ring-gray-800 bg-[#18181b] hover:bg-gray-800 text-gray-300"
            >
              Generate Invoice
            </UButton>
            <UButton 
              @click="emailClient" 
              icon="i-heroicons-envelope" 
              block 
              bg="gray" 
              variant="ghost" 
              class="justify-start ring-1 ring-gray-800 bg-[#18181b] hover:bg-gray-800 text-gray-300"
            >
              Email Client
            </UButton>
            <UButton 
              @click="scheduleVisit" 
              icon="i-heroicons-calendar" 
              block 
              bg="gray" 
              variant="ghost" 
              class="justify-start ring-1 ring-gray-800 bg-[#18181b] hover:bg-gray-800 text-gray-300"
            >
              Schedule Visit
            </UButton>
          </div>
        </div>

        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Job Statistics</h3>
          <div class="space-y-4 text-sm">
            <div class="flex justify-between items-center border-b border-gray-800 pb-2">
              <span class="text-gray-400">Duration</span>
              <span>{{ jobDurationDays != null ? jobDurationDays + ' days' : '–' }}</span>
            </div>
            <div class="flex justify-between items-center border-b border-gray-800 pb-2">
              <span class="text-gray-400">Documents</span>
              <span>{{ job.documents?.length ?? 0 }}</span>
            </div>
            <div class="flex justify-between items-center border-b border-gray-800 pb-2">
              <span class="text-gray-400">Photos</span>
              <span>{{ job.photos?.length ?? 0 }}</span>
            </div>
            <div class="flex justify-between items-center border-b border-gray-800 pb-2">
              <span class="text-gray-400">Materials Cost</span>
              <span>{{ materialsTotalCost.toFixed(2) }} RON</span>
            </div>
            <div class="flex justify-between items-center pt-2">
              <span class="text-gray-400">Last Updated</span>
              <span class="flex items-center gap-1 text-gray-400">
                <UIcon name="i-heroicons-clock" class="w-4 h-4" /> {{ lastUpdatedText }}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Add Material Modal -->
    <UModal v-model:open="showMaterialModal" title="Add Material">
      <template #body>
        <div class="space-y-4 p-4">
          <div class="flex gap-2 border-b border-gray-800 pb-3">
            <UButton
              :variant="addMaterialMode === 'inventory' ? 'solid' : 'ghost'"
              size="sm"
              class="flex-1"
              @click="addMaterialMode = 'inventory'"
            >
              Din inventar
            </UButton>
            <UButton
              :variant="addMaterialMode === 'custom' ? 'solid' : 'ghost'"
              size="sm"
              class="flex-1"
              @click="addMaterialMode = 'custom'"
            >
              Material nou
            </UButton>
          </div>
          <template v-if="addMaterialMode === 'inventory'">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Material</label>
              <USelect
                v-model="materialForm.itemId"
                :items="inventorySelectItems"
                placeholder="Selectează material"
                class="w-full"
              />
              <p v-if="!inventoryItems.length" class="text-xs text-amber-500 mt-1">Adaugă mai întâi materiale în Inventar.</p>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Cantitate</label>
              <UInput v-model.number="materialForm.quantityUsed" type="number" min="0.01" step="any" />
            </div>
          </template>
          <template v-else>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Nume material</label>
              <UInput v-model="customMaterialForm.materialName" placeholder="ex. Ciment, Manoperă" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Cantitate</label>
                <UInput v-model.number="customMaterialForm.quantityUsed" type="number" min="0.01" step="any" />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Unitate</label>
                <UInput v-model="customMaterialForm.unit" placeholder="buc, kg, m" />
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Cost unitar (RON)</label>
              <UInput v-model.number="customMaterialForm.unitCostAtTime" type="number" min="0" step="0.01" />
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="showMaterialModal = false">Anulare</UButton>
        <UButton class="bg-green-600 hover:bg-green-500 text-white" @click="addMaterial">Adaugă</UButton>
      </template>
    </UModal>

    <!-- Assign Worker Modal -->
    <UModal v-model:open="showAssignWorkerModal" title="Assign Worker">
      <template #body>
        <div class="p-4">
          <label class="block text-sm text-gray-400 mb-2">Worker</label>
          <USelect
            v-model="selectedWorkerId"
            :items="workersList.map(w => ({ label: `${w.name} (${w.email})`, value: w.id }))"
            placeholder="Selectează worker"
            class="w-full"
          />
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="showAssignWorkerModal = false">Cancel</UButton>
        <UButton class="bg-green-600 hover:bg-green-500 text-white" :disabled="!selectedWorkerId" @click="assignWorker">Assign</UButton>
      </template>
    </UModal>

    <!-- Photo Lightbox -->
    <UModal v-model:open="isLightboxOpen" title="">
      <template #body>
        <div v-if="lightboxPhoto" class="p-2 flex justify-center bg-black">
          <img :src="`${serverUrl}${lightboxPhoto.url}`" alt="Photo" class="max-w-full max-h-[85vh] object-contain" />
        </div>
      </template>
    </UModal>
  </div>
</template>