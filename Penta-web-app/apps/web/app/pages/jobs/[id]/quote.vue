<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const route = useRoute()
const router = useRouter()
const jobId = route.params.id

const items = ref([{ description: '', quantity: 1, unitPrice: 0 }])

const grandTotal = computed(() => {
  return items.value.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
})

const addRow = () => {
  items.value.push({ description: '', quantity: 1, unitPrice: 0 })
}

const removeRow = (index: number) => {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  }
}

const isSaving = ref(false)
const saveQuote = async () => {
  if (items.value.some((i) => !i.description || i.unitPrice <= 0)) {
    return alert('Fill in description and unit price for every line.')
  }

  isSaving.value = true
  try {
    const res = await fetch(`${serverUrl}/api/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ jobId, items: items.value }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to submit quote')
    }

    await res.json()
    alert('Quote sent successfully. The client can accept it on their job page.')
    router.push(`/jobs/${jobId}`)
  } catch (e: unknown) {
    const err = e as Error
    alert('Error: ' + err.message)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="min-h-full max-w-5xl mx-auto px-4 pb-12 text-white">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold">Create quote for job #{{ jobId }}</h1>
        <p class="mt-1 text-sm text-gray-400">Add line items and send the quote to the client.</p>
      </div>
      <UButton :to="`/jobs/${jobId}`" variant="ghost" class="text-gray-400 self-start sm:self-auto">
        <UIcon name="i-heroicons-arrow-left" class="mr-2 h-4 w-4" />
        Back to job
      </UButton>
    </div>

    <div class="rounded-xl bg-[#121212] p-6 ring-1 ring-gray-800/80 md:p-8">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-gray-800 text-left text-gray-400">
              <th class="pb-3 pr-4 font-medium">Description / material / labor</th>
              <th class="pb-3 pr-4 font-medium w-24">Qty</th>
              <th class="pb-3 pr-4 font-medium w-32">Unit price (RON)</th>
              <th class="pb-3 pr-4 font-medium w-28">Line total</th>
              <th class="pb-3 w-12" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in items"
              :key="index"
              class="border-b border-gray-800/60"
            >
              <td class="py-3 pr-4 align-top">
                <UInput
                  v-model="item.description"
                  placeholder="e.g. Cement bags or flooring labor"
                  class="w-full"
                  :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
                />
              </td>
              <td class="py-3 pr-4 align-top">
                <UInput
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
                />
              </td>
              <td class="py-3 pr-4 align-top">
                <UInput
                  v-model.number="item.unitPrice"
                  type="number"
                  min="0"
                  step="0.5"
                  :ui="{ base: 'bg-[#18181b] border-gray-800 text-white' }"
                />
              </td>
              <td class="py-3 pr-4 align-top font-medium text-gray-200">
                {{ (item.quantity * item.unitPrice).toFixed(2) }} RON
              </td>
              <td class="py-3 align-top">
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="error"
                  variant="ghost"
                  :disabled="items.length <= 1"
                  @click="removeRow(index)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <UButton
        variant="outline"
        class="mt-4 ring-1 ring-gray-700 text-gray-300"
        icon="i-heroicons-plus"
        @click="addRow"
      >
        Add line
      </UButton>

      <div class="mt-8 flex flex-col gap-4 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-500">Quote total</p>
          <p class="text-2xl font-bold text-white">{{ grandTotal.toFixed(2) }} RON</p>
        </div>
        <UButton
          class="penta-btn-primary px-8 py-3"
          :loading="isSaving"
          icon="i-heroicons-paper-airplane"
          @click="saveQuote"
        >
          {{ isSaving ? 'Sending…' : 'Send quote' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
