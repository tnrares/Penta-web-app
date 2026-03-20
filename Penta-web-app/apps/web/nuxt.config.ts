// https://nuxt.com/docs/api/configuration/nuxt-config
import { visualizer } from "rollup-plugin-visualizer";

const analyze =
	process.env.ANALYZE === "1" || process.env.ANALYZE === "true";

export default defineNuxtConfig({
				compatibilityDate: "latest",
				devtools: {
				 enabled: true,

				 timeline: {
					 enabled: true,
					},
				},
				modules: ["@nuxt/ui", "@nuxtjs/color-mode"],
				colorMode: {
					preference: "dark",
					fallback: "dark",
					classSuffix: "",
				},
				css: ["~/assets/css/main.css"],
				devServer: {
								port: 3001,
				},
				ssr: true,
				runtimeConfig: {
								public: {
												serverURL: process.env.NUXT_PUBLIC_SERVER_URL,
								},
				},
				routeRules: {
								"/_nuxt/**": {
												headers: {
																"cache-control":
																				"public, max-age=31536000, immutable",
												},
								},
				},
				vite: {
								plugins: analyze
												? [
																visualizer({
																				filename: ".nuxt/stats.html",
																				gzipSize: true,
																				brotliSize: true,
																				open: true,
																}),
												]
												: [],
				},
});