const PUBLIC_PATHS = new Set([
	"/",
	"/login",
	"/register",
	"/privacy",
	"/terms",
]);

function isSafeRedirect(path: string): boolean {
	return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}

export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) {
		return;
	}

	const { $authClient } = useNuxtApp();
	const session = $authClient.useSession();

	if (session.value.isPending) {
		return;
	}

	const path = to.path;
	const isPublic = PUBLIC_PATHS.has(path);

	if (session.value.data) {
		if (path === "/login" || path === "/register") {
			return navigateTo("/dashboard");
		}
		return;
	}

	if (isPublic) {
		return;
	}

	const redirect =
		to.fullPath && to.fullPath !== "/login"
			? to.fullPath
			: undefined;

	return navigateTo({
		path: "/login",
		...(redirect && isSafeRedirect(redirect)
			? { query: { redirect } }
			: {}),
	});
});
