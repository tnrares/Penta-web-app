<script setup lang="ts">
import { ref } from 'vue'

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const isLoading = ref(false)
const formData = ref({
  title: '',
  address: '',
})

const submitRequest = async () => {
  if (!formData.value.title || !formData.value.address) {
    return alert('Please fill in all fields.')
  }

  isLoading.value = true

  try {
    const response = await fetch(`${serverUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData.value),
    })

    if (response.ok) {
      alert('Request submitted successfully. A manager will contact you.')
      return navigateTo('/dashboard')
    } else {
      const err = await response.json()
      alert('Error: ' + (err.error || 'Something went wrong.'))
    }
  } catch {
    alert('Connection error.')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <div class="form-wrapper">
      <h1>Request a job</h1>
      <p class="subtitle">Describe what you need and we will send you a quote.</p>

      <form class="request-form" @submit.prevent="submitRequest">
        <div class="input-group">
          <label>What should we build or renovate?</label>
          <input
            v-model="formData.title"
            placeholder="e.g. Full renovation of a 2-room apartment"
            required
          />
        </div>

        <div class="input-group">
          <label>Job site address</label>
          <textarea
            v-model="formData.address"
            placeholder="City, street, number…"
            rows="3"
            required
          />
        </div>

        <button type="submit" class="btn-submit" :disabled="isLoading">
          {{ isLoading ? 'Sending…' : 'Submit request →' }}
        </button>
      </form>

      <NuxtLink to="/dashboard" class="cancel-link">Cancel</NuxtLink>
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
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  text-align: center;
}

h1 {
  margin-bottom: 10px;
  color: #333;
}
.subtitle {
  color: #666;
  margin-bottom: 30px;
}

.request-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: left;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
label {
  font-weight: bold;
  color: #444;
  font-size: 0.9rem;
}
input,
textarea {
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
.btn-submit:hover {
  background: #0056b3;
}
.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-link {
  display: block;
  margin-top: 20px;
  color: #888;
  text-decoration: none;
}
.cancel-link:hover {
  text-decoration: underline;
}
</style>
