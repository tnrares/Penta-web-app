import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

// Mock role/skills mapping (User model has no specialty - map by index for demo)
const ROLES = ["Lead Carpenter", "Electrician", "Plumber", "Painter", "Project Manager", "General Contractor"];
const SKILLS_POOL: Record<string, string[]> = {
  "Lead Carpenter": ["Carpentry", "Framing", "Finishing"],
  "Electrician": ["Electrical", "Wiring", "Safety Compliance"],
  "Plumber": ["Plumbing", "Pipe Fitting", "HVAC Basics"],
  "Painter": ["Painting", "Surface Prep", "Color Matching"],
  "Project Manager": ["Project Management", "Scheduling", "Client Relations"],
  "General Contractor": ["General Contracting", "Coordination", "Budgeting"]
};
const TEAMS = ["Construction A", "Electrical Team", "Finishing Team", "Plumbing Team"];

function getWorkerMeta(worker: { id: string; name: string }, index: number) {
  const role = ROLES[index % ROLES.length];
  return {
    role,
    skills: SKILLS_POOL[role] ?? ["General Labor"],
    teams: [TEAMS[index % TEAMS.length], TEAMS[(index + 1) % TEAMS.length]].filter((t, i, arr) => arr.indexOf(t) === i),
    rating: 4.2 + (index % 5) * 0.2
  };
}

// GET /api/workers - list workers with stats (MANAGER only)
app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "MANAGER") {
    return c.json({ error: "Doar managerii pot vedea lista de workeri." }, 403);
  }

  try {
    const workers = await prisma.user.findMany({
      where: { role: "WORKER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        updatedAt: true
      },
      orderBy: { name: "asc" }
    });

    const memberships = await prisma.teamMember.findMany({
      include: { team: { select: { name: true } } },
    });
    const teamsByUserId = new Map<string, string[]>();
    for (const m of memberships) {
      const list = teamsByUserId.get(m.userId) ?? [];
      list.push(m.team.name);
      teamsByUserId.set(m.userId, list);
    }

    const jobs = await prisma.job.findMany({
      where: { workerId: { in: workers.map((w) => w.id) } },
      include: {
        client: { select: { id: true, name: true } },
        quote: { select: { totalAmount: true } }
      }
    });

    const activeStatuses = ["IN_PROGRESS", "QUOTE_ACCEPTED", "READY_FOR_REVIEW"];
    const completedStatuses = ["FINALIZED", "CLOSED_PAID"];

    const list = workers.map((w, idx) => {
      const workerJobs = jobs.filter((j) => j.workerId === w.id);
      const activeJobs = workerJobs.filter((j) => activeStatuses.includes(j.status));
      const completedJobs = workerJobs.filter((j) => completedStatuses.includes(j.status));
      const lastJob = workerJobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      const meta = getWorkerMeta(w, idx);
      const dbTeams = teamsByUserId.get(w.id) ?? [];
      const status = activeJobs.length > 0 ? "on_job" : "available";
      return {
        id: w.id,
        name: w.name,
        email: w.email,
        phone: w.phone,
        image: w.image,
        role: meta.role,
        skills: meta.skills,
        teams: dbTeams.length > 0 ? dbTeams : meta.teams,
        rating: meta.rating,
        status,
        completedJobs: completedJobs.length,
        activeJobs: activeJobs.length,
        lastActive: lastJob?.updatedAt ?? w.updatedAt
      };
    });

    return c.json(list);
  } catch (e: any) {
    console.error("Eroare la preluarea workerilor:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

// GET /api/workers/:id - single worker detail with job history
app.get("/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "MANAGER") {
    return c.json({ error: "Doar managerii pot accesa detaliile workerilor." }, 403);
  }

  const workerId = c.req.param("id");
  if (!workerId) return c.json({ error: "ID worker lipsă" }, 400);

  try {
    const worker = await prisma.user.findUnique({
      where: { id: workerId, role: "WORKER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        createdAt: true
      }
    });
    if (!worker) return c.json({ error: "Worker negăsit" }, 404);

    const jobs = await prisma.job.findMany({
      where: { workerId: worker.id },
      include: {
        client: { select: { id: true, name: true } },
        quote: { select: { totalAmount: true } },
        invoice: { select: { totalAmount: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const activeStatuses = ["IN_PROGRESS", "QUOTE_ACCEPTED", "READY_FOR_REVIEW"];
    const completedStatuses = ["FINALIZED", "CLOSED_PAID"];
    const activeJobs = jobs.filter((j) => activeStatuses.includes(j.status));
    const completedJobsList = jobs.filter((j) => completedStatuses.includes(j.status));

    const workerIndex = (worker.id.charCodeAt(0) + (worker.id.length || 0)) % ROLES.length;
    const meta = getWorkerMeta(worker, workerIndex);

    const teamRows = await prisma.teamMember.findMany({
      where: { userId: worker.id },
      include: { team: { select: { name: true } } },
    });
    const dbTeams = teamRows.map((r) => r.team.name);

    return c.json({
      ...worker,
      role: meta.role,
      skills: meta.skills,
      teams: dbTeams.length > 0 ? dbTeams : meta.teams,
      rating: meta.rating,
      status: activeJobs.length > 0 ? "on_job" : "available",
      completedJobs: completedJobsList.length,
      activeJobs: activeJobs.length,
      jobHistory: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        client: j.client?.name,
        value: j.invoice?.totalAmount ?? j.quote?.totalAmount ?? 0,
        updatedAt: j.updatedAt,
        rating: 4.0 + Math.floor(Math.random() * 12) / 10
      }))
    });
  } catch (e: any) {
    console.error("Eroare la preluarea workerului:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "Eroare necunoscută") }, 500);
  }
});

export const workersRouter = app;
