import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

// GET /api/clients - list all clients (MANAGER only). Returns clients with summary.
app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "MANAGER") {
      return c.json({ error: "Doar managerii pot vedea lista de clienți." }, 403);
    }

    const clients = await prisma.user.findMany({
      where: { role: "CLIENT" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        createdAt: true
      },
      orderBy: { name: "asc" }
    });

    // Enrich with job/invoice aggregates per client
    const withSummary = await Promise.all(
      clients.map(async (client) => {
        const jobs = await prisma.job.findMany({
          where: { clientId: client.id },
          include: {
            invoice: {
              select: { totalAmount: true, amountPaid: true }
            }
          }
        });
        const totalJobs = jobs.length;
        let totalPaid = 0;
        let outstanding = 0;
        for (const job of jobs) {
          if (job.invoice) {
            totalPaid += job.invoice.amountPaid;
            outstanding += job.invoice.totalAmount - job.invoice.amountPaid;
          }
        }
        let status: "Paid" | "Pending" | "Overdue" = "Paid";
        if (outstanding > 0) status = "Pending";
        // Optional: check overdue by dueDate on invoices
        const hasOverdue = await prisma.invoice.findFirst({
          where: {
            job: { clientId: client.id },
            status: "OVERDUE"
          }
        });
        if (hasOverdue) status = "Overdue";

        return {
          ...client,
          totalJobs,
          totalPaid,
          outstanding,
          status
        };
      })
    );

    return c.json(withSummary);
  } catch (e: any) {
    console.error("Eroare la preluarea clienților:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

// GET /api/clients/:id - single client detail + summary (for right panel)
app.get("/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const clientId = c.req.param("id");
  if (!clientId) return c.json({ error: "ID client lipsă" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "MANAGER") {
      return c.json({ error: "Doar managerii pot accesa detaliile clientului." }, 403);
    }

    const client = await prisma.user.findUnique({
      where: { id: clientId, role: "CLIENT" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        companyName: true,
        createdAt: true
      }
    });
    if (!client) return c.json({ error: "Client negăsit" }, 404);

    const jobs = await prisma.job.findMany({
      where: { clientId: client.id },
      include: {
        invoice: { select: { totalAmount: true, amountPaid: true, status: true, dueDate: true } },
        quote: { select: { totalAmount: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    let totalPaid = 0;
    let outstanding = 0;
    for (const job of jobs) {
      if (job.invoice) {
        totalPaid += job.invoice.amountPaid;
        outstanding += job.invoice.totalAmount - job.invoice.amountPaid;
      }
    }

    return c.json({
      ...client,
      totalJobs: jobs.length,
      totalPaid,
      outstanding,
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        address: j.address,
        status: j.status,
        createdAt: j.createdAt,
        quoteTotal: j.quote?.totalAmount,
        invoice: j.invoice
      }))
    });
  } catch (e: any) {
    console.error("Eroare la preluarea clientului:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

export const clientsRouter = app;
