<script setup lang="ts">
import z from 'zod'
import { getPostAuthRedirect } from '~/utils/auth-redirect'
const {$authClient} = useNuxtApp()
import type { FormSubmitEvent } from '#ui/types'

const emit = defineEmits(['switchToSignUp'])

const toast = useToast()
const route = useRoute()
const loading = ref(false)

const schema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type Schema = z.output<typeof schema>

const state = reactive({
  email: '',
  password: '',
})

async function onSubmit (event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $authClient.signIn.email(
      {
        email: event.data.email,
        password: event.data.password,
      },
      {
        onSuccess: () => {
          toast.add({ title: 'Sign in successful' })
          navigateTo(getPostAuthRedirect(route.query.redirect), { replace: true })
        },
        onError: (error) => {
          toast.add({ title: 'Sign in failed', description: error.error.message })
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
      Welcome back
    </h1>
    <p class="mb-8 text-center text-base text-gray-400 sm:text-lg">
      Sign in to your workspace
    </p>

    <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
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
        Sign in
      </UButton>
    </UForm>

    <div class="mt-6 text-center">
      <UButton
        variant="link"
        size="lg"
        @click="$emit('switchToSignUp')"
        class="text-base text-gray-400 hover:text-gray-200"
      >
        Need an account? Sign up
      </UButton>
    </div>
  </div>
</template>
