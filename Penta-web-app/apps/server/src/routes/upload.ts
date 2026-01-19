import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";
import { write } from "bun";
import { mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";

const app = new Hono();

// Ensure uploads directory exists
const uploadsDir = "uploads";
if (!existsSync(uploadsDir)) {
  await mkdir(uploadsDir, { recursive: true });
}

app.post("/:jobId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const jobId = parseInt(c.req.param("jobId"));
  
  const body = await c.req.parseBody();
  const file = body['file']; 

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Nu ai selectat nicio poză." }, 400);
  }

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${uploadsDir}/${fileName}`;

  try {
    // Ensure directory exists before writing
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    await write(filePath, file);

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: jobId,
        url: `/${filePath}`
      }
    });

    console.log(`Photo uploaded: ${photo.id} for job ${jobId} at ${photo.url}`);
    return c.json(photo);
  } catch (e) {
    console.error("Upload error:", e);
    return c.json({ error: "Eroare la salvarea pozei." }, 500);
  }
});

app.delete("/:photoId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const photoId = c.req.param("photoId");

  try {
    // Get photo with job info to check permissions
    const photo = await prisma.jobPhoto.findUnique({
      where: { id: photoId },
      include: { job: true }
    });

    if (!photo) {
      return c.json({ error: "Poza nu există." }, 404);
    }

    // Check if user is manager or the job's manager
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    const isManager = user?.role === "MANAGER";
    const isJobManager = photo.job.managerId === session.user.id;

    if (!isManager && !isJobManager) {
      return c.json({ error: "Nu ai dreptul să ștergi această poză." }, 403);
    }

    // Delete file from filesystem
    const filePath = photo.url.startsWith('/') ? photo.url.slice(1) : photo.url;
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Delete from database
    await prisma.jobPhoto.delete({
      where: { id: photoId }
    });

    console.log(`Photo deleted: ${photoId}`);
    return c.json({ success: true });
  } catch (e) {
    console.error("Delete error:", e);
    return c.json({ error: "Eroare la ștergerea pozei." }, 500);
  }
});

export const uploadsRouter = app;