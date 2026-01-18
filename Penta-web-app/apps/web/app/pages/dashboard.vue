<script setup lang="ts">
  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()
  
  definePageMeta({
    middleware: 'auth'
  }) 
  
  interface Job {
    id: number
    title: string
    status: string
    address: string
    createdAt: string
    client?: { name: string; email: string } // pt manager
  }
  
  const { data: jobs, refresh } = await useFetch<Job[]>('http://localhost:3000/api/jobs', {
    credentials: 'include' 
  })
  

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING_VISIT': return 'orange';
      case 'QUOTE_SENT': return 'blue';
      case 'IN_PROGRESS': return 'purple';
      case 'FINALIZED': return 'green';
      default: return 'gray';
    }
  }
  </script>
  
  <template>
    <div class="dashboard-container">
      <header class="dash-header">
        <div>
          <h1>Salut, {{ session?.data?.user?.name }}!</h1>
          <p class="role-badge">Rol: {{ (session?.data?.user as any)?.role || 'CLIENT' }}</p>
        </div>
        
        <div class="actions">
  <NuxtLink to="/request" class="btn-primary">+ Cerere Nouă</NuxtLink>
  <NuxtLink 
    v-if="(session?.data?.user as any)?.role === 'MANAGER' || (session?.data?.user as any)?.role === 'ADMIN'" 
    to="/inventory" 
    class="btn-secondary">Inventar
  </NuxtLink>
</div>
      </header>
  
      <main class="jobs-section">
        <h2>Lucrările Tale</h2>
  
        <div v-if="!jobs || jobs.length === 0" class="empty-state">
          <p>Nu ai nicio lucrare activă momentan.</p>
          <NuxtLink to="/request">Creează prima cerere aici</NuxtLink>
        </div>
  
        <div v-else class="jobs-grid">
          <div v-for="job in jobs" :key="job.id" class="job-card">
            <div class="card-header">
              <span class="job-id">#{{ job.id }}</span>
              <span class="status-badge" :style="{ backgroundColor: getStatusColor(job.status) }">
                {{ job.status.replace('_', ' ') }}
              </span>
            </div>
            
            <h3>{{ job.title }}</h3>
            <p class="address"> {{ job.address }}</p>
            
            <div v-if="job.client" class="client-info">
              <small>Client: {{ job.client.name }}</small>
            </div>
  
            <div class="card-footer">
              <small> {{ new Date(job.createdAt).toLocaleDateString() }}</small>
              <NuxtLink :to="`/jobs/${job.id}`" class="btn-details">
                  Detalii &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
      </main>
    </div>
  </template>
  
  <style scoped>
  .dashboard-container { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
  
  /* Header Styling */
  .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
  .role-badge { display: inline-block; background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; color: #555; margin-top: 5px; }
  
  .actions { display: flex; gap: 10px; }
  .btn-primary { background: #007bff; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; }
  .btn-secondary { background: white; border: 1px solid #ddd; color: #333; padding: 10px 20px; border-radius: 6px; text-decoration: none; }
  
  /* Jobs Grid */
  .jobs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  
  .job-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s; }
  .job-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
  
  .card-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
  .job-id { font-weight: bold; color: #888; }
  .status-badge { color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
  
  .address { color: #666; margin-bottom: 15px; font-size: 0.9rem; }
  .client-info { background: #f9f9f9; padding: 5px; border-radius: 4px; margin-bottom: 10px; }
  
  .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; color: #999; font-size: 0.8rem; }
  .btn-details { background: none; border: none; color: #007bff; cursor: pointer; font-weight: bold; }
  </style>