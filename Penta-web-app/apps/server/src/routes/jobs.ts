import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

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
        include: { client: true }
      });
    } else {
      jobs = await prisma.job.findMany({
        where: { clientId: session.user.id },
        orderBy: { createdAt: 'desc' }
      });
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

app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { 
        client: true, 
        manager: true, 
        quote: {
          include: {
            items: true
          }
        },
        photos: true,
        invoice: true
      }
    });
    if (!job) return c.json({ error: "Lucrarea nu există" }, 404);
    return c.json(job);
  } catch (e) {
    return c.json({ error: "Eroare server" }, 500);
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
    const updatedJob = await prisma.job.update({
      where: { id },
      data: {
        managerId: session.user.id,
        status: "PENDING_VISIT"
      }
    });
    return c.json(updatedJob);
  } catch (e) {
    return c.json({ error: "Eroare la asignare" }, 500);
  }
});

export const jobsRouter = app;