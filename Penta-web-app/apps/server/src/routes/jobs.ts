import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";
import {
  isTransitionAllowed,
  isWorkerTransitionAllowed,
  type JobStatus,
} from "@Penta-web-app/config/job-status";

const app = new Hono();

app.get("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    const isManager = user?.role === "MANAGER";

    let jobs;

    if (isManager) {
      jobs = await prisma.job.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          client: true,
          manager: { select: { id: true, name: true, email: true } },
        },
      });
    } else {
      jobs = await prisma.job.findMany({
        where: { clientId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          worker: { select: { id: true, name: true, email: true } },
        },
      });

      // Legacy jobs may lack managerId until a quote is sent; if the client already has a chat with a manager, show them as PM.
      const conv = await prisma.conversation.findFirst({
        where: { clientId: session.user.id },
        include: { manager: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      const fallbackManager = conv?.manager;
      if (fallbackManager) {
        jobs = jobs.map((j) => ({
          ...j,
          manager: j.manager ?? fallbackManager,
        }));
      }
    }

    return c.json(jobs);
  } catch (e) {
    console.error(e);
    return c.json({ error: "Eroare la preluarea listei." }, 500);
  }
});

app.post("/", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    if (!body.title || !body.address) {
      return c.json({ error: "Date incomplete" }, 400);
    }

    const newJob = await prisma.job.create({
      data: {
        title: body.title,
        address: body.address,
        status: "PENDING_VISIT", 
        clientId: session.user.id,
      }
    });

    return c.json(newJob, 201);
  } catch (e) {
    return c.json({ error: "Eroare creare job" }, 500);
  }
});

// List workers (for assign-worker dropdown). Must be before /:id.
app.get("/workers", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user || user.role !== "MANAGER") {
      return c.json({ error: "Doar managerii pot vedea lista de workeri." }, 403);
    }
    const workers = await prisma.user.findMany({
      where: { role: "WORKER" },
      select: { id: true, name: true, email: true }
    });
    return c.json(workers);
  } catch (e: any) {
    console.error("Eroare la preluarea workerilor:", e);
    return c.json({ error: "Eroare server" }, 500);
  }
});

// --- Materials CRUD (must be before /:id to match /:id/materials) ---
app.get("/:id/materials", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isJobOwner = job.clientId === session.user.id;
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isJobOwner && !isWorker) {
      return c.json({ error: "Nu ai permisiunea de a accesa materialele acestei lucrări." }, 403);
    }

    const [inventoryMaterials, customMaterials] = await Promise.all([
      prisma.jobMaterial.findMany({
        where: { jobId: id },
        include: {
          item: {
            select: { id: true, name: true, unit: true, unitCost: true }
          }
        }
      }),
      prisma.jobCustomMaterial.findMany({ where: { jobId: id } })
    ]);
    const list = [
      ...inventoryMaterials.map((m) => ({ type: "inventory" as const, ...m })),
      ...customMaterials.map((m) => ({ type: "custom" as const, ...m }))
    ];
    return c.json(list);
  } catch (e: any) {
    console.error("Eroare la preluarea materialelor:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.post("/:id/materials", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isWorker) {
      return c.json({ error: "Doar managerul sau workerul asignat pot adăuga materiale." }, 403);
    }

    const body = await c.req.json();
    const quantityUsed = Number(body.quantityUsed);
    if (isNaN(quantityUsed) || quantityUsed <= 0) {
      return c.json({ error: "quantityUsed (pozitiv) este obligatoriu." }, 400);
    }

    // Custom material (fără inventar)
    if (body.materialName != null && body.unit != null && body.unitCostAtTime != null) {
      const materialName = String(body.materialName).trim();
      const unit = String(body.unit).trim();
      const unitCostAtTime = Number(body.unitCostAtTime);
      if (!materialName) return c.json({ error: "Numele materialului este obligatoriu." }, 400);
      if (isNaN(unitCostAtTime) || unitCostAtTime < 0) return c.json({ error: "Cost unitar invalid." }, 400);
      const created = await prisma.jobCustomMaterial.create({
        data: {
          jobId: id,
          materialName,
          quantityUsed,
          unit: unit || "buc",
          unitCostAtTime
        }
      });
      return c.json({ type: "custom", ...created }, 201);
    }

    // Din inventar
    const itemId = Number(body.itemId);
    if (!itemId) {
      return c.json({ error: "Pentru material din inventar: itemId este obligatoriu. Pentru material custom: materialName, unit, unitCostAtTime sunt obligatorii." }, 400);
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) return c.json({ error: "Materialul din inventar nu există." }, 404);

    const existing = await prisma.jobMaterial.findUnique({
      where: { jobId_itemId: { jobId: id, itemId } }
    });
    if (existing) {
      const updated = await prisma.jobMaterial.update({
        where: { jobId_itemId: { jobId: id, itemId } },
        data: {
          quantityUsed: existing.quantityUsed + quantityUsed
        },
        include: {
          item: { select: { id: true, name: true, unit: true, unitCost: true } }
        }
      });
      return c.json({ type: "inventory", ...updated });
    }

    const created = await prisma.jobMaterial.create({
      data: {
        jobId: id,
        itemId,
        quantityUsed,
        unitCostAtTime: item.unitCost
      },
      include: {
        item: { select: { id: true, name: true, unit: true, unitCost: true } }
      }
    });
    return c.json({ type: "inventory", ...created }, 201);
  } catch (e: any) {
    console.error("Eroare la adăugarea materialului:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.patch("/:id/materials/custom/:customId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  const customId = c.req.param("customId");
  if (isNaN(id) || !customId) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isWorker) {
      return c.json({ error: "Doar managerul sau workerul asignat pot actualiza materiale." }, 403);
    }

    const body = await c.req.json();
    const data: { quantityUsed?: number; unitCostAtTime?: number } = {};
    if (body.quantityUsed !== undefined) {
      const q = Number(body.quantityUsed);
      if (isNaN(q) || q < 0) return c.json({ error: "quantityUsed >= 0." }, 400);
      data.quantityUsed = q;
    }
    if (body.unitCostAtTime !== undefined) {
      const cost = Number(body.unitCostAtTime);
      if (isNaN(cost) || cost < 0) return c.json({ error: "unitCostAtTime >= 0." }, 400);
      data.unitCostAtTime = cost;
    }
    if (Object.keys(data).length === 0) return c.json({ error: "Furnizează quantityUsed sau unitCostAtTime." }, 400);

    const existing = await prisma.jobCustomMaterial.findFirst({
      where: { id: customId, jobId: id }
    });
    if (!existing) return c.json({ error: "Materialul custom nu există pentru acest job." }, 404);
    const updated = await prisma.jobCustomMaterial.update({
      where: { id: customId },
      data
    });
    return c.json({ type: "custom", ...updated });
  } catch (e: any) {
    if (e?.code === "P2025") return c.json({ error: "Materialul custom nu există." }, 404);
    console.error("Eroare la actualizarea materialului custom:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.delete("/:id/materials/custom/:customId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  const customId = c.req.param("customId");
  if (isNaN(id) || !customId) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isWorker) {
      return c.json({ error: "Doar managerul sau workerul asignat pot șterge materiale." }, 403);
    }

    const existing = await prisma.jobCustomMaterial.findFirst({
      where: { id: customId, jobId: id }
    });
    if (!existing) return c.json({ error: "Materialul custom nu există pentru acest job." }, 404);
    await prisma.jobCustomMaterial.delete({
      where: { id: customId }
    });
    return c.json({ success: true }, 200);
  } catch (e: any) {
    if (e?.code === "P2025") return c.json({ error: "Materialul custom nu există." }, 404);
    console.error("Eroare la ștergerea materialului custom:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.patch("/:id/materials/:itemId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  const itemId = parseInt(c.req.param("itemId"));
  if (isNaN(id) || isNaN(itemId)) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isWorker) {
      return c.json({ error: "Doar managerul sau workerul asignat pot actualiza materiale." }, 403);
    }

    const body = await c.req.json();
    const quantityUsed = Number(body.quantityUsed);
    if (isNaN(quantityUsed) || quantityUsed < 0) {
      return c.json({ error: "quantityUsed trebuie să fie un număr >= 0." }, 400);
    }

    const updated = await prisma.jobMaterial.update({
      where: { jobId_itemId: { jobId: id, itemId } },
      data: { quantityUsed: quantityUsed === 0 ? 0 : quantityUsed },
      include: {
        item: { select: { id: true, name: true, unit: true, unitCost: true } }
      }
    });
    return c.json(updated);
  } catch (e: any) {
    if (e?.code === "P2025") return c.json({ error: "Materialul nu există pentru acest job." }, 404);
    console.error("Eroare la actualizarea materialului:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.delete("/:id/materials/:itemId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  const itemId = parseInt(c.req.param("itemId"));
  if (isNaN(id) || isNaN(itemId)) return c.json({ error: "ID invalid" }, 400);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isWorker = job.workerId === session.user.id;
    if (!isManager && !isWorker) {
      return c.json({ error: "Doar managerul sau workerul asignat pot șterge materiale." }, 403);
    }

    await prisma.jobMaterial.delete({
      where: { jobId_itemId: { jobId: id, itemId } }
    });
    return c.json({ success: true }, 200);
  } catch (e: any) {
    if (e?.code === "P2025") return c.json({ error: "Materialul nu există pentru acest job." }, 404);
    console.error("Eroare la ștergerea materialului:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.get("/:id", async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  
  if (isNaN(id)) {
    return c.json({ error: "ID invalid" }, 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);
    
    const isManager = user.role === "MANAGER";

    const job = await prisma.job.findUnique({
      where: { id },
      include: { 
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        quote: {
          include: {
            items: true
          }
        },
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            issueDate: true,
            dueDate: true
          }
        },
        documents: {
          select: {
            id: true,
            url: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        materials: {
          include: {
            item: {
              select: { id: true, name: true, unit: true, unitCost: true }
            }
          }
        },
        customMaterials: true
      }
    });

    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isAssignedWorker = user.role === "WORKER" && job.workerId === session.user.id;
    if (!isManager && job.clientId !== session.user.id && !isAssignedWorker) {
      return c.json({ error: "Nu ai permisiunea de a accesa această lucrare." }, 403);
    }

    let photos: any[] = [];
    try {
      const jobWithPhotos = await prisma.job.findUnique({
        where: { id },
        select: {
          photos: {
            select: {
              id: true,
              url: true,
              createdAt: true
            }
          }
        }
      });
      photos = (jobWithPhotos as any)?.photos ?? [];
    } catch (photoError: any) {
      console.warn("Nu s-au putut încărca fotografiile (tabelul poate să nu existe):", photoError?.message || photoError);
      photos = [];
    }

    let responseBody: Record<string, unknown> = { ...job, photos };

    // When job.managerId is not set yet, show the PM from the client conversation (same for all roles).
    if (!job.manager && job.clientId) {
      const conv = await prisma.conversation.findFirst({
        where: { clientId: job.clientId },
        include: { manager: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (conv?.manager) {
        responseBody = { ...responseBody, manager: conv.manager };
      }
    }

    return c.json(responseBody);
  } catch (e: any) {
    console.error("Eroare la preluarea job-ului:", e);
    console.error("Message:", e?.message);
    console.error("Stack trace:", e?.stack);
    return c.json({ 
      error: "Eroare server", 
      details: process.env.NODE_ENV === "development" ? e?.message : undefined 
    }, 500);
  }
});

app.patch("/:id/assign", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  
  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  if (user?.role !== "MANAGER") {
   return c.json({ error: "Doar managerii pot prelua lucrări." }, 403);
  }

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        managerId: session.user.id,
      },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, image: true } },
        manager: { select: { id: true, name: true, email: true } },
        worker: { select: { id: true, name: true, email: true } },
        quote: { include: { items: true } },
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            issueDate: true,
            dueDate: true,
          },
        },
      },
    });
    return c.json(updatedJob);
  } catch (e) {
    return c.json({ error: "Eroare la asignare" }, 500);
  }
});

app.patch("/:id/assign-worker", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);

  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  if (user?.role !== "MANAGER") {
    return c.json({ error: "Doar managerii pot asigna un worker la lucrare." }, 403);
  }

  try {
    const body = await c.req.json();
    const workerId = body.workerId;
    if (!workerId || typeof workerId !== "string") {
      return c.json({ error: "workerId (string) este obligatoriu." }, 400);
    }

    const worker = await prisma.user.findUnique({
      where: { id: workerId },
      select: { role: true }
    });
    if (!worker || worker.role !== "WORKER") {
      return c.json({ error: "Utilizatorul selectat nu este worker." }, 400);
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const updatedJob = await prisma.job.update({
      where: { id },
      data: { workerId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, image: true } },
        manager: { select: { id: true, name: true, email: true } },
        worker: { select: { id: true, name: true, email: true } },
        quote: { include: { items: true } },
        invoice: { select: { id: true, totalAmount: true, amountPaid: true, status: true, issueDate: true, dueDate: true } }
      }
    });
    return c.json(updatedJob);
  } catch (e: any) {
    console.error("Eroare la asignarea worker-ului:", e);
    return c.json({ error: "Eroare server: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.patch("/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isJobOwner = job.clientId === session.user.id;
    const isAssignedWorker = user.role === "WORKER" && job.workerId === session.user.id;

    if (!isManager && !isJobOwner && !isAssignedWorker) {
      return c.json({ error: "Nu ai permisiunea de a edita această lucrare." }, 403);
    }

    const body = await c.req.json();

    // Assigned worker: only IN_PROGRESS → READY_FOR_REVIEW
    if (isAssignedWorker) {
      const forbidden = ["title", "address", "estimatedStartDate", "estimatedEndDate", "actualStartDate", "actualEndDate"].some(
        (k) => body[k as keyof typeof body] !== undefined
      );
      if (forbidden) {
        return c.json({ error: "Workers can only mark the job as ready for review (no other fields)." }, 400);
      }
      if (body.status !== "READY_FOR_REVIEW") {
        return c.json({ error: "Workers can only mark the job as ready for review." }, 400);
      }
      if (!isWorkerTransitionAllowed(job.status as JobStatus, "READY_FOR_REVIEW")) {
        return c.json({ error: "The job must be in progress before it can be marked ready for review." }, 400);
      }
      const updatedJob = await prisma.job.update({
        where: { id },
        data: { status: "READY_FOR_REVIEW" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
            },
          },
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          worker: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          quote: {
            include: {
              items: true,
            },
          },
          invoice: {
            select: {
              id: true,
              totalAmount: true,
              amountPaid: true,
              status: true,
              issueDate: true,
              dueDate: true,
            },
          },
        },
      });
      return c.json(updatedJob);
    }

    const updateData: any = {};

    // Toți pot actualiza titlul și adresa
    if (body.title !== undefined) updateData.title = body.title;
    if (body.address !== undefined) updateData.address = body.address;

    // Doar MANAGER-ii pot actualiza statusul și datele estimate
    if (isManager) {
      if (body.status !== undefined) {
        const validStatuses = ['PENDING_VISIT', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'FINALIZED', 'CLOSED_PAID', 'CANCELED'];
        if (validStatuses.includes(body.status)) {
          const from = job.status as JobStatus;
          const to = body.status as JobStatus;
          if (!isTransitionAllowed(from, to)) {
            return c.json(
              { error: `Invalid status transition (${from} → ${to}). Use the job page workflow or allowed next steps in Edit.` },
              400
            );
          }
          updateData.status = body.status;
        }
      }
      if (body.estimatedStartDate !== undefined) {
        updateData.estimatedStartDate = body.estimatedStartDate ? new Date(body.estimatedStartDate) : null;
      }
      if (body.estimatedEndDate !== undefined) {
        updateData.estimatedEndDate = body.estimatedEndDate ? new Date(body.estimatedEndDate) : null;
      }
      if (body.actualStartDate !== undefined) {
        updateData.actualStartDate = body.actualStartDate ? new Date(body.actualStartDate) : null;
      }
      if (body.actualEndDate !== undefined) {
        updateData.actualEndDate = body.actualEndDate ? new Date(body.actualEndDate) : null;
      }
    }

    // First manager touch claims the job as project manager (for client Team / job UI).
    if (isManager && job.managerId == null) {
      updateData.managerId = session.user.id;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "Nu s-au furnizat date pentru actualizare." }, 400);
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        worker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        quote: {
          include: {
            items: true
          }
        },
        invoice: {
          select: {
            id: true,
            totalAmount: true,
            amountPaid: true,
            status: true,
            issueDate: true,
            dueDate: true
          }
        }
      }
    });

    return c.json(updatedJob);
  } catch (e: any) {
    console.error("Eroare la actualizarea job-ului:", e);
    return c.json({ error: "Eroare la actualizarea lucrării: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.patch("/:id/schedule-visit", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  
  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  const isManager = user?.role === "MANAGER";

  if (!isManager) {
    return c.json({ error: "Doar managerii pot programa vizite." }, 403);
  }

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return c.json({ error: "Lucrarea nu există." }, 404);
    }

    const body = await c.req.json();
    const { estimatedStartDate, status } = body;

    if (!estimatedStartDate) {
      return c.json({ error: "Data estimată de început este obligatorie." }, 400);
    }

    const updateData: any = {
      estimatedStartDate: new Date(estimatedStartDate)
    };

    if (status) {
      const from = job.status as JobStatus;
      const to = status as JobStatus;
      if (!isTransitionAllowed(from, to)) {
        return c.json(
          { error: `Invalid status transition (${from} → ${to}).` },
          400
        );
      }
      updateData.status = status;
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        manager: true,
        worker: true,
        quote: {
          include: {
            items: true
          }
        },
        invoice: true
      }
    });

    return c.json(updatedJob);
  } catch (e: any) {
    console.error("Eroare la programarea vizitei:", e);
    return c.json({ error: "Eroare la programarea vizitei: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

app.delete("/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const id = parseInt(c.req.param("id"));
  
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    if (!user) return c.json({ error: "Utilizator negăsit" }, 404);

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);

    const isManager = user.role === "MANAGER";
    const isJobOwner = job.clientId === session.user.id;

    if (!isManager && !isJobOwner) {
      return c.json({ error: "Nu ai permisiunea de a șterge această lucrare." }, 403);
    }

    if (!isManager && (job.status === "FINALIZED" || job.status === "CLOSED_PAID")) {
      return c.json({ 
        error: "Nu poți șterge o lucrare finalizată sau închisă. Contactează managerul." 
      }, 400);
    }
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { jobId: id } });
      if (quote) {
        await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
        await tx.quote.delete({ where: { jobId: id } });
      }

      await tx.invoice.deleteMany({ where: { jobId: id } });

      await tx.jobMaterial.deleteMany({ where: { jobId: id } });
      await tx.jobCustomMaterial.deleteMany({ where: { jobId: id } });

      try {
        await tx.jobPhoto.deleteMany({ where: { jobId: id } });
      } catch (photoError) {
        console.warn("Nu s-au putut șterge fotografiile:", photoError);
      }

      await tx.job.delete({ where: { id } });
    });

    return c.json({ message: "Lucrarea a fost ștearsă cu succes" }, 200);
  } catch (e: any) {
    console.error("Eroare la ștergerea lucrării:", e);
    return c.json({ 
      error: "Eroare la ștergerea lucrării",
      details: process.env.NODE_ENV === "development" ? e?.message : undefined
    }, 500);
  }
});

export const jobsRouter = app;