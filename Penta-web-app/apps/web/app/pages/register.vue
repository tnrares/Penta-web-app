<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { signUp } from "../../lib/auth-client";
import { getPostAuthRedirect } from "~/utils/auth-redirect";

useSeoMeta({
	title: "Create account — PentaWebApp",
	description: "Create a PentaWebApp account to manage construction projects, clients, and billing.",
	robots: "noindex, nofollow",
});

const name = ref("");
const email = ref("");
const password = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const route = useRoute();
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
			errorMessage.value = error.message || "Registration failed.";
		} else {
			await router.push(getPostAuthRedirect(route.query.redirect));
		}
	} catch {
		errorMessage.value = "Could not reach the server.";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
  <div class="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-8 sm:py-16">
    <div class="mx-auto w-full max-w-lg py-2">
      <h1 class="mb-2 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Create account
      </h1>
      <p class="mb-8 text-center text-base text-gray-400 sm:text-lg">
        Get started with PentaWebApp
      </p>

      <form class="space-y-5" @submit.prevent="handleRegister">
        <div>
          <label class="mb-2 block text-base font-medium text-gray-300">Full name</label>
          <UInput v-model="name" type="text" size="lg" placeholder="Your name" class="w-full" required />
        </div>

        <div>
          <label class="mb-2 block text-base font-medium text-gray-300">Email</label>
          <UInput v-model="email" type="email" size="lg" placeholder="you@company.com" class="w-full" required />
        </div>

        <div>
          <label class="mb-2 block text-base font-medium text-gray-300">Password</label>
          <UInput v-model="password" type="password" size="lg" placeholder="••••••••" class="w-full" required />
        </div>

        <p v-if="errorMessage" class="text-sm text-red-400">
          {{ errorMessage }}
        </p>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="isLoading"
          class="penta-btn-primary mt-2 min-h-12 text-base sm:min-h-[2.75rem] sm:text-lg"
        >
          {{ isLoading ? "Creating account…" : "Create account" }}
        </UButton>
      </form>

      <div class="mt-6 text-center">
        <UButton to="/login" variant="link" size="lg" class="text-base text-gray-400 hover:text-gray-200">
          Already have an account? Sign in
        </UButton>
      </div>

      <div class="mt-10 flex justify-center gap-4 text-sm text-gray-500">
        <NuxtLink to="/privacy" class="hover:text-gray-400">Privacy</NuxtLink>
        <span aria-hidden="true">·</span>
        <NuxtLink to="/terms" class="hover:text-gray-400">Terms</NuxtLink>
      </div>
    </div>
  </div>
</template>
