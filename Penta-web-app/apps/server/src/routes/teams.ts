import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

/** List teams with member counts (managers only). */
app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "MANAGER") {
    return c.json({ error: "Doar managerii pot vedea echipele." }, 403);
  }

  try {
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        lead: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });

    return c.json(
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        lead: t.lead?.name ?? "—",
        members: t._count.members,
        activeJobs: 0,
        completed: 0,
      }))
    );
  } catch (e: any) {
    console.error("teams list:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "necunoscută") }, 500);
  }
});

/** Create a team; optional lead and initial members (workers only). */
app.post("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "MANAGER") {
    return c.json({ error: "Doar managerii pot crea echipe." }, 403);
  }

  try {
    const body = (await c.req.json()) as {
      name?: string;
      color?: string;
      leadId?: string | null;
      memberIds?: string[];
    };

    const name = String(body.name ?? "").trim();
    if (!name) return c.json({ error: "Numele echipei este obligatoriu." }, 400);

    const color = typeof body.color === "string" && body.color ? body.color : "blue";
    let leadId: string | null =
      typeof body.leadId === "string" && body.leadId ? body.leadId : null;

    if (leadId) {
      const lead = await prisma.user.findUnique({
        where: { id: leadId },
        select: { role: true },
      });
      if (!lead || lead.role !== "WORKER") {
        return c.json({ error: "Lead-ul trebuie să fie un worker." }, 400);
      }
    }

    const rawIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    const memberSet = new Set<string>();
    for (const id of rawIds) {
      if (typeof id === "string" && id) memberSet.add(id);
    }
    if (leadId) memberSet.add(leadId);

    for (const uid of memberSet) {
      const u = await prisma.user.findUnique({
        where: { id: uid },
        select: { role: true },
      });
      if (!u || u.role !== "WORKER") {
        return c.json({ error: "Toți membrii trebuie să fie workeri." }, 400);
      }
    }

    const memberIds = [...memberSet];

    const team = await prisma.team.create({
      data: {
        name,
        color,
        leadId,
        members:
          memberIds.length > 0
            ? { create: memberIds.map((userId) => ({ userId })) }
            : undefined,
      },
      include: {
        lead: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });

    return c.json(
      {
        id: team.id,
        name: team.name,
        color: team.color,
        lead: team.lead?.name ?? "—",
        members: team._count.members,
        activeJobs: 0,
        completed: 0,
      },
      201
    );
  } catch (e: any) {
    console.error("teams create:", e);
    return c.json({ error: "Eroare server: " + (e?.message ?? "necunoscută") }, 500);
  }
});

export const teamsRouter = app;
