<script setup lang="ts">
import { Line, Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  LineController,
  BarController,
  DoughnutController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  LineController,
  BarController,
  DoughnutController,
  Title,
  Tooltip,
  Legend
)

defineProps<{
  lineChartData: ChartData<'line'>
  lineChartOptions: ChartOptions<'line'>
  doughnutData: ChartData<'doughnut'>
  doughnutOptions: ChartOptions<'doughnut'>
  barChartData: ChartData<'bar'>
  barChartOptions: ChartOptions<'bar'>
}>()
</script>

<template>
  <div class="space-y-6">
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
      <h3 class="text-lg font-semibold mb-4">Revenue vs Expenses</h3>
      <div class="h-[300px]">
        <Line :data="lineChartData" :options="lineChartOptions" />
      </div>
    </div>
    <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
      <h3 class="text-lg font-semibold mb-4">Expenses by Category</h3>
      <div class="h-[300px]">
        <Doughnut :data="doughnutData" :options="doughnutOptions" />
      </div>
    </div>
  </div>

  <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-5">
    <h3 class="text-lg font-semibold mb-4">Monthly Performance</h3>
    <div class="h-[300px]">
      <Bar :data="barChartData" :options="barChartOptions" />
    </div>
  </div>
  </div>
</template>
