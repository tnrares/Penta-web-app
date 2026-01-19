import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

app.post("/generate", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  if (user?.role !== "MANAGER") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { jobId } = await c.req.json();

  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { jobId: Number(jobId) }
    });

    if (existingInvoice) {
      return c.json({ error: "Factura a fost deja emisă." }, 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: Number(jobId) },
      include: { 
        quote: true,
        client: true
      }
    });

    if (!job) return c.json({ error: "Job inexistent" }, 404);
    if (!job.quote || !job.quote.isAccepted) {
      return c.json({ error: "Nu există o ofertă acceptată." }, 400);
    }
    if (!job.client) {
      return c.json({ error: "Jobul nu are client asignat." }, 400);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice = await prisma.invoice.create({
      data: {
        jobId: job.id,
        userId: job.client.id,
        totalAmount: job.quote.totalAmount,
        amountPaid: 0,
        status: "EMITTED_UNPAID",
        issueDate: new Date(),
        dueDate: dueDate
      }
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FINALIZED" }
    });

    return c.json(invoice);
  } catch (e: any) {
    console.error("Eroare generare factură:", e);
    return c.json({ error: "Eroare server: " + e.message }, 500);
  }
});

app.patch("/:id/pay", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (user?.role !== "MANAGER") {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const invoiceId = parseInt(c.req.param("id"));

    try {
        const currentInvoice = await prisma.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!currentInvoice) return c.json({ error: "Factură inexistentă" }, 404);

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { 
                status: "PAID_IN_FULL", 
                amountPaid: currentInvoice.totalAmount 
            }
        });

        return c.json(updated);
    } catch (e) {
        return c.json({ error: "Eroare la procesarea plății" }, 500);
    }
});

export const invoicesRouter = app;