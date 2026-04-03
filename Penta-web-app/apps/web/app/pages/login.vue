<script setup lang="ts">
import SignInForm from "~/components/SignInForm.vue";
import SignUpForm from "~/components/SignUpForm.vue";
import { getPostAuthRedirect } from "~/utils/auth-redirect";

const { $authClient } = useNuxtApp();

useSeoMeta({
  title: "Sign in — PentaWebApp",
  description: "Sign in to your PentaWebApp workspace for jobs, clients, and finances.",
  robots: "noindex, nofollow",
});

const session = $authClient.useSession();
const route = useRoute();
const showSignIn = ref(true);

watchEffect(() => {
  if (!session?.value.isPending && session?.value.data) {
    navigateTo(getPostAuthRedirect(route.query.redirect), { replace: true });
  }
});
</script>

<template>
  <div class="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-8 sm:py-16">
    <div v-if="session.isPending" class="flex min-h-[40vh] items-center justify-center">
      <Loader />
    </div>
    <div v-else-if="!session.data" class="mx-auto w-full max-w-lg">
      <SignInForm v-if="showSignIn" @switch-to-sign-up="showSignIn = false" />
      <SignUpForm v-else @switch-to-sign-in="showSignIn = true" />
      <div class="mt-10 flex justify-center gap-4 text-sm text-gray-500">
        <NuxtLink to="/privacy" class="hover:text-gray-400">Privacy</NuxtLink>
        <span aria-hidden="true">·</span>
        <NuxtLink to="/terms" class="hover:text-gray-400">Terms</NuxtLink>
      </div>
    </div>
  </div>
</template>
