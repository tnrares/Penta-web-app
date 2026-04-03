<script setup lang="ts">
import { reactive, watch, nextTick } from 'vue'

const config = useRuntimeConfig()
const serverUrl = config.public.serverURL || 'http://localhost:3000'

const toast = useToast()
const colorMode = useColorMode()
const { $authClient } = useNuxtApp()
const { applyAccentByName, ACCENT_PALETTE } = useAppAccent()

const inputUi = {
  root: 'w-full',
  base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 focus:ring-[var(--penta-accent)]'
}
const textareaUi = {
  root: 'w-full',
  base: 'bg-[#121212] ring-1 ring-gray-800 text-white placeholder-gray-500 focus:ring-[var(--penta-accent)]'
}
const selectUi = { base: 'bg-[#121212] ring-1 ring-gray-800 w-full' }

type SectionId = 'profile' | 'company' | 'notifications' | 'appearance' | 'security' | 'billing'

const activeSection = ref<SectionId>('profile')
const saving = ref(false)
const isHydrating = ref(true)
const avatarInputRef = ref<HTMLInputElement | null>(null)

const showDeleteModal = ref(false)
const deletePassword = ref('')

interface SettingsApi {
  profile: {
    firstName: string
    lastName: string
    email: string
    phone: string
    jobTitle: string
    bio: string
    image: string | null
  }
  company: {
    name: string
    businessType: string
    taxId: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
    phone: string
    email: string
    website: string
  }
  notifications: Record<string, boolean>
  appearance: {
    accentColor: string
    compactMode: boolean
    theme: 'dark' | 'light' | 'auto'
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: string
    passwordLastChanged: string
  }
}

const { data: settingsData, refresh: refreshSettings } = await useFetch<SettingsApi>(`${serverUrl}/api/settings`, {
  credentials: 'include',
  key: 'user-settings'
})

const sections: { id: SectionId; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'i-heroicons-user' },
  { id: 'company', label: 'Company', icon: 'i-heroicons-building-office-2' },
  { id: 'notifications', label: 'Notifications', icon: 'i-heroicons-bell' },
  { id: 'appearance', label: 'Appearance', icon: 'i-heroicons-swatch' },
  { id: 'security', label: 'Security', icon: 'i-heroicons-shield-check' },
  { id: 'billing', label: 'Billing', icon: 'i-heroicons-credit-card' }
]

const profileSettings = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  bio: '',
  image: null as string | null
})

const companySettings = reactive({
  name: '',
  businessType: 'General Contractor',
  taxId: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  phone: '',
  email: '',
  website: ''
})

const notificationSettings = reactive({
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  jobUpdates: true,
  paymentAlerts: true,
  teamMessages: true,
  inventoryAlerts: true,
  weeklyReports: true,
  monthlyReports: false
})

const appearanceSettings = reactive({
  theme: 'dark' as 'dark' | 'light' | 'auto',
  accentColor: 'green',
  compactMode: false
})

const securitySettings = reactive({
  twoFactorEnabled: false,
  sessionTimeout: '30',
  passwordLastChanged: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

function applyFromApi(d: SettingsApi) {
  Object.assign(profileSettings, d.profile)
  Object.assign(companySettings, d.company)
  Object.assign(notificationSettings, d.notifications)
  appearanceSettings.accentColor = d.appearance.accentColor
  appearanceSettings.compactMode = d.appearance.compactMode
  appearanceSettings.theme = d.appearance.theme
  colorMode.preference = d.appearance.theme === 'auto' ? 'system' : d.appearance.theme

  securitySettings.twoFactorEnabled = d.security.twoFactorEnabled
  securitySettings.sessionTimeout = d.security.sessionTimeout
  securitySettings.passwordLastChanged = d.security.passwordLastChanged

  applyAccentByName(appearanceSettings.accentColor)
}

watch(
  settingsData,
  (d) => {
    if (!d) return
    isHydrating.value = true
    applyFromApi(d)
    nextTick(() => {
      isHydrating.value = false
    })
  },
  { immediate: true }
)

/** Sync theme picker when color mode changes elsewhere (e.g. header toggle) */
watch(
  () => colorMode.preference,
  (pref) => {
    if (isHydrating.value) return
    if (pref === 'system') appearanceSettings.theme = 'auto'
    else if (pref === 'dark' || pref === 'light') appearanceSettings.theme = pref
  }
)

function setAppearanceTheme(t: 'dark' | 'light' | 'auto') {
  appearanceSettings.theme = t
  colorMode.preference = t === 'auto' ? 'system' : t
}

function formatPasswordDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' })
  } catch {
    return '—'
  }
}

async function patchSettings(body: Record<string, unknown>) {
  await $fetch(`${serverUrl}/api/settings`, {
    method: 'PATCH',
    credentials: 'include',
    body
  })
}

async function saveCurrentSection() {
  const section = activeSection.value
  if (section === 'billing') {
    toast.add({ title: 'Billing', description: 'Use the actions on this page (upgrade, download).', color: 'neutral' })
    return
  }

  saving.value = true
  try {
    switch (section) {
      case 'profile':
        await patchSettings({
          section: 'profile',
          firstName: profileSettings.firstName,
          lastName: profileSettings.lastName,
          email: profileSettings.email,
          phone: profileSettings.phone,
          jobTitle: profileSettings.jobTitle,
          bio: profileSettings.bio
        })
        await ($authClient as { updateUser?: (x: { name: string }) => Promise<unknown> }).updateUser?.({
          name: [profileSettings.firstName, profileSettings.lastName].filter(Boolean).join(' ').trim() || profileSettings.email
        })
        break
      case 'company':
        await patchSettings({
          section: 'company',
          name: companySettings.name,
          businessType: companySettings.businessType,
          taxId: companySettings.taxId,
          address: companySettings.address,
          city: companySettings.city,
          state: companySettings.state,
          zipCode: companySettings.zipCode,
          country: companySettings.country,
          phone: companySettings.phone,
          email: companySettings.email,
          website: companySettings.website
        })
        break
      case 'notifications':
        await patchSettings({
          section: 'notifications',
          notifications: { ...notificationSettings }
        })
        break
      case 'appearance':
        await patchSettings({
          section: 'appearance',
          accentColor: appearanceSettings.accentColor,
          compactMode: appearanceSettings.compactMode,
          theme: appearanceSettings.theme
        })
        break
      case 'security':
        await patchSettings({
          section: 'security',
          twoFactorEnabled: securitySettings.twoFactorEnabled,
          sessionTimeout: securitySettings.sessionTimeout
        })
        break
    }
    await refreshSettings()
    toast.add({ title: 'Saved', description: 'Your settings were updated.', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { error?: string }; message?: string }
    toast.add({
      title: 'Save failed',
      description: err?.data?.error || err?.message || 'Please try again.',
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function handleCancel() {
  await refreshSettings()
  securitySettings.currentPassword = ''
  securitySettings.newPassword = ''
  securitySettings.confirmPassword = ''
  toast.add({ title: 'Reverted', description: 'Restored values from server.', color: 'neutral' })
}

function openAvatarPicker() {
  avatarInputRef.value?.click()
}

async function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  saving.value = true
  try {
    const res = await $fetch<{ image: string }>(`${serverUrl}/api/settings/avatar`, {
      method: 'POST',
      body: fd,
      credentials: 'include'
    })
    profileSettings.image = res.image
    await ($authClient as { updateUser?: (x: { image: string }) => Promise<unknown> }).updateUser?.({ image: res.image })
    await refreshSettings()
    toast.add({ title: 'Photo updated', color: 'success' })
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
  } finally {
    saving.value = false
    input.value = ''
  }
}

async function submitPasswordChange() {
  if (!securitySettings.newPassword || securitySettings.newPassword !== securitySettings.confirmPassword) {
    toast.add({ title: 'Passwords must match', color: 'error' })
    return
  }
  if (!securitySettings.currentPassword) {
    toast.add({ title: 'Enter current password', color: 'error' })
    return
  }
  saving.value = true
  try {
    const client = $authClient as {
      changePassword?: (x: {
        currentPassword: string
        newPassword: string
        revokeOtherSessions?: boolean
      }) => Promise<unknown>
    }
    const res = (await client.changePassword?.({
      currentPassword: securitySettings.currentPassword,
      newPassword: securitySettings.newPassword,
      revokeOtherSessions: false
    })) as { error?: { message?: string } } | void
    if (res && typeof res === 'object' && 'error' in res && res.error) {
      throw new Error(res.error.message || 'Change failed')
    }
    securitySettings.currentPassword = ''
    securitySettings.newPassword = ''
    securitySettings.confirmPassword = ''
    await refreshSettings()
    toast.add({ title: 'Password changed', color: 'success' })
  } catch (e: unknown) {
    const err = e as { message?: string }
    toast.add({ title: 'Password change failed', description: err?.message || 'Check your current password.', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function confirmDeleteAccount() {
  if (!deletePassword.value) {
    toast.add({ title: 'Enter your password', color: 'error' })
    return
  }
  saving.value = true
  try {
    const client = $authClient as {
      deleteUser?: (x: { password?: string; callbackURL?: string }) => Promise<{ error?: { message?: string } }>
    }
    const res = (await client.deleteUser?.({
      password: deletePassword.value,
      callbackURL: '/login'
    })) as { error?: { message?: string } } | void
    if (res && typeof res === 'object' && 'error' in res && res.error) {
      throw new Error(res.error.message || 'Deletion failed')
    }
    showDeleteModal.value = false
    await navigateTo('/login')
  } catch (e: unknown) {
    const err = e as { message?: string }
    toast.add({ title: 'Could not delete account', description: err?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

function profileInitials() {
  const a = profileSettings.firstName?.[0] ?? ''
  const b = profileSettings.lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

const accentSwatches = Object.entries(ACCENT_PALETTE).map(([name, pal]) => ({
  name: name as keyof typeof ACCENT_PALETTE,
  color: pal.main
}))

function selectAccent(name: string) {
  appearanceSettings.accentColor = name
  applyAccentByName(name)
}

const billingHistory = [
  { date: 'Nov 8, 2025', amount: '99.00 RON', status: 'Paid', invoice: 'INV-2025-011' },
  { date: 'Oct 8, 2025', amount: '99.00 RON', status: 'Paid', invoice: 'INV-2025-010' },
  { date: 'Sep 8, 2025', amount: '99.00 RON', status: 'Paid', invoice: 'INV-2025-009' }
]

function downloadBillingRow(item: (typeof billingHistory)[0]) {
  const lines = [`Invoice: ${item.invoice}`, `Date: ${item.date}`, `Amount: ${item.amount}`, `Status: ${item.status}`]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.invoice}.txt`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Download started', color: 'success' })
}

function billingContactSales() {
  toast.add({ title: 'Upgrade', description: 'Contact sales@pentawebapp.example for enterprise plans.', color: 'neutral' })
}

function billingAddMethod() {
  toast.add({ title: 'Payment methods', description: 'Adding cards will be available in a future update.', color: 'neutral' })
}

const avatarUrl = computed(() => {
  const img = profileSettings.image
  if (!img) return undefined
  if (img.startsWith('http')) return img
  return `${serverUrl}${img}`
})
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6 lg:gap-8 text-white max-w-6xl mx-auto w-full min-h-0">
    <!-- Sidebar (desktop) -->
    <aside class="hidden lg:block w-56 shrink-0">
      <div class="sticky top-0 space-y-6">
        <div>
          <h2 class="text-xl font-bold mb-1">Settings</h2>
          <p class="text-gray-500 text-sm">Account and preferences</p>
        </div>
        <nav class="space-y-1">
          <button
            v-for="s in sections"
            :key="s.id"
            type="button"
            :class="[
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all ring-1',
              activeSection === s.id
                ? 'bg-[#121212] penta-text-accent penta-list-selected'
                : 'bg-[#18181b] text-gray-400 ring-gray-800 hover:text-white hover:ring-gray-700'
            ]"
            @click="activeSection = s.id"
          >
            <UIcon :name="s.icon" class="w-5 h-5 flex-shrink-0" />
            <span>{{ s.label }}</span>
          </button>
        </nav>
      </div>
    </aside>

    <!-- Mobile: section pills -->
    <div class="lg:hidden w-full mb-2">
      <div class="mb-4">
        <h2 class="text-xl font-bold mb-1">Settings</h2>
        <p class="text-gray-500 text-sm">Account and preferences</p>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        <button
          v-for="s in sections"
          :key="s.id"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs whitespace-nowrap ring-1 transition-all shrink-0',
            activeSection === s.id
              ? 'penta-pill-active'
              : 'bg-[#18181b] text-gray-400 ring-gray-800'
          ]"
          @click="activeSection = s.id"
        >
          <UIcon :name="s.icon" class="w-4 h-4" />
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0 pb-8">
      <!-- Profile -->
      <div v-show="activeSection === 'profile'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Profile</h1>
          <p class="text-gray-500 text-sm">Personal information and profile details</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Profile picture</h3>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            @change="onAvatarSelected"
          />
          <div class="flex flex-col sm:flex-row sm:items-center gap-6">
            <UAvatar
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="profileSettings.firstName"
              class="w-20 h-20 shrink-0 ring-2 ring-[color:color-mix(in_srgb,var(--penta-accent)_40%,transparent)]"
            />
            <div
              v-else
              class="w-20 h-20 rounded-full penta-bg-subtle flex items-center justify-center ring-2 ring-[color:color-mix(in_srgb,var(--penta-accent)_40%,transparent)] shrink-0"
            >
              <span class="penta-text-accent text-2xl font-semibold">{{ profileInitials() }}</span>
            </div>
            <div class="flex-1">
              <UButton
                variant="ghost"
                class="ring-1 ring-gray-700 bg-[#121212] hover:bg-gray-800 text-gray-300"
                :loading="saving"
                @click="openAvatarPicker"
              >
                <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 mr-2" />
                Upload new picture
              </UButton>
              <p class="text-gray-600 text-sm mt-2">JPG, PNG, GIF or WebP. Max 2MB.</p>
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Personal information</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">First name</label>
              <UInput v-model="profileSettings.firstName" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Last name</label>
              <UInput v-model="profileSettings.lastName" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Email</label>
              <UInput v-model="profileSettings.email" type="email" icon="i-heroicons-envelope" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Phone</label>
              <UInput v-model="profileSettings.phone" icon="i-heroicons-phone" :ui="inputUi" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm text-gray-400 mb-1.5">Job title</label>
              <UInput v-model="profileSettings.jobTitle" :ui="inputUi" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm text-gray-400 mb-1.5">Bio</label>
              <UTextarea v-model="profileSettings.bio" :rows="3" :ui="textareaUi" />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" class="ring-1 ring-gray-700" :disabled="saving" @click="handleCancel">Cancel</UButton>
          <UButton class="penta-btn-primary" :loading="saving" @click="saveCurrentSection">
            <UIcon name="i-heroicons-check" class="w-4 h-4 mr-2" />
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Company -->
      <div v-show="activeSection === 'company'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Company</h1>
          <p class="text-gray-500 text-sm">Business information and address</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Business information</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-sm text-gray-400 mb-1.5">Company name</label>
              <UInput v-model="companySettings.name" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Business type</label>
              <USelect
                v-model="companySettings.businessType"
                :items="[
                  { label: 'General Contractor', value: 'General Contractor' },
                  { label: 'Subcontractor', value: 'Subcontractor' },
                  { label: 'Specialty Contractor', value: 'Specialty Contractor' },
                  { label: 'Construction Manager', value: 'Construction Manager' }
                ]"
                class="w-full"
                :ui="selectUi"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Tax ID / EIN</label>
              <UInput v-model="companySettings.taxId" :ui="inputUi" />
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Business address</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-sm text-gray-400 mb-1.5">Street</label>
              <UInput v-model="companySettings.address" icon="i-heroicons-map-pin" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">City</label>
              <UInput v-model="companySettings.city" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">State / County</label>
              <UInput v-model="companySettings.state" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">ZIP</label>
              <UInput v-model="companySettings.zipCode" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Country</label>
              <UInput v-model="companySettings.country" :ui="inputUi" />
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Contact</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Phone</label>
              <UInput v-model="companySettings.phone" icon="i-heroicons-phone" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Email</label>
              <UInput v-model="companySettings.email" type="email" icon="i-heroicons-envelope" :ui="inputUi" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm text-gray-400 mb-1.5">Website</label>
              <UInput v-model="companySettings.website" icon="i-heroicons-globe-alt" :ui="inputUi" />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" class="ring-1 ring-gray-700" :disabled="saving" @click="handleCancel">Cancel</UButton>
          <UButton class="penta-btn-primary" :loading="saving" @click="saveCurrentSection">
            <UIcon name="i-heroicons-check" class="w-4 h-4 mr-2" />
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Notifications -->
      <div v-show="activeSection === 'notifications'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Notifications</h1>
          <p class="text-gray-500 text-sm">How you receive updates and alerts</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6 space-y-5">
          <h3 class="font-semibold mb-2">Channels</h3>
          <div class="flex items-center justify-between gap-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-3 min-w-0">
              <UIcon name="i-heroicons-envelope" class="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div>
                <p class="font-medium">Email</p>
                <p class="text-gray-500 text-sm">Updates via email</p>
              </div>
            </div>
            <USwitch v-model="notificationSettings.emailNotifications" color="success" />
          </div>
          <div class="flex items-center justify-between gap-4 py-2 border-b border-gray-800/80">
            <div class="flex items-center gap-3 min-w-0">
              <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div>
                <p class="font-medium">Push</p>
                <p class="text-gray-500 text-sm">On your devices</p>
              </div>
            </div>
            <USwitch v-model="notificationSettings.pushNotifications" color="success" />
          </div>
          <div class="flex items-center justify-between gap-4 py-2">
            <div class="flex items-center gap-3 min-w-0">
              <UIcon name="i-heroicons-phone" class="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div>
                <p class="font-medium">SMS</p>
                <p class="text-gray-500 text-sm">Urgent alerts by text</p>
              </div>
            </div>
            <USwitch v-model="notificationSettings.smsNotifications" color="success" />
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6 space-y-5">
          <h3 class="font-semibold">Types</h3>
          <div v-for="row in [
            { key: 'jobUpdates', title: 'Job updates', desc: 'Status, assignments, completions' },
            { key: 'paymentAlerts', title: 'Payment alerts', desc: 'Invoices, payments, overdue' },
            { key: 'teamMessages', title: 'Team messages', desc: 'Workers and team chat' },
            { key: 'inventoryAlerts', title: 'Inventory alerts', desc: 'Low stock and restocks' }
          ] as const" :key="row.key" class="flex items-center justify-between gap-4 py-2 border-b border-gray-800/80 last:border-0">
            <div>
              <p class="font-medium">{{ row.title }}</p>
              <p class="text-gray-500 text-sm">{{ row.desc }}</p>
            </div>
            <USwitch v-model="notificationSettings[row.key]" color="success" />
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6 space-y-5">
          <h3 class="font-semibold">Reports</h3>
          <div class="flex items-center justify-between gap-4 py-2 border-b border-gray-800/80">
            <div>
              <p class="font-medium">Weekly reports</p>
              <p class="text-gray-500 text-sm">Jobs, revenue, activity summary</p>
            </div>
            <USwitch v-model="notificationSettings.weeklyReports" color="success" />
          </div>
          <div class="flex items-center justify-between gap-4 py-2">
            <div>
              <p class="font-medium">Monthly reports</p>
              <p class="text-gray-500 text-sm">Financial and performance detail</p>
            </div>
            <USwitch v-model="notificationSettings.monthlyReports" color="success" />
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" class="ring-1 ring-gray-700" :disabled="saving" @click="handleCancel">Cancel</UButton>
          <UButton class="penta-btn-primary" :loading="saving" @click="saveCurrentSection">
            <UIcon name="i-heroicons-check" class="w-4 h-4 mr-2" />
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Appearance -->
      <div v-show="activeSection === 'appearance'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Appearance</h1>
          <p class="text-gray-500 text-sm">Theme and layout preferences</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Theme</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              :class="[
                'p-5 rounded-xl transition-all text-center',
                appearanceSettings.theme === 'dark'
                  ? 'penta-theme-active'
                  : 'ring-2 ring-gray-800 hover:ring-gray-700 bg-[#121212]'
              ]"
              @click="setAppearanceTheme('dark')"
            >
              <UIcon name="i-heroicons-moon" class="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p class="text-sm font-medium">Dark</p>
            </button>
            <button
              type="button"
              :class="[
                'p-5 rounded-xl transition-all text-center',
                appearanceSettings.theme === 'light'
                  ? 'penta-theme-active'
                  : 'ring-2 ring-gray-800 hover:ring-gray-700 bg-[#121212]'
              ]"
              @click="setAppearanceTheme('light')"
            >
              <UIcon name="i-heroicons-sun" class="w-8 h-8 mx-auto mb-2 text-amber-300" />
              <p class="text-sm font-medium">Light</p>
            </button>
            <button
              type="button"
              :class="[
                'p-5 rounded-xl transition-all text-center sm:col-span-1',
                appearanceSettings.theme === 'auto'
                  ? 'penta-theme-active'
                  : 'ring-2 ring-gray-800 hover:ring-gray-700 bg-[#121212]'
              ]"
              @click="setAppearanceTheme('auto')"
            >
              <UIcon name="i-heroicons-computer-desktop" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p class="text-sm font-medium">System</p>
            </button>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Accent color</h3>
          <p class="text-gray-500 text-sm mb-4">
            Applies to navigation, buttons, and highlights across the app. Click Save to persist.
          </p>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <button
              v-for="c in accentSwatches"
              :key="c.name"
              type="button"
              :title="String(c.name)"
              :class="[
                'h-12 rounded-xl border-2 transition-transform',
                appearanceSettings.accentColor === c.name ? 'border-white scale-105 ring-2 ring-white/40' : 'border-transparent hover:scale-105'
              ]"
              :style="{ backgroundColor: c.color }"
              @click="selectAccent(String(c.name))"
            />
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="font-medium">Compact mode</p>
              <p class="text-gray-500 text-sm">Tighter spacing (demo toggle)</p>
            </div>
            <USwitch v-model="appearanceSettings.compactMode" color="success" />
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" class="ring-1 ring-gray-700" :disabled="saving" @click="handleCancel">Cancel</UButton>
          <UButton class="penta-btn-primary" :loading="saving" @click="saveCurrentSection">
            <UIcon name="i-heroicons-check" class="w-4 h-4 mr-2" />
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Security -->
      <div v-show="activeSection === 'security'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Security</h1>
          <p class="text-gray-500 text-sm">Password, 2FA, and sessions</p>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 class="font-semibold">Password</h3>
              <p class="text-gray-500 text-sm">Last account update: {{ formatPasswordDate(securitySettings.passwordLastChanged) }}</p>
            </div>
          </div>
          <div class="grid gap-3 pt-2">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Current password</label>
              <UInput v-model="securitySettings.currentPassword" type="password" placeholder="••••••••" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">New password</label>
              <UInput v-model="securitySettings.newPassword" type="password" placeholder="••••••••" :ui="inputUi" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Confirm new password</label>
              <UInput v-model="securitySettings.confirmPassword" type="password" placeholder="••••••••" :ui="inputUi" />
            </div>
            <div>
              <UButton class="penta-btn-primary w-fit" :loading="saving" @click="submitPasswordChange">
                <UIcon name="i-heroicons-key" class="w-4 h-4 mr-2" />
                Change password
              </UButton>
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
            <div>
              <h3 class="font-semibold mb-1">Two-factor authentication</h3>
              <p class="text-gray-500 text-sm mb-3">Extra security for your account</p>
              <span
                v-if="securitySettings.twoFactorEnabled"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium penta-status-ok"
              >
                <UIcon name="i-heroicons-check" class="w-3.5 h-3.5" />
                Enabled
              </span>
            </div>
            <USwitch v-model="securitySettings.twoFactorEnabled" color="success" />
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6 space-y-6">
          <h3 class="font-semibold">Session</h3>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Auto logout after</label>
            <USelect
              v-model="securitySettings.sessionTimeout"
              :items="[
                { label: '15 minutes', value: '15' },
                { label: '30 minutes', value: '30' },
                { label: '1 hour', value: '60' },
                { label: '2 hours', value: '120' },
                { label: 'Never', value: 'never' }
              ]"
              class="w-full max-w-xs"
              :ui="selectUi"
            />
          </div>
          <div class="border-t border-gray-800 pt-4">
            <h4 class="font-medium mb-3">Active sessions</h4>
            <div class="space-y-3">
              <div class="bg-[#121212] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ring-1 ring-gray-800">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-computer-desktop" class="w-5 h-5 text-gray-500" />
                  <div>
                    <p class="font-medium">Chrome on Windows</p>
                    <p class="text-gray-500 text-sm">Current session</p>
                  </div>
                </div>
                <span class="text-xs px-2.5 py-1 rounded-full penta-status-ok w-fit">Active</span>
              </div>
              <div class="bg-[#121212] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ring-1 ring-gray-800">
                <div class="flex items-center gap-3">
                  <UIcon name="i-heroicons-device-phone-mobile" class="w-5 h-5 text-gray-500" />
                  <div>
                    <p class="font-medium">Mobile — iPhone</p>
                    <p class="text-gray-500 text-sm">2 hours ago</p>
                  </div>
                </div>
                <UButton
                  size="sm"
                  variant="ghost"
                  class="text-gray-500 hover:bg-gray-800 w-fit"
                  @click="toast.add({ title: 'Session revoke', description: 'Use password change to sign out other devices soon.', color: 'neutral' })"
                >
                  Revoke
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-red-500/5 ring-1 ring-red-500/25 rounded-xl p-6">
          <h3 class="text-red-400 font-semibold mb-3 flex items-center gap-2">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
            Danger zone
          </h3>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p class="font-medium">Delete account</p>
              <p class="text-gray-500 text-sm">Permanently remove your account and data</p>
            </div>
            <UButton color="error" variant="outline" class="border-red-500/50 text-red-400 shrink-0" @click="showDeleteModal = true">
              <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-2" />
              Delete account
            </UButton>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton variant="ghost" class="ring-1 ring-gray-700" :disabled="saving" @click="handleCancel">Cancel</UButton>
          <UButton class="penta-btn-primary" :loading="saving" @click="saveCurrentSection">
            <UIcon name="i-heroicons-check" class="w-4 h-4 mr-2" />
            Save changes
          </UButton>
        </div>
      </div>

      <!-- Billing -->
      <div v-show="activeSection === 'billing'" class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold mb-1">Billing</h1>
          <p class="text-gray-500 text-sm">Subscription and payment methods</p>
        </div>

        <div class="rounded-xl p-6 penta-billing-card">
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
            <div>
              <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium penta-btn-primary mb-2">Pro</span>
              <h3 class="text-2xl font-bold">99 RON / month</h3>
              <p class="text-gray-400 text-sm mt-1">Billed monthly · Next: Dec 8, 2025</p>
            </div>
            <UButton variant="ghost" class="ring-1 ring-[color-mix(in_srgb,var(--penta-accent)_45%,transparent)] penta-text-accent hover:bg-[color-mix(in_srgb,var(--penta-accent)_10%,transparent)] w-fit" @click="billingContactSales">
              Upgrade
            </UButton>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t penta-border-accent-soft">
            <div>
              <p class="text-gray-500 text-sm">Projects</p>
              <p class="font-medium">Unlimited</p>
            </div>
            <div>
              <p class="text-gray-500 text-sm">Team</p>
              <p class="font-medium">Up to 25</p>
            </div>
            <div>
              <p class="text-gray-500 text-sm">Storage</p>
              <p class="font-medium">500 GB</p>
            </div>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 class="font-semibold">Payment methods</h3>
            <UButton size="sm" variant="ghost" class="ring-1 ring-gray-700 w-fit" @click="billingAddMethod">
              Add method
            </UButton>
          </div>
          <div class="bg-[#121212] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ring-1 ring-gray-800">
            <div class="flex items-center gap-4">
              <div class="w-12 h-8 rounded-md penta-gradient-chip flex items-center justify-center">
                <UIcon name="i-heroicons-credit-card" class="w-5 h-5 text-white" />
              </div>
              <div>
                <p class="font-medium">Visa ···· 4242</p>
                <p class="text-gray-500 text-sm">Expires 12/2027</p>
              </div>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full penta-status-ok w-fit">Default</span>
          </div>
        </div>

        <div class="bg-[#18181b] ring-1 ring-gray-800 rounded-xl p-6">
          <h3 class="font-semibold mb-4">Billing history</h3>
          <div class="space-y-2">
            <div
              v-for="(item, index) in billingHistory"
              :key="index"
              class="bg-[#121212] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ring-1 ring-gray-800/80"
            >
              <div>
                <p class="font-medium">{{ item.invoice }}</p>
                <p class="text-gray-500 text-sm">{{ item.date }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="font-medium">{{ item.amount }}</span>
                <span class="text-xs px-2.5 py-1 rounded-full penta-status-ok">{{ item.status }}</span>
                <UButton size="xs" variant="ghost" class="text-gray-400" @click="downloadBillingRow(item)">Download</UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UModal v-model:open="showDeleteModal" title="Delete account">
      <template #body>
        <p class="text-gray-400 text-sm mb-4">
          This permanently deletes your account and related data. Enter your password to confirm.
        </p>
        <UInput
          v-model="deletePassword"
          type="password"
          placeholder="Password"
          :ui="inputUi"
          @keydown.enter.prevent="confirmDeleteAccount"
        />
      </template>
      <template #footer>
        <UButton variant="ghost" class="ring-1 ring-gray-700" @click="showDeleteModal = false">Cancel</UButton>
        <UButton color="error" :loading="saving" @click="confirmDeleteAccount">Delete forever</UButton>
      </template>
    </UModal>
  </div>
</template>
