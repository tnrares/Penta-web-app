<script setup lang="ts">
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

defineProps<{
  revenueChartData: ChartData<'bar'>
  chartOptions: ChartOptions<'bar'>
  donutChartData: ChartData<'doughnut'>
  donutOptions: ChartOptions<'doughnut'>
  hasRevenueData: boolean
  hasJobStatus: boolean
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
    <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-1">Revenue & Expenses</h3>
      <p class="text-gray-500 text-sm mb-4">Last 7 months performance</p>
      <div class="h-64">
        <Bar v-if="hasRevenueData" :data="revenueChartData" :options="chartOptions" />
      </div>
    </div>

    <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-lg font-semibold mb-1">Job Status</h3>
          <p class="text-gray-500 text-sm">Current distribution</p>
        </div>
        <NuxtLink to="/jobs" class="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
          View Report
        </NuxtLink>
      </div>
      <div class="h-64">
        <Doughnut v-if="hasJobStatus" :data="donutChartData" :options="donutOptions" />
      </div>
    </div>
  </div>
</template>
