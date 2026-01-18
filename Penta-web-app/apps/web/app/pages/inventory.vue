<script setup lang="ts">
  import { ref } from 'vue'
  
  definePageMeta({
    middleware: 'auth'
  })
  
  interface InventoryItem {
    id: number
    name: string
    unit: string
    unitCost: number
    currentStock: number
    minStockAlert: number 
  }
  
  const API_URL = 'http://localhost:3000/api/inventory'
  const isLoading = ref(false)
  
  const newItem = ref({
    name: '',
    unit: 'Buc',
    unitCost: 0,
    currentStock: 0,
    minStockAlert: 5 
  })
  
  const { data: items, refresh } = await useFetch<InventoryItem[]>(API_URL, {
    server: false 
  })
  
  const addItem = async () => {
    if (!newItem.value.name) return alert('Numele este obligatoriu!')
    
    isLoading.value = true
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem.value)
      })
  
      if (response.ok) {
        newItem.value = { name: '', unit: 'Buc', unitCost: 0, currentStock: 0, minStockAlert: 5 }
        await refresh() 
      } else {
        const err = await response.json()
        alert('Eroare: ' + JSON.stringify(err))
      }
    } catch (e) {
      alert('Eroare conexiune server.')
    } finally {
      isLoading.value = false
    }
  }
  
  const deleteItem = async (id: number) => {
  if(!confirm('Sigur ștergi acest material?')) return;
  
  try {
    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
    
    if (response.ok) {
      await refresh()
    } else {
      const err = await response.json()
      alert('Eroare: ' + (err.error || 'Nu s-a putut șterge.'))
    }
  } catch (e) {
    alert('Eroare de conexiune.')
  }
}

  </script>
  
  <template>
    <div class="page-container">
      <header class="header">
        <h1>Gestiune Inventar</h1>
        <NuxtLink to="/dashboard" class="back-link">← Dashboard</NuxtLink>
      </header>
  
      <div class="card form-card">
        <h3>Adaugă Material</h3>
        <form @submit.prevent="addItem" class="inventory-form">
          <div class="input-group">
            <label>Nume Material</label>
            <input v-model="newItem.name" placeholder="Ex: Ciment" required />
          </div>
  
          <div class="row">
            <div class="input-group">
              <label>UM</label>
              <select v-model="newItem.unit">
                <option>Buc</option>
                <option>kg</option>
                <option>L</option>
                <option>m</option>
                <option>m2</option>
              </select>
            </div>
            <div class="input-group">
              <label>Preț (RON)</label>
              <input v-model.number="newItem.unitCost" type="number" step="0.01" />
            </div>
            <div class="input-group">
              <label>Stoc</label>
              <input v-model.number="newItem.currentStock" type="number" />
            </div>
            <div class="input-group">
              <label>Alertă Stoc Minim</label>
              <input v-model.number="newItem.minStockAlert" type="number" />
            </div>
          </div>
  
          <button type="submit" :disabled="isLoading" class="btn-save">Adaugă</button>
        </form>
      </div>
  
      <div class="card">
        <table v-if="items && items.length > 0" class="data-table">
          <thead>
            <tr>
              <th>Nume</th>
              <th>Stoc</th>
              <th>Alertă la</th>
              <th>Preț</th>
              <th>Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" :class="{ 'alert-row': item.currentStock <= item.minStockAlert }">
              <td>
                {{ item.name }}
                <span v-if="item.currentStock <= item.minStockAlert" class="badge">! STOC MIC</span>
              </td>
              <td>{{ item.currentStock }} {{ item.unit }}</td>
              <td>{{ item.minStockAlert }}</td>
              <td>{{ item.unitCost }} RON</td>
              <td><button @click="deleteItem(item.id)" class="btn-delete">Șterge</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else>Nu există materiale.</p>
      </div>
    </div>
  </template>
  
  <style scoped>
  .page-container { max-width: 900px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
  .inventory-form { display: flex; flex-direction: column; gap: 15px; }
  .row { display: flex; gap: 15px; flex-wrap: wrap; }
  .input-group { flex: 1; display: flex; flex-direction: column; min-width: 120px; }
  input, select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-top: 5px; }
  .btn-save { background: #28a745; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
  .btn-delete { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
  .alert-row { background-color: #fff3cd; }
  .badge { background: red; color: white; font-size: 0.7em; padding: 2px 5px; border-radius: 3px; margin-left: 5px; }
  </style>