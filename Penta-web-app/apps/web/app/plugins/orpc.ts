import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import type { AppRouterClient } from "@Penta-web-app/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();
	const serverUrl = config.public.serverURL || 'http://localhost:3000';

	if (!serverUrl) {
		console.warn('NUXT_PUBLIC_SERVER_URL is not set, defaulting to http://localhost:3000');
	}

	const rpcUrl = `${serverUrl}/rpc`;
	console.log('RPC URL:', rpcUrl);

	const rpcLink = new RPCLink({
		url: rpcUrl,
		fetch(url, options) {
			console.log('RPC fetch:', url, options);
			return fetch(url, {
				...options,
				credentials: "include",
			}).catch((error) => {
				console.error('RPC fetch error:', error);
				throw error;
			});
		},
	});

	const client: AppRouterClient = createORPCClient(rpcLink);
	const orpcUtils = createTanstackQueryUtils(client);

	return {
		provide: {
			orpc: orpcUtils,
		},
	};
});
