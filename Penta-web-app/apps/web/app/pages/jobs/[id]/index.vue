<script setup lang="ts">
  import { useRoute } from 'vue-router'
  
  definePageMeta({ middleware: 'auth' })
  
  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()
  const route = useRoute()
  const jobId = route.params.id
  
  interface QuoteItem {
    description: string
    quantity: number
    unitPrice: number
    total: number
  }
  
  interface Quote {
    id: number
    totalAmount: number
    items: QuoteItem[]
    isAccepted: boolean
  }

  interface JobPhoto {
  id: string
  url: string
}

  interface Job {
    id: number
    title: string
    status: string
    address: string
    managerId?: string | null
    client?: { name: string; email: string }
    manager?: { name: string }
    quote?: Quote | null
    photos?: JobPhoto[]

    invoice?: {
    id: number
    totalAmount: number
    amountPaid: number
    status: string 
    issueDate: string
    dueDate: string
  } | null
  }
  
  

  const config = useRuntimeConfig()
  const serverUrl = config.public.serverURL || 'http://localhost:3000'

  const { data: job, refresh } = await useFetch<Job>(`${serverUrl}/api/jobs/${jobId}`, {
    credentials: 'include'
  })
  const assignToMe = async () => {
    if(!confirm("Acceptați această lucrare?")) return;
    try {
      await $fetch(`${serverUrl}/api/jobs/${jobId}/assign`, { 
        method: 'PATCH',
        credentials: 'include'
      })
      await refresh() 
    } catch (e) { alert("Eroare.") }
  }
  
  const respondToQuote = async (accepted: boolean) => {
  if (!job.value?.quote) return;
  
  const action = accepted ? "accepți" : "refuzi";
  if (!confirm(`Ești sigur că vrei să ${action} oferta?`)) return;

  try {
    const response = await fetch(`${serverUrl}/api/quotes/${job.value.quote.id}/respond`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accepted }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
      throw new Error(error.error || `Eroare ${response.status}`);
    }
    
    await refresh();
  } catch (e: any) {
    alert(e.message || "Eroare la trimiterea răspunsului.");
  }
}
const isUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  
  if (!job.value) {
    alert("Job-ul nu este încărcat.");
    return;
  }

  const file = input.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append("file", file);

  isUploading.value = true;

  try {
    const response = await fetch(`${serverUrl}/api/uploads/${job.value.id}`, {
      method: "POST",
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error("Eroare la upload.");
    }
    
    if (fileInput.value) fileInput.value.value = "";
    await refresh();
  } catch (e) {
    alert("Eroare la upload.");
    console.error(e);
  } finally {
    isUploading.value = false;
  }
};

const deletePhoto = async (photoId: string) => {
  if (!confirm("Ești sigur că vrei să ștergi această poză?")) return;

  try {
    const response = await fetch(`${serverUrl}/api/uploads/${photoId}`, {
      method: "DELETE",
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
      throw new Error(error.error || `Eroare ${response.status}`);
    }
    
    await refresh();
  } catch (e: any) {
    alert(e.message || "Eroare la ștergerea pozei.");
    console.error(e);
  }
};

const generateInvoice = async () => {
  if (!confirm("Generezi factura fiscală? Statusul lucrării va deveni COMPLETED.")) return;
  
  try {
    const response = await fetch(`${serverUrl}/api/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId: job.value?.id }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
      throw new Error(error.error || `Eroare ${response.status}`);
    }
    
    await refresh();
  } catch (e: any) {
    alert(e.message || "Eroare la generare.");
  }
}

const markAsPaid = async () => {
  if (!job.value?.invoice) return;
  if (!confirm("Confirm că ai încasat banii integral?")) return;

  try {
    await $fetch(`${serverUrl}/api/invoices/${job.value.invoice.id}/pay`, { 
      method: 'PATCH' 
    });
    await refresh();
  } catch(e) { 
    alert("Eroare la plată."); 
  }
}
  </script>
  
  <template>
    <div class="page-container" v-if="job">
      <div class="top-bar">
        <NuxtLink to="/dashboard">← Înapoi la Dashboard</NuxtLink>
        <span class="status-badge" :class="job.status">{{ job.status }}</span>
      </div>
  
      <header class="job-header">
        <h1>{{ job.title }} <small>#{{ job.id }}</small></h1>
        
        <div v-if="!job.managerId && (session?.data?.user as any)?.role === 'MANAGER'">
          <button @click="assignToMe" class="btn-assign"> Preia Lucrarea</button>
        </div>
        
        <div v-else-if="job.managerId === session?.data?.user?.id">
          <span class="assigned-tag"> Ești managerul lucrării</span>
          <NuxtLink v-if="!job.quote" :to="`/jobs/${job.id}/quote`" class="btn-quote">📝 Creează Ofertă</NuxtLink>
        </div>
      </header>
  
      <hr />
  
      <div class="details-grid">
        <div class="card">
          <h3>Locație & Client</h3>
          <p><strong>Adresă:</strong> {{ job.address }}</p>
          <p><strong>Client:</strong> {{ job.client?.name }}</p>
        </div>
        <div class="card">
          <h3>Echipa</h3>
          <p v-if="job.manager"><strong>Manager:</strong> {{ job.manager.name }}</p>
          <p v-else class="text-warning">Se caută manager...</p>
        </div>
      </div>
  
      <div v-if="job.quote" class="quote-section">
        <div class="quote-header">
          <h2>Ofertă Propusă</h2>
          <div class="quote-total">
            Total: {{ job.quote.totalAmount.toFixed(2) }} RON
          </div>
        </div>
  
        <table class="quote-table">
          <thead>
            <tr>
              <th>Serviciu / Material</th>
              <th>Cant.</th>
              <th>Preț Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in job.quote.items" :key="idx">
              <td>{{ item.description }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.unitPrice }}</td>
              <td>{{ item.total }}</td>
            </tr>
          </tbody>
        </table>
  
        <div v-if="(session?.data?.user as any)?.role === 'CLIENT' && !job.quote.isAccepted" class="client-actions">
          <p>Ești de acord cu această ofertă?</p>
          <div class="buttons">
            <button @click="respondToQuote(true)" class="btn-accept">Acceptă Oferta</button>
            <button @click="respondToQuote(false)" class="btn-reject">Refuză Oferta</button>
          </div>
        </div>
  
        <div v-if="job.quote.isAccepted" class="accepted-banner">
          Oferta a fost acceptată! Urmează începerea lucrărilor.
        </div>
      </div>
      <div class="card mt-4">
      <h3> Galerie Foto (Vizită & Execuție)</h3>
      
      <div v-if="job.photos && job.photos.length > 0" class="photo-grid">
        <div v-for="photo in job.photos" :key="photo.id" class="photo-item">
          <img :src="`${serverUrl}${photo.url}`" alt="Poza lucrare" />
          <button 
            v-if="(session?.data?.user as any)?.role === 'MANAGER' || job.managerId === session?.data?.user?.id"
            @click="deletePhoto(photo.id)"
            class="btn-delete-photo"
            title="Șterge poză">×</button>
        </div>
      </div>
      <p v-else class="text-muted">Nu există poze încă.</p>

      <div v-if="(session?.data?.user as any)?.role === 'MANAGER' || job.managerId === session?.data?.user?.id" class="upload-section">
        <label class="btn-upload" :class="{ disabled: isUploading }">
          {{ isUploading ? 'Se încarcă...' : ' Adaugă Poză' }}
          <input 
            type="file" 
            ref="fileInput" 
            accept="image/*" 
            @change="handleFileUpload" 
            style="display: none;" 
            :disabled="isUploading"
          />
        </label>
      </div>
    </div>
    <div v-if="job.quote?.isAccepted" class="invoice-section mt-4">
      
      <div v-if="!job.invoice">
        <div v-if="(session?.data?.user as any)?.role === 'MANAGER' || (session?.data?.user as any)?.role === 'ADMIN'" class="invoice-actions">
           <h3> Lucrare Finalizată?</h3>
           <p>Emite factura pentru a închide lucrarea și a cere plata.</p>
           <button @click="generateInvoice" class="btn-invoice"> Emite Factura</button>
        </div>
        <div v-else>
            <p> Lucrarea este în desfășurare. Se așteaptă factura finală.</p>
        </div>
      </div>

      <div v-else-if="job.invoice" class="invoice-card">
        <div class="invoice-header">
            <h2> Factura #{{ job.invoice.id }}</h2>
            <span class="status-badge" :class="job.invoice.status">
              {{ job.invoice.status === 'PAID' ? 'PLĂTITĂ' : 'NEPLĂTITĂ' }}
            </span>
        </div>
        
        <div class="invoice-body">
          <p><strong>Total de Plată:</strong> <span class="amount">{{ job.invoice.totalAmount }} RON</span></p>
          <p><strong>Achitat:</strong> {{ job.invoice.amountPaid }} RON</p>
          <p><strong>Data Scadentă:</strong> {{ new Date(job.invoice.dueDate).toLocaleDateString() }}</p>
        </div>
        
        <div v-if="job.invoice.status === 'UNPAID' && ((session?.data?.user as any)?.role === 'MANAGER' || (session?.data?.user as any)?.role === 'ADMIN')">
            <hr>
            <button @click="markAsPaid" class="btn-pay"> Marchează ca Plătit</button>
        </div>
      </div>
    </div>
    </div>
    <div v-else class="loading">Se încarcă...</div>
  </template>
  
  <style scoped>
  .page-container { max-width: 900px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
  .top-bar { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .job-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .btn-assign { background: #28a745; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
  .btn-quote { background: #007bff; color: white; padding: 10px; border-radius: 6px; text-decoration: none; }
  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .card { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
  
  /*OFERTA */
  .quote-section { background: #fff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 25px; margin-top: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
  .quote-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px; }
  .quote-total { font-size: 1.5rem; font-weight: bold; color: #2c3e50; }
  
  .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  .quote-table th { text-align: left; padding: 12px; background: #f9f9f9; color: #666; }
  .quote-table td { padding: 12px; border-bottom: 1px solid #eee; }
  
  .client-actions { background: #f0f7ff; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #cce5ff; }
  .client-actions p { margin: 0 0 15px 0; font-size: 1.1rem; font-weight: bold; }
  .buttons { display: flex; justify-content: center; gap: 20px; }
  
  .btn-accept { background: #28a745; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: bold; transition: transform 0.2s; }
  .btn-accept:hover { transform: scale(1.05); background: #218838; }
  
  .btn-reject { background: #dc3545; color: white; border: none; padding: 12px 30px; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: bold; }
  
  .accepted-banner { background: #d4edda; color: #155724; padding: 20px; text-align: center; border-radius: 8px; font-weight: bold; border: 1px solid #c3e6cb; }
  
  .status-badge.QUOTE_SENT { color: #007bff; background: #e7f1ff; }

  .mt-4 { margin-top: 20px; }
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px; }
.photo-item { position: relative; }
.photo-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; }
.text-muted { color: #888; font-style: italic; }

.btn-delete-photo {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(220, 53, 69, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: background 0.2s;
}
.btn-delete-photo:hover {
  background: rgba(220, 53, 69, 1);
}

.btn-upload {
  display: inline-block;
  background: #6f42c1; /* Mov */
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-upload:hover { background: #5a32a3; }
.btn-upload.disabled { opacity: 0.7; cursor: not-allowed; }

.invoice-section { 
  margin-top: 30px; 
}

/* Buton Generare */
.btn-invoice { 
  background: #6f42c1; 
  color: white; 
  border: none; 
  padding: 12px 25px; 
  border-radius: 6px; 
  cursor: pointer; 
  font-size: 1rem;
  font-weight: bold;
}
.btn-invoice:hover { background: #5a32a3; }

/* Card Factură */
.invoice-card {
  background: white;
  border: 2px solid #ddd;
  border-left: 8px solid #333; /* Linie neagră decorativă */
  border-radius: 8px;
  padding: 25px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 15px;
}

.amount {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2c3e50;
}

/* Status Badges */
.status-badge.UNPAID { background: #ffeeba; color: #856404; border: 1px solid #ffeeba; padding: 5px 10px; border-radius: 4px;}
.status-badge.PAID { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; padding: 5px 10px; border-radius: 4px;}

/* Buton Plată */
.btn-pay {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;
  font-weight: bold;
}
.btn-pay:hover { background: #218838; }
  </style>