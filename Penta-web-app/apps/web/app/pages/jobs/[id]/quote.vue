<script setup lang="ts">
    import { useRoute, useRouter } from 'vue-router'
    const { $authClient } = useNuxtApp()
    
    definePageMeta({ middleware: 'auth' })
    
    const route = useRoute()
    const router = useRouter()
    const jobId = route.params.id
    
    // Stare pentru rândurile ofertei
    const items = ref([
      { description: '', quantity: 1, unitPrice: 0 }
    ])
    
    // Calculăm Totalul General în timp real
    const grandTotal = computed(() => {
      return items.value.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    })
    
    // Adaugă un rând nou
    const addRow = () => {
      items.value.push({ description: '', quantity: 1, unitPrice: 0 })
    }
    
    // Șterge un rând
    const removeRow = (index: number) => {
      if (items.value.length > 1) {
        items.value.splice(index, 1)
      }
    }
    
    // Salvează Oferta
    const isSaving = ref(false)
    const saveQuote = async () => {
      // Validare simplă
      if (items.value.some(i => !i.description || i.unitPrice <= 0)) {
        return alert("Completează descrierea și prețul pentru toate rândurile.")
      }
    
      isSaving.value = true
      try {
        const res = await fetch(`http://localhost:3000/api/quotes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            jobId: jobId,
            items: items.value
          })
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Eroare la trimiterea ofertei")
        }

        const data = await res.json()
        alert("Ofertă trimisă cu succes!")
        router.push(`/jobs/${jobId}`) // Ne întoarcem la detalii
      } catch (e: any) {
        alert("Eroare: " + e.message)
      } finally {
        isSaving.value = false
      }
    }
    </script>
    
    <template>
      <div class="quote-container">
        <header>
          <h1> Creare Ofertă pentru Job #{{ jobId }}</h1>
          <NuxtLink :to="`/jobs/${jobId}`">Anulează</NuxtLink>
        </header>
    
        <div class="editor-card">
          <table class="quote-table">
            <thead>
              <tr>
                <th style="width: 50%">Descriere / Material / Manoperă</th>
                <th style="width: 15%">Cantitate</th>
                <th style="width: 15%">Preț Unitar (RON)</th>
                <th style="width: 15%">Total Linie</th>
                <th style="width: 5%"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in items" :key="index">
                <td>
                  <input v-model="item.description" placeholder="Ex: Saci Ciment sau Manoperă parchet" />
                </td>
                <td>
                  <input type="number" v-model.number="item.quantity" min="1" />
                </td>
                <td>
                  <input type="number" v-model.number="item.unitPrice" min="0" step="0.5" />
                </td>
                <td class="total-col">
                  {{ (item.quantity * item.unitPrice).toFixed(2) }} RON
                </td>
                <td>
                  <button @click="removeRow(index)" class="btn-delete" title="Șterge rând">✕</button>
                </td>
              </tr>
            </tbody>
          </table>
    
          <button @click="addRow" class="btn-add">+ Adaugă Linie</button>
    
          <div class="footer-summary">
            <h3>Total Ofertă: {{ grandTotal.toFixed(2) }} RON</h3>
            <button @click="saveQuote" :disabled="isSaving" class="btn-save">
              {{ isSaving ? 'Se trimite...' : ' Trimite Oferta' }}
            </button>
          </div>
        </div>
      </div>
    </template>
    
    <style scoped>
    .quote-container { max-width: 1000px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    
    .editor-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    
    .quote-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .quote-table th { text-align: left; padding: 10px; background: #f8f9fa; border-bottom: 2px solid #ddd; }
    .quote-table td { padding: 10px; border-bottom: 1px solid #eee; }
    
    input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
    .total-col { font-weight: bold; color: #333; }
    
    .btn-delete { background: #ffebee; color: #c62828; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold; }
    .btn-delete:hover { background: #ffcdd2; }
    
    .btn-add { background: #e3f2fd; color: #1565c0; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .btn-add:hover { background: #bbdefb; }
    
    .footer-summary { margin-top: 30px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #eee; padding-top: 20px; }
    .footer-summary h3 { font-size: 1.5rem; margin: 0; }
    
    .btn-save { background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 1.1rem; cursor: pointer; font-weight: bold; }
    .btn-save:disabled { background: #ccc; cursor: not-allowed; }
    </style>