<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { signUp } from "../../lib/auth-client";

const name = ref("");
const email = ref("");
const password = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const router = useRouter();

const handleRegister = async () => {
	isLoading.value = true;
	errorMessage.value = "";

	try {
		const { error } = await signUp.email({
			email: email.value,
			password: password.value,
			name: name.value,
		});

		if (error) {
			errorMessage.value = error.message || "A apărut o eroare la înregistrare.";
		} else {
			await router.push("/dashboard");
		}
	} catch {
		errorMessage.value = "Eroare de conexiune cu serverul.";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
  <div class="container">
    <h1>Creează Cont (Penta App)</h1>
    
    <form @submit.prevent="handleRegister" class="form-box">
      <div class="input-group">
        <label>Nume Complet</label>
        <input v-model="name" type="text" placeholder="Ion Popescu" required />
      </div>

      <div class="input-group">
        <label>Email</label>
        <input v-model="email" type="email" placeholder="email@firma.ro" required />
      </div>

      <div class="input-group">
        <label>Parolă</label>
        <input v-model="password" type="password" placeholder="******" required />
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Se procesează...' : 'Înregistrează-te' }}
      </button>
      
      <p class="link">
        Ai deja cont? <NuxtLink to="/login">Autentifică-te</NuxtLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.container { display: flex; flex-direction: column; align-items: center; margin-top: 50px; font-family: sans-serif; }
.form-box { display: flex; flex-direction: column; gap: 15px; width: 300px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; }
.input-group { display: flex; flex-direction: column; gap: 5px; }
input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
button { padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { background-color: #ccc; }
.error { color: red; font-size: 0.9em; }
.link { font-size: 0.9em; text-align: center; }
</style>