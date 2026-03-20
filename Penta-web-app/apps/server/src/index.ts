import "dotenv/config";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { createContext } from "../../../packages/api/src/context";
import { appRouter } from "../../../packages/api/src/routers";
import { auth } from "../../../packages/auth/src";
import prisma from "@Penta-web-app/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { inventoryRouter } from "./routes/inventory";
import { jobsRouter } from "./routes/jobs";
import { quotesRouter } from "./routes/quotes";
import { uploadsRouter } from "./routes/upload";
import { serveStatic } from "hono/bun";
import { invoicesRouter } from "./routes/invoices";
import { chatRouter } from "./routes/chat";
import { clientsRouter } from "./routes/clients";
import { dashboardRouter } from "./routes/dashboard";
import { workersRouter } from "./routes/workers";
import { settingsRouter } from "./routes/settings";

type PrismaWithChat = typeof prisma & {
  conversation: { findUnique: (args: unknown) => Promise<{ id: string; clientId: string; managerId: string } | null> };
  chatMessage: { create: (args: unknown) => Promise<unknown> };
};
const db = prisma as PrismaWithChat;

type WsData = { userId: string; conversationId: string };
const wsRooms = new Map<string, Set<import("bun").ServerWebSocket<WsData>>>();

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: ["http://localhost:3000", "http://localhost:3001",
            "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: ["Content-Type", "Authorization", "Cookie"],
		exposeHeaders: ["Content-Length"],	
		maxAge: 600,
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/uploads/*", serveStatic({ root: "./" }));

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
app.route("/api/uploads", uploadsRouter);
app.route("/api/invoices", invoicesRouter);
app.route("/api/chat", chatRouter);
app.route("/api/clients", clientsRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/workers", workersRouter);
app.route("/api/settings", settingsRouter);

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
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"], 
        allowHeaders: ["Content-Type", "Authorization", "Cookie"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    })
);
app.options("/*", (c) => {
  return c.body(null, 204);
});

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  fetch: async (req, server) => {
    const url = new URL(req.url);
    if (url.pathname === "/api/chat/ws" && req.headers.get("Upgrade") === "websocket") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) return new Response("Unauthorized", { status: 401 });
      const conversationId = url.searchParams.get("conversationId");
      if (!conversationId) return new Response("conversationId required", { status: 400 });
      const conv = await db.conversation.findUnique({ where: { id: conversationId } });
      if (!conv || (conv.clientId !== session.user.id && conv.managerId !== session.user.id)) {
        return new Response("Forbidden", { status: 403 });
      }
      const ok = server.upgrade(req, {
        data: { userId: session.user.id, conversationId }
      } as unknown as Parameters<typeof server.upgrade>[1]);
      if (!ok) return new Response("Upgrade failed", { status: 500 });
      return undefined;
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      const w = ws as unknown as import("bun").ServerWebSocket<WsData>;
      const { conversationId } = w.data;
      if (!wsRooms.has(conversationId)) wsRooms.set(conversationId, new Set());
      wsRooms.get(conversationId)!.add(w);
    },
    async message(ws, message) {
      const w = ws as unknown as import("bun").ServerWebSocket<WsData>;
      const { userId, conversationId } = w.data;
      try {
        const text = typeof message === "string" ? message : message.toString();
        const body = JSON.parse(text) as { type?: string; content?: string };
        if (body.type !== "message" || typeof body.content !== "string") return;
        const content = body.content.trim();
        if (!content) return;

        const msg = await db.chatMessage.create({
          data: { conversationId, senderId: userId, content },
          include: { sender: { select: { id: true, name: true } } }
        }) as { id: string; senderId: string; content: string; createdAt: Date; sender: { id: string; name: string } };

        const payload = JSON.stringify({
          type: "new_message",
          message: {
            id: msg.id,
            senderId: msg.senderId,
            content: msg.content,
            createdAt: msg.createdAt,
            sender: msg.sender
          }
        });

        const room = wsRooms.get(conversationId);
        if (room) {
          for (const s of room) {
            if (s.readyState === 1) s.send(payload);
          }
        }
      } catch (e) {
        console.error("WS message error:", e);
      }
    },
    close(ws) {
      const w = ws as unknown as import("bun").ServerWebSocket<WsData>;
      const { conversationId } = w.data;
      const room = wsRooms.get(conversationId);
      if (room) {
        room.delete(w);
        if (room.size === 0) wsRooms.delete(conversationId);
      }
    }
  }
});

console.log(`Server listening on http://localhost:${port}`);
