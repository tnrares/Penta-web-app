<script setup lang="ts">
useSeoMeta({
	title: "Privacy policy — PentaWebApp",
	description:
		"How PentaWebApp handles personal data, cookies, and your rights under GDPR.",
	ogTitle: "Privacy policy — PentaWebApp",
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-12 text-left text-gray-300 sm:px-8 sm:py-16">
    <h1 class="mb-2 text-3xl font-bold text-white sm:text-4xl">Privacy policy</h1>
    <p class="mb-10 text-sm text-gray-500">Last updated: April 2026. This is a placeholder for a production policy.</p>

    <section class="mb-10 space-y-4">
      <h2 class="text-xl font-semibold text-white">Who we are</h2>
      <p>
        PentaWebApp provides software for construction and project operations. This page describes how we process
        personal data when you use the service.
      </p>
    </section>

    <section class="mb-10 space-y-4">
      <h2 class="text-xl font-semibold text-white">Data we collect</h2>
      <p>We may process account data (name, email), usage data, and content you add (e.g. jobs, clients, messages).</p>
      <p>Technical logs may include IP address and browser type for security and reliability.</p>
    </section>

    <section class="mb-10 space-y-4">
      <h2 class="text-xl font-semibold text-white">Legal basis &amp; retention</h2>
      <p>
        Processing is based on contract, legitimate interest, or consent where required. Data is kept only as long as
        needed for the service or legal obligations.
      </p>
    </section>

    <section class="mb-10 space-y-4">
      <h2 class="text-xl font-semibold text-white">Your rights</h2>
      <p>
        Depending on applicable law, you may request access, correction, deletion, restriction, or portability. You
        may also object to certain processing. Account deletion may be available in your settings.
      </p>
    </section>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold text-white">Contact</h2>
      <p>For privacy questions, contact your organization administrator or the email shown in your deployment.</p>
    </section>

    <p class="mt-12 text-center text-sm text-gray-500">
      <NuxtLink to="/terms" class="penta-text-accent hover:underline">Terms of service</NuxtLink>
      ·
      <NuxtLink to="/" class="hover:text-gray-300">Home</NuxtLink>
    </p>
  </div>
</template>
