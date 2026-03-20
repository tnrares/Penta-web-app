import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

type ConvRow = { id: string; clientId: string; managerId: string };
type PrismaWithChat = typeof prisma & {
  conversation: {
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<ConvRow | null>;
    create: (args: unknown) => Promise<ConvRow>;
  };
  chatMessage: {
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
};

const app = new Hono();
const db = prisma as PrismaWithChat;

app.get("/conversations", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const userId = session.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const isManager = user.role === "MANAGER";
    const conversations = await db.conversation.findMany({
      where: isManager ? { managerId: userId } : { clientId: userId },
      include: {
        client: {
          select: { id: true, name: true, email: true, image: true, phone: true }
        },
        manager: {
          select: { id: true, name: true, email: true, image: true }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const list = (conversations as Array<{ id: string; clientId: string; managerId: string; client: unknown; manager: unknown; messages: Array<{ id: string; content: string; senderId: string; createdAt: Date }>; createdAt: Date }>).map((conv) => {
      const lastMessage = conv.messages[0] ?? null;
      return {
        id: conv.id,
        clientId: conv.clientId,
        managerId: conv.managerId,
        client: conv.client,
        manager: conv.manager,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt
            }
          : null,
        updatedAt: lastMessage?.createdAt ?? conv.createdAt
      };
    });

    return c.json(list);
  } catch (e: any) {
    console.error("Eroare la preluarea conversațiilor:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

app.get("/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.query("conversationId");
  if (!conversationId) return c.json({ error: "conversationId is required" }, 400);

  try {
    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true, managerId: true }
    }) as ConvRow | null;
    if (!conv) return c.json({ error: "Conversation not found" }, 404);

    const userId = session.user.id;
    if (conv.clientId !== userId && conv.managerId !== userId) {
      return c.json({ error: "You do not have access to this conversation" }, 403);
    }

    const messages = await db.chatMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return c.json(messages);
  } catch (e: any) {
    console.error("Error fetching messages:", e);
    return c.json({ error: "Server error: " + (e?.message ?? "Unknown error") }, 500);
  }
});

app.post("/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return c.json({ error: "content is required" }, 400);

    const userId = session.user.id;
    let conversationId: string;

if (body.conversationId) {
      const conv = await db.conversation.findUnique({
        where: { id: body.conversationId }
      });
      if (!conv) return c.json({ error: "Conversation not found" }, 404);
      if (conv.clientId !== userId && conv.managerId !== userId) {
        return c.json({ error: "You do not have access to this conversation" }, 403);
      }
      conversationId = conv.id;
    } else if (body.clientId && body.managerId) {
      const clientId = body.clientId as string;
      const managerId = body.managerId as string;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isManager = user?.role === "MANAGER";
      if (!((isManager && userId === managerId && clientId) || (!isManager && userId === clientId && managerId))) {
        return c.json({ error: "Invalid clientId/managerId for current user" }, 403);
      }
      let conv: ConvRow | null = await db.conversation.findUnique({
        where: { clientId_managerId: { clientId, managerId } }
      });
      if (!conv) {
        conv = await db.conversation.create({
          data: { clientId, managerId }
        });
      }
      conversationId = conv.id;
    } else {
      return c.json({ error: "Provide conversationId or (clientId and managerId)" }, 400);
    }

    const message = await db.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    return c.json(message, 201);
  } catch (e: any) {
    console.error("Error sending message:", e);
    return c.json({ error: "Server error: " + (e?.message ?? "Unknown error") }, 500);
  }
});

export const chatRouter = app;
