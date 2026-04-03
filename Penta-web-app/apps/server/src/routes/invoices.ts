import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";
import PDFDocument  from "pdfkit";

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
    if (!["IN_PROGRESS", "READY_FOR_REVIEW"].includes(job.status)) {
      return c.json(
        { error: "Invoice can be generated after work is in progress or marked ready for review." },
        400
      );
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

app.get("/:id/download", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const invoiceId = parseInt(c.req.param("id"));

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      job: {
        include: {
          client: true,
          quote: true
        }
      },
      user: true
    }
  });
  if (!invoice) return c.json({ error: "Factura inexistenta" }, 404);

  const isManagerOrAdmin = invoice.user.role === "MANAGER";
  const isClient = invoice.user.role === "CLIENT";
  if (!isManagerOrAdmin && !isClient) return c.json({ error: "Unauthorized" }, 401);
  if (isClient && invoice.user.id !== invoice.userId) return c.json({ error: "Unauthorized" }, 401);

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(20).text("FACTURA FISCALA", { align: "center" });
  doc.moveDown();
  
  doc.fontSize(12).text(`Numar Factura: #${invoice.id}`);
  doc.text(`Data emiterii: ${new Date(invoice.issueDate).toLocaleDateString()}`);
  doc.text(`Data scadenta: ${new Date(invoice.dueDate).toLocaleDateString()}`);
  doc.text(`Status: ${invoice.status}`);
  doc.moveDown();

  doc.text("Date Client:");
  doc.text(`Nume: ${invoice.job.client.name}`);
  doc.text(`Email: ${invoice.job.client.email}`);
  doc.moveDown();

  doc.text("Detalii Lucrare:");
  doc.text(`Descriere: ${invoice.job.title}`);
  doc.moveDown();

  doc.fontSize(14).text(`Total de plata: ${invoice.totalAmount} RON`, { align: "right" });
  if (invoice.amountPaid > 0) {
    doc.fontSize(12).text(`Suma achitata: ${invoice.amountPaid} RON`, { align: "right" });
  }

  doc.end();

  const pdfBuffer = await pdfPromise;

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura-${invoice.id}.pdf"`
    }
  });
});

export const invoicesRouter = app;