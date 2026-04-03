<script setup lang="ts">
import { useRoute } from 'vue-router'
import {
  getAllowedNextStatuses,
  type JobStatus,
} from "@Penta-web-app/config/job-status"

const { $authClient } = useNuxtApp()
const session = $authClient.useSession()
const userRole = computed(() => (session.value?.data?.user as { role?: string } | undefined)?.role ?? '')
const sessionUserId = computed(() => (session.value?.data?.user as { id?: string } | undefined)?.id)
const isClient = computed(() => userRole.value === 'CLIENT')
const isManager = computed(() => userRole.value === 'MANAGER')
const isAssignedWorker = computed(() => !!job.value?.worker?.id && job.value.worker.id === sessionUserId.value)
const canManagePhotos = computed(() => isManager.value || isAssignedWorker.value)
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
const customMaterialForm = ref({ materialName: '', quantityUsed: 1, unit: 'pcs', unitCostAtTime: 0 })
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
    READY_FOR_REVIEW: 72, FINALIZED: 80, CLOSED_PAID: 100, CANCELED: 0
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
  if (!confirm("Generate invoice? The job status will become FINALIZED.")) return;
  try {
    await $fetch(`${serverUrl}/api/invoices/generate`, { 
      method: 'POST', 
      body: { jobId: job.value?.id },
      credentials: 'include'
    });
    await refresh();
  } catch (e: any) { 
    alert(e?.data?.error || "Failed to generate invoice."); 
  }
}

const emailClient = () => {
  if (!job.value?.client?.email) {
    alert("The client has no email address.");
    return;
  }
  
  const subject = encodeURIComponent(`Job #${job.value.id} - ${job.value.title}`);
  const body = encodeURIComponent(
    `Hello,\n\n` +
    `We are contacting you about job #${job.value.id}: ${job.value.title}\n\n` +
    `Address: ${job.value.address}\n` +
    `Status: ${getStatusLabel(job.value.status)}\n\n` +
    `Please contact us for more details.\n\n` +
    `Best regards,\nPentaWebApp team`
  );
  
  window.location.href = `mailto:${job.value.client.email}?subject=${subject}&body=${body}`;
}

const scheduleVisit = async () => {
  const visitDate = prompt("Enter visit date and time (format: YYYY-MM-DD HH:MM):");
  if (!visitDate) return;
  
  try {
    const dateObj = new Date(visitDate);
    if (isNaN(dateObj.getTime())) {
      alert("The date entered is not valid.");
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
    alert("Visit scheduled successfully.");
  } catch (e: any) {
    alert(e?.data?.error || "Failed to schedule visit.");
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  if (!job.value?.id) {
    alert("Error: job ID is not available.");
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
      throw new Error(errorData.error || "Failed to upload document.");
    }

    await refresh();
    
    // Reset file input
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  } catch (error: any) {
    alert(error.message || "Failed to upload document.");
  } finally {
    isUploading.value = false;
  }
}

const downloadDocument = (doc: { url: string; fileName: string }) => {
  const downloadUrl = `${serverUrl}${doc.url}`;
  window.open(downloadUrl, '_blank');
}

const deleteDocument = async (documentId: string) => {
  if (!confirm("Delete this document?")) return;
  
  try {
    const response = await fetch(`${serverUrl}/api/uploads/documents/${documentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to delete document.");
    }

    await refresh();
  } catch (error: any) {
    alert(error.message || "Failed to delete document.");
  }
}

const markAsPaid = async () => {
  if (!job.value?.invoice) return;
  if (!confirm("Confirm full payment received?")) return;
  try {
    await $fetch(`${serverUrl}/api/invoices/${job.value.invoice.id}/pay`, { 
      method: 'PATCH',
      credentials: 'include'
    });
    await refresh();
  } catch(e: any) { 
    alert(e?.data?.error || "Payment failed."); 
  }
}

const claimingManager = ref(false)
async function claimAsProjectManager() {
  if (!job.value?.id) return
  claimingManager.value = true
  try {
    await $fetch(`${serverUrl}/api/jobs/${jobId}/assign`, {
      method: 'PATCH',
      credentials: 'include',
    })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.error || 'Could not link you as project manager.')
  } finally {
    claimingManager.value = false
  }
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    'PENDING_VISIT': 'text-orange-400 bg-orange-400/10 ring-orange-400/20',
    'QUOTE_SENT': 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
    'QUOTE_ACCEPTED': 'text-indigo-400 bg-indigo-400/10 ring-indigo-400/20',
    'IN_PROGRESS': 'text-teal-400 bg-teal-400/10 ring-teal-400/20',
    'READY_FOR_REVIEW': 'text-cyan-400 bg-cyan-400/10 ring-cyan-400/20',
    'FINALIZED': 'penta-status-ok',
    'CLOSED_PAID': 'penta-status-ok',
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
    'READY_FOR_REVIEW': 'Ready for review',
    'FINALIZED': 'Finalized',
    'CLOSED_PAID': 'Closed & Paid',
    'CANCELED': 'Canceled'
  }
  return map[status] || status
}

/** Plain-language next step for clients (Epic A1). */
const getClientNextStep = (status: string) => {
  const map: Record<string, string> = {
    PENDING_VISIT: 'We will schedule a site visit and follow up with a quote.',
    QUOTE_SENT: 'Please review the quote and let us know when you are ready to proceed.',
    QUOTE_ACCEPTED: 'Your quote is accepted — work will start according to the schedule.',
    IN_PROGRESS: 'Work is in progress at your site. We will keep you updated.',
    READY_FOR_REVIEW: 'Work on site is complete and is being reviewed by our team before closure.',
    FINALIZED: 'Work is complete. Invoice and payment steps are next.',
    CLOSED_PAID: 'This project is closed and paid. Thank you for working with us.',
    CANCELED: 'This project was canceled.'
  }
  return map[status] ?? 'We will update you as the project moves forward.'
}

const advancing = ref(false)

function transitionButtonLabel(from: JobStatus, to: JobStatus): string {
  if (to === "CANCELED") return "Cancel job"
  if (from === "READY_FOR_REVIEW" && to === "IN_PROGRESS") return "Send back to in progress"
  const map: Record<string, string> = {
    QUOTE_SENT: "Mark as quote sent",
    QUOTE_ACCEPTED: "Mark quote accepted",
    IN_PROGRESS: "Start work on site",
    READY_FOR_REVIEW: "Mark ready for review",
    FINALIZED: "Set finalized (no invoice)",
    CLOSED_PAID: "Mark closed & paid",
  }
  return map[to] ?? to
}

async function patchJobStatus(next: JobStatus) {
  if (next === "CANCELED" && !confirm("Cancel this job? This sets status to Canceled.")) return
  advancing.value = true
  try {
    await $fetch(`${serverUrl}/api/jobs/${jobId}`, {
      method: "PATCH",
      body: { status: next },
      credentials: "include",
    })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.error || "Could not update job status.")
  } finally {
    advancing.value = false
  }
}

type PipeCta =
  | { kind: "link"; label: string; primary?: boolean; to: string }
  | { kind: "patch"; label: string; primary?: boolean; danger?: boolean; status: JobStatus }
  | { kind: "invoice"; label: string }

const managerPipelineCtas = computed((): PipeCta[] => {
  const j = job.value
  if (!isManager.value || !j) return []
  const from = j.status as JobStatus
  if (from === "CANCELED" || from === "CLOSED_PAID") return []

  const out: PipeCta[] = []

  if (from === "PENDING_VISIT") {
    if (!j.quote) {
      out.push({
        kind: "link",
        label: "Create & send quote",
        primary: true,
        to: `/jobs/${j.id}/quote`,
      })
    }
  }

  if (
    (from === "IN_PROGRESS" || from === "READY_FOR_REVIEW") &&
    j.quote?.isAccepted &&
    !j.invoice
  ) {
    out.push({ kind: "invoice", label: "Generate invoice", primary: true })
  }

  const allowed = getAllowedNextStatuses(from)
  let firstForwardPatch = true
  for (const to of allowed) {
    if (from === "IN_PROGRESS" && to === "FINALIZED") {
      continue
    }
    if (from === "FINALIZED" && to === "CLOSED_PAID") {
      const paid =
        j.invoice != null &&
        Number(j.invoice.amountPaid) >= Number(j.invoice.totalAmount)
      if (!paid) continue
    }
    if (from === "PENDING_VISIT" && to === "QUOTE_SENT" && !j.quote) {
      continue
    }
    const isCancel = to === "CANCELED"
    out.push({
      kind: "patch",
      label: transitionButtonLabel(from, to),
      primary: !isCancel && firstForwardPatch,
      danger: isCancel,
      status: to,
    })
    if (!isCancel) firstForwardPatch = false
  }

  return out
})

async function runPipeCta(a: PipeCta) {
  if (a.kind === "patch") await patchJobStatus(a.status)
  if (a.kind === "link") await navigateTo(a.to)
  if (a.kind === "invoice") await generateInvoice()
}

// Materials CRUD
const openAddMaterial = () => {
  addMaterialMode.value = 'inventory'
  materialForm.value = { itemId: undefined, quantityUsed: 1 }
  customMaterialForm.value = { materialName: '', quantityUsed: 1, unit: 'pcs', unitCostAtTime: 0 }
  showMaterialModal.value = true
}
const addMaterial = async () => {
  if (!job.value?.id) return
  try {
    if (addMaterialMode.value === 'inventory') {
      const itemId = Number(materialForm.value.itemId)
      const qty = Number(materialForm.value.quantityUsed)
      if (!itemId) { alert('Choose a material from the list.'); return }
      if (isNaN(qty) || qty <= 0) { alert('Quantity must be greater than 0'); return }
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials`, {
        method: 'POST',
        body: { itemId, quantityUsed: qty },
        credentials: 'include'
      })
    } else {
      const { materialName, quantityUsed: qty, unit, unitCostAtTime } = customMaterialForm.value
      if (!materialName?.trim()) { alert('Material name is required.'); return }
      const q = Number(qty)
      const cost = Number(unitCostAtTime)
      if (isNaN(q) || q <= 0) { alert('Quantity must be greater than 0'); return }
      if (isNaN(cost) || cost < 0) { alert('Invalid unit cost.'); return }
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials`, {
        method: 'POST',
        body: { materialName: materialName.trim(), quantityUsed: q, unit: (unit || 'pcs').trim(), unitCostAtTime: cost },
        credentials: 'include'
      })
    }
    await refresh()
    showMaterialModal.value = false
  } catch (e: any) {
    alert(e?.data?.error || 'Failed to add material.')
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
    if (isNaN(qty) || qty < 0) { alert('Quantity must be >= 0'); return }
    if (isNaN(cost) || cost < 0) { alert('Unit cost must be >= 0'); return }
    try {
      await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/custom/${editingCustomId.value}`, {
        method: 'PATCH',
        body: { quantityUsed: qty, unitCostAtTime: cost },
        credentials: 'include'
      })
      await refresh()
      editingCustomId.value = null
    } catch (e: any) {
      alert(e?.data?.error || 'Update failed.')
    }
    return
  }
  if (editingMaterialItemId.value == null) return
  const qty = Number(editingQuantity.value)
  if (isNaN(qty) || qty < 0) { alert('Quantity must be >= 0'); return }
  try {
    await $fetch(`${serverUrl}/api/jobs/${job.value.id}/materials/${editingMaterialItemId.value}`, {
      method: 'PATCH',
      body: { quantityUsed: qty },
      credentials: 'include'
    })
    await refresh()
    editingMaterialItemId.value = null
  } catch (e: any) {
    alert(e?.data?.error || 'Update failed.')
  }
}
const cancelEditMaterial = () => { editingMaterialItemId.value = null; editingCustomId.value = null }
const removeMaterial = async (m: MaterialRow) => {
  if (!confirm('Remove this material from the job?')) return
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
    alert(e?.data?.error || 'Delete failed.')
  }
}

// Photo upload / delete
const triggerPhotoUpload = () => photoInput.value?.click()
const handlePhotoUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !job.value?.id) return
  if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return }
  isUploadingPhoto.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${serverUrl}/api/uploads/${job.value.id}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
    await refresh()
    input.value = ''
  } catch (err: any) {
    alert(err?.message || 'Failed to upload photo.')
  } finally {
    isUploadingPhoto.value = false
  }
}
const deletePhoto = async (photoId: string) => {
  if (!confirm('Delete this photo?')) return
  try {
    const res = await fetch(`${serverUrl}/api/uploads/${photoId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error')
    await refresh()
    if (lightboxPhoto.value?.id === photoId) lightboxPhoto.value = null
  } catch (err: any) {
    alert(err?.message || 'Delete failed.')
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
    alert(e?.data?.error || 'Failed to assign worker.')
  }
}
const isLightboxOpen = computed({
  get: () => !!lightboxPhoto.value,
  set: (v) => { if (!v) lightboxPhoto.value = null }
})

const quoteResponding = ref(false)
const showClientQuoteDecision = computed(
  () =>
    isClient.value &&
    job.value?.status === 'QUOTE_SENT' &&
    !!job.value?.quote &&
    job.value.quote.isAccepted !== true
)

async function respondToQuote(accepted: boolean) {
  const q = job.value?.quote
  if (!q?.id) return
  const msg = accepted
    ? 'Accept this quote? Work will proceed under these terms.'
    : 'Decline this quote? The job will be marked as canceled.'
  if (!confirm(msg)) return
  quoteResponding.value = true
  try {
    await $fetch(`${serverUrl}/api/quotes/${q.id}/respond`, {
      method: 'PATCH',
      body: { accepted },
      credentials: 'include',
    })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.error || 'Could not update the quote.')
  } finally {
    quoteResponding.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="flex justify-center items-center h-full text-gray-500">Loading job details…</div>
  
  <div v-else-if="job" class="max-w-7xl mx-auto pb-10 text-white">
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
  <UButton v-if="isManager" :to="`/jobs/${job.id}/edit`" icon="i-heroicons-pencil-square" variant="ghost" class="penta-btn-ghost-accent">
    Edit Job
  </UButton> 
  <UButton v-if="isManager" @click="deleteJob" :loading="isDeleting" icon="i-heroicons-trash" bg="red" variant="ghost" class="text-red-400 ring-1 ring-red-900/50 bg-red-950/20 hover:bg-red-900/40">
    Delete
  </UButton>
</div>
    </div>

    <template v-if="isManager">
      <JobPipelineStepper
        class="mb-4"
        :job-status="job.status"
        :quote-accepted="job.quote?.isAccepted"
      />
      <div
        v-if="job.status !== 'CANCELED' && job.status !== 'CLOSED_PAID' && managerPipelineCtas.length > 0"
        class="mb-8 flex flex-col gap-3 rounded-xl bg-[#18181b] p-4 ring-1 ring-gray-800/80"
      >
        <p class="text-sm font-medium text-gray-300">Next steps</p>
        <p class="text-xs text-gray-500">
          Move the job forward without opening Edit. Invoice generation still requires an accepted quote.
        </p>
        <div class="flex flex-wrap gap-2">
          <template v-for="(a, idx) in managerPipelineCtas" :key="idx">
            <UButton
              v-if="a.kind === 'link'"
              :to="a.to"
              class="penta-btn-primary"
              :class="!a.primary ? 'opacity-90' : ''"
            >
              {{ a.label }}
            </UButton>
            <UButton
              v-else-if="a.kind === 'invoice'"
              :loading="advancing"
              class="penta-btn-primary"
              @click="runPipeCta(a)"
            >
              {{ a.label }}
            </UButton>
            <UButton
              v-else
              :loading="advancing"
              :color="a.danger ? 'error' : undefined"
              :variant="a.primary ? 'solid' : 'outline'"
              :class="[
                a.danger ? '' : a.primary ? 'penta-btn-primary' : 'ring-1 ring-gray-700'
              ]"
              @click="runPipeCta(a)"
            >
              {{ a.label }}
            </UButton>
          </template>
        </div>
      </div>
    </template>
    <div v-else class="mb-8">
      <div class="flex justify-between text-sm mb-2">
        <span class="text-gray-400">Project Progress</span>
        <span class="text-gray-300 font-medium">{{ progressPercent }}%</span>
      </div>
      <div class="w-full bg-gray-800 rounded-full h-1.5">
        <div class="penta-progress-fill h-1.5 rounded-full transition-all duration-300" :style="{ width: `${progressPercent}%` }"></div>
      </div>
    </div>

    <div
      v-if="isAssignedWorker && job.status === 'IN_PROGRESS'"
      class="mb-6 rounded-xl bg-[#18181b] p-4 ring-1 ring-gray-800/80"
    >
      <p class="text-sm font-medium text-gray-300">Your work</p>
      <p class="text-xs text-gray-500 mt-1 mb-3">
        When work on site is finished, mark the job ready for review. A manager will finalize it or send it back to in progress.
      </p>
      <UButton
        :loading="advancing"
        class="penta-btn-primary"
        @click="patchJobStatus('READY_FOR_REVIEW')"
      >
        Mark ready for review
      </UButton>
    </div>

    <!-- Client view: where you are + contact (Epic A1) -->
    <div
      v-if="isClient"
      class="mb-8 rounded-xl border border-[var(--penta-accent)]/25 bg-[#121212] p-6 ring-1 ring-[var(--penta-accent)]/15"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Project status</p>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <span :class="['px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset', getStatusColor(job.status)]">
          {{ getStatusLabel(job.status) }}
        </span>
        <span v-if="job.estimatedEndDate" class="text-sm text-gray-400">
          Expected completion:
          <span class="text-gray-200">{{ new Date(job.estimatedEndDate).toLocaleDateString() }}</span>
        </span>
      </div>
      <p class="mt-4 text-gray-200 leading-relaxed">{{ getClientNextStep(job.status) }}</p>
      <div v-if="job.manager" class="mt-5 border-t border-gray-800 pt-4">
        <p class="text-xs text-gray-500 mb-1">Your contact</p>
        <p class="font-medium text-white">{{ job.manager.name }}</p>
        <p v-if="job.manager.email" class="text-sm text-gray-400">{{ job.manager.email }}</p>
        <UButton
          v-if="job.manager.email"
          size="sm"
          variant="ghost"
          class="mt-2 penta-text-accent"
          :href="`mailto:${job.manager.email}`"
        >
          Email project manager
        </UButton>
      </div>
    </div>

    <!-- Client: accept or decline quote (sent by contractor) -->
    <div
      v-if="showClientQuoteDecision && job.quote"
      class="mb-8 rounded-xl border border-amber-500/30 bg-[#121212] p-6 ring-1 ring-amber-500/20"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-amber-500/90">Quote awaiting your decision</p>
      <h2 class="mt-2 text-xl font-semibold text-white">Review quote</h2>
      <p class="mt-1 text-sm text-gray-400">
        Your contractor sent this quote. Accept to proceed or decline to cancel the job.
      </p>
      <div class="mt-4 overflow-x-auto rounded-lg ring-1 ring-gray-800">
        <table class="w-full min-w-[480px] text-sm">
          <thead>
            <tr class="border-b border-gray-800 bg-[#18181b] text-left text-gray-400">
              <th class="px-4 py-2">Description</th>
              <th class="px-4 py-2">Qty</th>
              <th class="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in job.quote.items" :key="line.id" class="border-b border-gray-800/80">
              <td class="px-4 py-2 text-gray-200">{{ line.description }}</td>
              <td class="px-4 py-2 text-gray-400">{{ line.quantity }}</td>
              <td class="px-4 py-2 text-right text-gray-200">{{ line.total?.toFixed(2) ?? (line.quantity * line.unitPrice).toFixed(2) }} RON</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-800 pt-4">
        <p class="text-lg font-semibold text-white">
          Total: <span class="penta-text-accent">{{ Number(job.quote.totalAmount).toFixed(2) }} RON</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            :loading="quoteResponding"
            variant="outline"
            color="error"
            class="ring-1 ring-red-900/50"
            @click="respondToQuote(false)"
          >
            Decline quote
          </UButton>
          <UButton
            :loading="quoteResponding"
            class="penta-btn-primary"
            icon="i-heroicons-check"
            @click="respondToQuote(true)"
          >
            Accept quote
          </UButton>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div class="lg:col-span-2 space-y-6">
        
        <div class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">{{ isClient ? 'Site address' : 'Client Information' }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex gap-3">
              <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-gray-400">Address</p>
                <p class="text-sm mt-1">{{ job.address }}</p>
              </div>
            </div>
            <div v-if="!isClient" class="flex gap-3">
              <UIcon name="i-heroicons-envelope" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-gray-400">Email</p>
                <p class="text-sm mt-1">{{ job.client?.email || 'N/A' }}</p>
              </div>
            </div>
            <div v-if="!isClient" class="flex gap-3">
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
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 penta-text-accent" /> Initial site assessment and planning
              </li>
              <li class="flex items-center gap-2 text-sm text-gray-300">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 penta-text-accent" /> Execution
              </li>
            </ul>
          </div>
        </div>

        <div v-if="!isClient" class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Materials Used</h3>
            <UButton icon="i-heroicons-plus" size="sm" @click="openAddMaterial" class="penta-btn-primary">
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
            <div v-if="canManagePhotos">
              <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handlePhotoUpload" />
              <UButton icon="i-heroicons-photo" size="sm" :loading="isUploadingPhoto" @click="triggerPhotoUpload" class="penta-btn-primary">
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
              <div v-if="canManagePhotos" class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <UButton icon="i-heroicons-trash" size="sm" color="error" @click.stop="deletePhoto(photo.id)" />
              </div>
            </div>
            <p v-if="!job.photos?.length" class="col-span-full text-gray-500 text-sm py-4">No photos yet.</p>
          </div>
        </div>

        <div v-if="!isManager" class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-6">Project Timeline</h3>
          <div class="relative pl-4 border-l-2 border-gray-800 space-y-8">
            <div class="relative">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 penta-text-accent" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Pending Visit
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'Done' : '-' }}
                </span>
              </div>
              </div>
            <div class="relative">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 penta-text-accent" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Quote Sent
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'Done' : '-' }}
                </span>
              </div>
            </div>
            <div class="relative" v-if="['QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon 
                  v-if="['QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 penta-text-accent" 
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
                  v-if="['IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle" 
                  class="w-5 h-5 penta-text-accent" 
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Work Started
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? (job.actualStartDate ? new Date(job.actualStartDate).toLocaleDateString() : 'Done') : '-' }}
                </span>
              </div>
            </div>
            <div class="relative" v-if="['QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon
                  v-if="['READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status)"
                  name="i-heroicons-check-circle"
                  class="w-5 h-5 penta-text-accent"
                />
                <div v-else class="w-5 h-5 rounded-full border-2 border-gray-600 bg-gray-800"></div>
              </div>
              <div class="flex justify-between items-center pl-2">
                <span :class="['text-sm', ['READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'text-gray-300' : 'text-gray-500']">
                  Ready for review
                </span>
                <span class="text-xs text-gray-500">
                  {{ ['READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID'].includes(job.status) ? 'Done' : '-' }}
                </span>
              </div>
            </div>
            <div class="relative" v-if="['FINALIZED', 'CLOSED_PAID'].includes(job.status)">
              <div class="absolute -left-[21px] bg-[#121212] rounded-full p-0.5">
                <UIcon name="i-heroicons-check-circle" class="w-5 h-5 penta-text-accent" />
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
            <label v-if="isManager || isClient">
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
                :loading="isUploading"
                class="penta-btn-primary cursor-pointer"
              >
                {{ isUploading ? 'Uploading…' : 'Upload' }}
              </UButton>
            </label>
          </div>
          <div class="space-y-3">
            <div v-if="job.documents && job.documents.length === 0" class="text-center py-6 text-gray-500 text-sm">
              No documents uploaded yet.
            </div>
            <div 
              v-for="doc in job.documents" 
              :key="doc.id" 
              class="flex justify-between items-center p-3 ring-1 ring-gray-800 rounded-lg bg-[#18181b]"
            >
              <div class="flex items-center gap-3">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6 penta-text-accent" />
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
                  title="Download"
                />
                <UButton 
                  v-if="isManager || isClient"
                  @click="deleteDocument(doc.id)" 
                  icon="i-heroicons-trash" 
                  bg="red" 
                  variant="ghost" 
                  class="text-red-400 hover:text-red-300"
                  title="Delete"
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
              <span class="penta-text-accent">{{ job.invoice?.amountPaid || '0' }} RON</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Outstanding</span>
              <span class="text-orange-400">{{ (job.invoice?.totalAmount || 0) - (job.invoice?.amountPaid || 0) }} RON</span>
            </div>
          </div>

          <UButton 
            v-if="isManager && job.invoice && job.invoice.status !== 'PAID'"
            @click="markAsPaid" 
            icon="i-heroicons-currency-dollar" 
            block 
            class="penta-btn-primary py-2.5"
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
              <UButton v-if="job.manager.email" size="xs" variant="ghost" class="mt-2 penta-text-accent" :href="`mailto:${job.manager.email}`">
                Contact Manager
              </UButton>
            </div>
            <div v-else class="p-3 ring-1 ring-gray-800 rounded-lg space-y-2">
              <p class="text-gray-500 text-sm">No project manager is linked to this job yet.</p>
              <p v-if="isManager" class="text-xs text-gray-600">
                If you already message this client, their PM may still appear here from chat; use the button below to store yourself as PM on the job.
              </p>
              <UButton
                v-if="isManager"
                size="xs"
                class="penta-btn-primary"
                :loading="claimingManager"
                @click="claimAsProjectManager"
              >
                I am the project manager — link my account
              </UButton>
            </div>
            <div v-if="job.worker" class="p-3 ring-1 ring-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Worker</p>
              <p class="font-medium">{{ job.worker.name }}</p>
              <p class="text-sm text-gray-400">{{ job.worker.email }}</p>
              <UButton v-if="job.worker.email" size="xs" variant="ghost" class="mt-2 penta-text-accent" :href="`mailto:${job.worker.email}`">
                Contact Worker
              </UButton>
            </div>
            <div v-else class="p-3 ring-1 ring-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">Worker</p>
              <p class="text-gray-500 text-sm mb-2">No worker assigned.</p>
              <UButton v-if="isManager && workersList.length > 0" size="xs" @click="showAssignWorkerModal = true" class="penta-btn-primary">
                Assign Worker
              </UButton>
            </div>
          </div>
        </div>

        <div v-if="isManager" class="bg-[#121212] ring-1 ring-gray-800/60 rounded-xl p-6">
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
            <div v-if="!isClient" class="flex justify-between items-center border-b border-gray-800 pb-2">
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
              From inventory
            </UButton>
            <UButton
              :variant="addMaterialMode === 'custom' ? 'solid' : 'ghost'"
              size="sm"
              class="flex-1"
              @click="addMaterialMode = 'custom'"
            >
              Custom material
            </UButton>
          </div>
          <template v-if="addMaterialMode === 'inventory'">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Material</label>
              <USelect
                v-model="materialForm.itemId"
                :items="inventorySelectItems"
                placeholder="Select material"
                class="w-full"
              />
              <p v-if="!inventoryItems.length" class="text-xs text-amber-500 mt-1">Add items in Inventory first.</p>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Quantity</label>
              <UInput v-model.number="materialForm.quantityUsed" type="number" min="0.01" step="any" />
            </div>
          </template>
          <template v-else>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Material name</label>
              <UInput v-model="customMaterialForm.materialName" placeholder="e.g. Cement, labor" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                <UInput v-model.number="customMaterialForm.quantityUsed" type="number" min="0.01" step="any" />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Unit</label>
                <UInput v-model="customMaterialForm.unit" placeholder="pcs, kg, m" />
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Unit cost (RON)</label>
              <UInput v-model.number="customMaterialForm.unitCostAtTime" type="number" min="0" step="0.01" />
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="showMaterialModal = false">Cancel</UButton>
        <UButton class="penta-btn-primary" @click="addMaterial">Add</UButton>
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
            placeholder="Select worker"
            class="w-full"
          />
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="showAssignWorkerModal = false">Cancel</UButton>
        <UButton class="penta-btn-primary" :disabled="!selectedWorkerId" @click="assignWorker">Assign</UButton>
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