export default defineNuxtPlugin(async () => {
  const { applyAccentByName, initAccentFromStorage } = useAppAccent()
  initAccentFromStorage()

  const config = useRuntimeConfig()
  const serverUrl = config.public.serverURL || 'http://localhost:3000'

  try {
    const data = await $fetch<{
      appearance?: { accentColor?: string }
    }>(`${serverUrl}/api/settings`, {
      credentials: 'include'
    })
    const name = data?.appearance?.accentColor
    if (name) applyAccentByName(name)
  } catch {
    /* not logged in or offline — keep localStorage / default */
  }
})
