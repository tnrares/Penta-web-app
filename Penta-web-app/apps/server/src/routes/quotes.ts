import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

app.post("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  if (user?.role !== "MANAGER") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { jobId, items } = body;

    if (!jobId || !items || items.length === 0) {
      return c.json({ error: "Date incomplete (lipsesc itemele)" }, 400);
    }

    let grandTotal = 0;
    const formattedItems = items.map((item: any) => {
      const total = item.quantity * item.unitPrice;
      grandTotal += total;
      return {
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: total
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          jobId: Number(jobId),
          totalAmount: grandTotal,
          items: {
            create: formattedItems
          }
        }
      });

      await tx.job.update({
        where: { id: Number(jobId) },
        data: { status: "QUOTE_SENT" }
      });

      return quote;
    });

    return c.json(result, 201);
  } catch (e: any) {
    console.error(e);
    if (e.code === 'P2002') {
      return c.json({ error: "Există deja o ofertă pentru acest job." }, 409);
    }
    return c.json({ error: "Eroare server la salvarea ofertei." }, 500);
  }
});

app.get("/job/:jobId", async (c) => {
  const jobId = Number(c.req.param("jobId"));
  const quote = await prisma.quote.findUnique({
    where: { jobId },
    include: { items: true }
  });
  
  if (!quote) return c.json(null); 
  return c.json(quote);
});

app.patch("/:id/respond", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    console.error("No session found. Headers:", Object.fromEntries(c.req.raw.headers.entries()));
    return c.json({ error: "Unauthorized" }, 401);
  }

  const quoteId = parseInt(c.req.param("id"));
  const { accepted } = await c.req.json();

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { job: true }
    });

    if (!quote) return c.json({ error: "Ofertă inexistentă" }, 404);

    if (quote.job.clientId !== session.user.id) {
      return c.json({ error: "Nu ai dreptul să răspunzi la această ofertă." }, 403);
    }
    await prisma.$transaction([
      prisma.quote.update({
        where: { id: quoteId },
        data: { isAccepted: accepted }
      }), 
      prisma.job.update({
        where: { id: quote.jobId },
        data: { 
          status: accepted ? "IN_PROGRESS" : "CANCELED" 
        }
      })
    ]);

    return c.json({ success: true, status: accepted ? "ACCEPTED" : "REJECTED" });
  } catch (e) {
    console.error(e);
    return c.json({ error: "Eroare la procesarea răspunsului." }, 500);
  }
});

export const quotesRouter = app;