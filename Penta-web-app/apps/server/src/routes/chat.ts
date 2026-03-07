import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

// GET /api/chat/conversations - list conversations for current user
app.get("/conversations", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const userId = session.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);

    const isManager = user.role === "MANAGER";
    const conversations = await prisma.conversation.findMany({
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

    const list = conversations.map((conv) => {
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

// GET /api/chat/messages?conversationId=xxx
app.get("/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const conversationId = c.req.query("conversationId");
  if (!conversationId) return c.json({ error: "conversationId este obligatoriu" }, 400);

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true, managerId: true }
    });
    if (!conv) return c.json({ error: "Conversația nu există" }, 404);

    const userId = session.user.id;
    if (conv.clientId !== userId && conv.managerId !== userId) {
      return c.json({ error: "Nu ai acces la această conversație" }, 403);
    }

    const messages = await prisma.chatMessage.findMany({
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
    console.error("Eroare la preluarea mesajelor:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

// POST /api/chat/messages - send message. Body: { conversationId, content } or { clientId, managerId, content }
app.post("/messages", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return c.json({ error: "content este obligatoriu" }, 400);

    const userId = session.user.id;
    let conversationId: string;

    if (body.conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: body.conversationId }
      });
      if (!conv) return c.json({ error: "Conversația nu există" }, 404);
      if (conv.clientId !== userId && conv.managerId !== userId) {
        return c.json({ error: "Nu faci parte din această conversație" }, 403);
      }
      conversationId = conv.id;
    } else if (body.clientId && body.managerId) {
      const clientId = body.clientId as string;
      const managerId = body.managerId as string;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isManager = user?.role === "MANAGER";
      if (!((isManager && userId === managerId && clientId) || (!isManager && userId === clientId && managerId))) {
        return c.json({ error: "clientId/managerId invalide pentru utilizatorul curent" }, 403);
      }
      let conv = await prisma.conversation.findUnique({
        where: { clientId_managerId: { clientId, managerId } }
      });
      if (!conv) {
        conv = await prisma.conversation.create({
          data: { clientId, managerId }
        });
      }
      conversationId = conv.id;
    } else {
      return c.json({ error: "Furnizează conversationId sau (clientId și managerId)" }, 400);
    }

    const message = await prisma.chatMessage.create({
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
    console.error("Eroare la trimiterea mesajului:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

export const chatRouter = app;
