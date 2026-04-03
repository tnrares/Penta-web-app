<script setup lang="ts">
import {
  getPipelineStepsVisual,
  type JobStatus,
} from "@Penta-web-app/config/job-status";

const props = defineProps<{
  jobStatus: string
  quoteAccepted?: boolean
}>()

const steps = computed(() =>
  getPipelineStepsVisual(props.jobStatus as JobStatus, {
    isAccepted: props.quoteAccepted,
  })
)

const isCanceled = computed(() => props.jobStatus === "CANCELED")

function stepCircleClass(step: {
  completed: boolean
  current: boolean
  mergedSkipped?: boolean
}) {
  if (isCanceled.value) return "bg-gray-800 ring-1 ring-gray-700 text-gray-500"
  if (step.completed) return "bg-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-300"
  if (step.current) return "bg-blue-500/20 ring-1 ring-blue-500/50 text-blue-300"
  return "bg-gray-800 ring-1 ring-gray-700 text-gray-500"
}
</script>

<template>
  <div class="rounded-xl bg-[#121212] p-5 ring-1 ring-gray-800/60">
    <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="text-lg font-semibold text-white">Job pipeline</h3>
      <p v-if="isCanceled" class="text-sm text-red-400">This job is canceled.</p>
      <p v-else class="text-sm text-gray-500">Track progress through each stage.</p>
    </div>

    <div class="overflow-x-auto pb-2">
      <ol class="flex min-w-[760px] items-start gap-0">
        <li
          v-for="(step, index) in steps"
          :key="step.key"
          class="flex flex-1 flex-col items-center"
        >
          <div class="flex w-full items-center">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              :class="stepCircleClass(step)"
            >
              <UIcon
                v-if="step.completed && !step.current"
                name="i-heroicons-check"
                class="h-5 w-5"
              />
              <span v-else class="px-1 text-center leading-tight">{{ index + 1 }}</span>
            </div>
            <div
              v-if="index < steps.length - 1"
              class="mx-1 h-0.5 min-w-[12px] flex-1"
              :class="
                step.completed && steps[index + 1]?.completed
                  ? 'bg-emerald-600/50'
                  : step.completed
                    ? 'bg-gradient-to-r from-emerald-600/50 to-gray-700'
                    : 'bg-gray-800'
              "
            />
          </div>
          <p
            class="mt-2 max-w-[100px] text-center text-[11px] leading-tight text-gray-400 sm:max-w-none sm:text-xs"
          >
            {{ step.label }}
          </p>
          <p
            v-if="step.mergedSkipped"
            class="mt-0.5 text-center text-[10px] text-gray-500"
          >
            (via client accept)
          </p>
        </li>
      </ol>
    </div>
  </div>
</template>
