<script setup lang="ts">
    import { useRoute } from 'vue-router'
    
    // Setăm middleware-ul de protecție
    definePageMeta({ middleware: 'auth' })
    
    const { $authClient } = useNuxtApp()
    const session = $authClient.useSession()
    
    const route = useRoute()
    const jobId = route.params.id
    
    interface Job {
      id: number
      title: string
      status: string
      address: string
      managerId?: string | null
      client?: { name: string; email: string }
      manager?: { name: string }
    }
    
    const { data: job, refresh } = await useFetch<Job>(`http://127.0.0.1:3000/api/jobs/${jobId}`, {
      credentials: 'include'
    })
    
    const assignToMe = async () => {
      if(!confirm("Piei această lucrare?")) return;
    
      try {
        await fetch(`http://localhost:3000/api/jobs/${jobId}/assign`, {
          method: 'PATCH',
          credentials: 'include'
        })
        
        await refresh() 
      } catch (e) {
        alert("Eroare la preluare. Verifică consola.")
        console.error(e)
      }
    }
    </script>
    
    <template>
      <div class="page-container" v-if="job">
        <div class="top-bar">
          <NuxtLink to="/dashboard">← Înapoi la Dashboard</NuxtLink>
          <span class="status-badge">{{ job.status }}</span>
        </div>
    
        <header class="job-header">
          <h1>{{ job.title }} <small>#{{ job.id }}</small></h1>
          
          <div v-if="!job.managerId && ((session?.data?.user as any)?.role === 'MANAGER' || (session?.data?.user as any)?.role === 'ADMIN')">
            <button @click="assignToMe" class="btn-assign"> Preia Lucrarea</button>
          </div>
          
          <div v-else-if="job.managerId === session?.data?.user?.id" class="manager-actions">
            <span class="assigned-tag"> Ești responsabil de această lucrare</span>
            <NuxtLink :to="`/jobs/${job.id}/quote`" class="btn-quote">
             Creează Ofertă
            </NuxtLink>
          </div>
        </header>
    
        <hr />
    
        <div class="details-grid">
          <div class="card">
            <h3> Locație & Client</h3>
            <p><strong>Adresă:</strong> {{ job.address }}</p>
            <p><strong>Client:</strong> {{ job.client?.name }}</p>
            <p><strong>Email:</strong> {{ job.client?.email }}</p>
          </div>
    
          <div class="card">
            <h3> Echipa</h3>
            <p v-if="job.manager"><strong>Manager Proiect:</strong> {{ job.manager.name }}</p>
            <p v-else class="text-warning"> Niciun manager asignat.</p>
          </div>
        </div>
    
      </div>
      <div v-else class="loading">Se încarcă...</div>
    </template>
    
    <style scoped>
    .page-container { max-width: 900px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
    .top-bar { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .top-bar a { text-decoration: none; color: #666; }
    
    .status-badge { background: #eee; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; }
    
    .job-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    h1 small { color: #999; font-size: 0.6em; }
    
    .btn-assign { background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem; }
    .btn-quote { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    
    .assigned-tag { color: #28a745; font-weight: bold; margin-right: 10px; display: block; margin-bottom: 5px; }
    
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .card { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .text-warning { color: orange; font-weight: bold; }
    </style>