<script setup lang="ts">
import z from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import { getPostAuthRedirect } from '~/utils/auth-redirect'
const {$authClient} = useNuxtApp()

const emit = defineEmits(['switchToSignIn'])

const toast = useToast()
const route = useRoute()
const loading = ref(false)

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type Schema = z.output<typeof schema>

const state = reactive({
  name: '',
  email: '',
  password: '',
})

async function onSubmit (event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $authClient.signUp.email(
      {
        name: event.data.name,
        email: event.data.email,
        password: event.data.password,
      },
      {
        onSuccess: () => {
          toast.add({ title: 'Sign up successful' })
          navigateTo(getPostAuthRedirect(route.query.redirect), { replace: true })
        },
        onError: (error) => {
          toast.add({ title: 'Sign up failed', description: error.error.message })
        },
      },
    )
  } catch (error: any) {
     toast.add({ title: 'An unexpected error occurred', description: error.message || 'Please try again.' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full py-2">
    <h1 class="mb-2 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
      Create account
    </h1>
    <p class="mb-8 text-center text-base text-gray-400 sm:text-lg">
      Get started with PentaWebApp
    </p>

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
      <UFormField label="Name" name="name">
        <UInput v-model="state.name" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Email" name="email">
        <UInput v-model="state.email" type="email" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Password" name="password">
        <UInput v-model="state.password" type="password" size="lg" class="w-full" />
      </UFormField>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="loading"
        class="penta-btn-primary mt-2 min-h-12 text-base sm:min-h-[2.75rem] sm:text-lg"
      >
        Sign up
      </UButton>
    </UForm>

    <div class="mt-6 text-center">
      <UButton
        variant="link"
        size="lg"
        @click="$emit('switchToSignIn')"
        class="text-base text-gray-400 hover:text-gray-200"
      >
        Already have an account? Sign in
      </UButton>
    </div>
  </div>
</template>
