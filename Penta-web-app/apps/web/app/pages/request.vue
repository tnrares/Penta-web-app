<script setup lang="ts">
    import { ref } from 'vue'
    
    definePageMeta({
      middleware: 'auth'
    })
    
    const isLoading = ref(false)
    const formData = ref({
      title: '',
      address: ''
    })
    
    const submitRequest = async () => {
      if (!formData.value.title || !formData.value.address) {
        return alert('Completează toate câmpurile!')
      }
    
      isLoading.value = true
    
      try {
        const response = await fetch('http://localhost:3000/api/jobs', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
         
          credentials: 'include', 
          body: JSON.stringify(formData.value)
        })
    
        if (response.ok) {
          alert('Cerere trimisă cu succes! Un manager te va contacta.')
          return navigateTo('/dashboard')
        } else {
          const err = await response.json()
          alert('Eroare: ' + (err.error || 'Ceva nu a mers.'))
        }
      } catch (e) {
        alert('Eroare de conexiune.')
      } finally {
        isLoading.value = false
      }
    }
    </script>
    
    <template>
      <div class="page-container">
        <div class="form-wrapper">
          <h1>🛠️ Solicită o Lucrare</h1>
          <p class="subtitle">Descrie ce ai nevoie, iar noi îți vom trimite o ofertă.</p>
    
          <form @submit.prevent="submitRequest" class="request-form">
            <div class="input-group">
              <label>Ce dorești să construim/renovăm?</label>
              <input 
                v-model="formData.title" 
                placeholder="Ex: Renovare completă apartament 2 camere" 
                required
              />
            </div>
    
            <div class="input-group">
              <label>Adresa Lucrării</label>
              <textarea 
                v-model="formData.address" 
                placeholder="Oraș, Stradă, Număr..." 
                rows="3"
                required
              ></textarea>
            </div>
    
            <button type="submit" :disabled="isLoading" class="btn-submit">
              {{ isLoading ? 'Se trimite...' : 'Trimite Cererea ➔' }}
            </button>
          </form>
          
          <NuxtLink to="/dashboard" class="cancel-link">Anulează</NuxtLink>
        </div>
      </div>
    </template>
    
    <style scoped>
    .page-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      background-color: #f5f7fa;
      font-family: sans-serif;
    }
    
    .form-wrapper {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 500px;
      text-align: center;
    }
    
    h1 { margin-bottom: 10px; color: #333; }
    .subtitle { color: #666; margin-bottom: 30px; }
    
    .request-form { display: flex; flex-direction: column; gap: 20px; text-align: left; }
    
    .input-group { display: flex; flex-direction: column; gap: 8px; }
    label { font-weight: bold; color: #444; font-size: 0.9rem; }
    input, textarea {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      width: 100%;
      box-sizing: border-box; 
    }
    
    .btn-submit {
      background: #007bff;
      color: white;
      padding: 14px;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 10px;
    }
    .btn-submit:hover { background: #0056b3; }
    .btn-submit:disabled { background: #ccc; cursor: not-allowed; }
    
    .cancel-link {
      display: block;
      margin-top: 20px;
      color: #888;
      text-decoration: none;
    }
    .cancel-link:hover { text-decoration: underline; }
    </style>