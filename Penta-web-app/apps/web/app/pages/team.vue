<script setup lang="ts">
/**
 * Client-only: project manager + assigned workers per job, with links to chat and job detail.
 */
definePageMeta({
  middleware: ["team-client-only"],
})

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || "http://localhost:3000"

interface JobRow {
  id: number
  title: string
  status: string
  address: string
  manager?: { id: string; name: string; email?: string } | null
  worker?: { id: string; name: string; email?: string } | null
}

const { data: jobs, pending } = await useFetch<JobRow[]>(`${serverUrl}/api/jobs`, {
  credentials: "include",
})

useSeoMeta({
  title: "Your team — PentaWebApp",
  description: "Contact your project manager and assigned crew for each job.",
})
</script>

<template>
  <div class="min-h-full max-w-4xl mx-auto pb-10 text-white">
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Your team</h1>
      <p class="mt-2 text-gray-400">
        See who is managing and working on your projects. Use email to reach out, or open
        <NuxtLink to="/clients" class="penta-text-accent underline">Messages</NuxtLink>
        to chat with your project manager.
      </p>
    </div>

    <div v-if="pending" class="py-16 text-center text-gray-500">Loading…</div>

    <div v-else-if="jobs?.length" class="space-y-4">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="rounded-xl bg-[#121212] p-6 ring-1 ring-gray-800/80"
      >
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <NuxtLink :to="`/jobs/${job.id}`" class="text-lg font-semibold text-white hover:underline">
              {{ job.title }}
            </NuxtLink>
            <p class="mt-1 text-sm text-gray-500">{{ job.address }}</p>
          </div>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-gray-700 text-gray-300">
            {{ job.status.replaceAll("_", " ") }}
          </span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-lg bg-[#18181b] p-4 ring-1 ring-gray-800/60">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Project manager</p>
            <template v-if="job.manager">
              <p class="mt-1 font-medium">{{ job.manager.name }}</p>
              <a
                v-if="job.manager.email"
                :href="`mailto:${job.manager.email}`"
                class="mt-2 inline-flex text-sm penta-text-accent hover:underline"
              >{{ job.manager.email }}</a>
            </template>
            <p v-else class="mt-2 text-sm text-gray-500">Not assigned yet.</p>
          </div>

          <div class="rounded-lg bg-[#18181b] p-4 ring-1 ring-gray-800/60">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned worker</p>
            <template v-if="job.worker">
              <p class="mt-1 font-medium">{{ job.worker.name }}</p>
              <a
                v-if="job.worker.email"
                :href="`mailto:${job.worker.email}`"
                class="mt-2 inline-flex text-sm penta-text-accent hover:underline"
              >{{ job.worker.email }}</a>
            </template>
            <p v-else class="mt-2 text-sm text-gray-500">No worker assigned yet.</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <UButton :to="`/jobs/${job.id}`" variant="outline" class="ring-1 ring-gray-600 text-gray-200">
            Open job
          </UButton>
          <UButton to="/clients" variant="ghost" class="text-gray-400">
            Open messages
          </UButton>
        </div>
      </div>
    </div>

    <div v-else class="rounded-xl border border-dashed border-gray-700 bg-[#121212]/80 p-10 text-center text-gray-500 ring-1 ring-gray-800">
      No jobs yet. When your contractor adds a project, your team will appear here.
    </div>
  </div>
</template>
