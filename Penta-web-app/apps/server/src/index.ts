import "dotenv/config";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { createContext } from "../../../packages/api/src/context";
import { appRouter } from "../../../packages/api/src/routers";
import { auth } from "../../../packages/auth/src";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { inventoryRouter } from "./routes/inventory";
import { jobsRouter } from "./routes/jobs";
import { quotesRouter } from "./routes/quotes";
const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: ["http://localhost:3000", "http://localhost:3001",
            "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["Content-Length"],	
		maxAge: 600,
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.route("/api/inventory", inventoryRouter);
app.route("/api/jobs", jobsRouter);
app.route("/api/quotes", quotesRouter);

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

app.use(
    "/*",
    cors({
        origin: [
            "http://localhost:3000", "http://localhost:3001", "http://localhost:5173",
            "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5173"
        ],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    })
);
app.options("/*", (c) => {
  return c.body(null, 204);
});


export default app;
