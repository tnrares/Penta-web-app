/** Safe in-app path after sign-in / sign-up (open redirect hardening). */
export function getPostAuthRedirect(redirect: unknown): string {
	if (
		typeof redirect === "string" &&
		redirect.startsWith("/") &&
		!redirect.startsWith("//") &&
		!redirect.includes("://")
	) {
		return redirect;
	}
	return "/dashboard";
}
