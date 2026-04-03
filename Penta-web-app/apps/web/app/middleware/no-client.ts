/**
 * Blocks CLIENT role from manager/worker-only routes (e.g. inventory, workers).
 */
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()
  const role = (session.value?.data?.user as { role?: string } | undefined)?.role
  if (role === "CLIENT") {
    return navigateTo("/dashboard")
  }
})
