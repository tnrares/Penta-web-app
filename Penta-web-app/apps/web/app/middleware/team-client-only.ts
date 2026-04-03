/** Only CLIENT users can open /team (manager/worker use Clients/Workers elsewhere). */
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()
  const role = (session.value?.data?.user as { role?: string } | undefined)?.role
  if (role !== "CLIENT") {
    return navigateTo("/dashboard")
  }
})
