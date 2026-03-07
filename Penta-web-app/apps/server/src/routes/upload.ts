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

// Upload document endpoint
app.post("/documents/:jobId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const jobId = parseInt(c.req.param("jobId"));
  
  // Verifică dacă job-ul există și utilizatorul are acces
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return c.json({ error: "Lucrarea nu există." }, 404);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }});
  const isManager = user?.role === "MANAGER";
  const isJobOwner = job.clientId === session.user.id;

  // Doar MANAGER sau owner-ul job-ului pot încărca documente
  if (!isManager && !isJobOwner) {
    return c.json({ error: "Nu ai permisiunea de a încărca documente pentru această lucrare." }, 403);
  }
  
  const body = await c.req.parseBody();
  const file = body['file']; 

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Nu ai selectat niciun document." }, 400);
  }

  // Validare tip fișier (doar documente)
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "Tip de fișier nepermis. Permise: PDF, Word, text, imagini." }, 400);
  }

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${uploadsDir}/documents/${fileName}`;

  try {
    // Ensure directory exists before writing
    const documentsDir = `${uploadsDir}/documents`;
    if (!existsSync(documentsDir)) {
      await mkdir(documentsDir, { recursive: true });
    }

    await write(filePath, file);

    const document = await prisma.jobDocument.create({
      data: {
        jobId: jobId,
        url: `/${filePath}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id
      }
    });

    console.log(`Document uploaded: ${document.id} for job ${jobId} at ${document.url}`);
    return c.json(document);
  } catch (e: any) {
    console.error("Upload error:", e);
    return c.json({ error: "Eroare la salvarea documentului: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

// Delete document endpoint
app.delete("/documents/:documentId", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const documentId = c.req.param("documentId");

  try {
    // Get document with job info to check permissions
    const document = await prisma.jobDocument.findUnique({
      where: { id: documentId },
      include: { job: true }
    });

    if (!document) {
      return c.json({ error: "Documentul nu există." }, 404);
    }

    // Verifică permisiuni: MANAGER, owner-ul job-ului sau cel care a încărcat documentul
    const user = await prisma.user.findUnique({ where: { id: session.user.id }});
    const isManager = user?.role === "MANAGER";
    const isJobOwner = document.job.clientId === session.user.id;
    const isUploader = document.uploadedBy === session.user.id;

    if (!isManager && !isJobOwner && !isUploader) {
      return c.json({ error: "Nu ai dreptul să ștergi acest document." }, 403);
    }

    // Delete file from filesystem
    const filePath = document.url.startsWith('/') ? document.url.slice(1) : document.url;
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Delete from database
    await prisma.jobDocument.delete({
      where: { id: documentId }
    });

    console.log(`Document deleted: ${documentId}`);
    return c.json({ success: true });
  } catch (e: any) {
    console.error("Delete error:", e);
    return c.json({ error: "Eroare la ștergerea documentului: " + (e?.message || "Eroare necunoscută") }, 500);
  }
});

export const uploadsRouter = app;