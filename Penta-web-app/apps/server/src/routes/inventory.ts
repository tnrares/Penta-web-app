import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

// GET all – include supplier for list/detail
app.get("/", async (c) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { id: "desc" }
    });
    return c.json(items);
  } catch (e) {
    return c.json({ error: "Eroare la citire DB" }, 500);
  }
});

// GET one – for detail panel (with supplier and recent usage from JobMaterial)
app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, contactEmail: true, phone: true } },
        jobMaterials: {
          take: 10,
          orderBy: { jobId: "desc" },
          include: { job: { select: { id: true, title: true, updatedAt: true } } }
        }
      }
    });
    if (!item) return c.json({ error: "Articol negăsit" }, 404);
    return c.json(item);
  } catch (e) {
    return c.json({ error: "Eroare la citire" }, 500);
  }
});

//POST
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    console.log("Date primite:", body);

    const newItem = await prisma.inventoryItem.create({
      data: {
        name: body.name,
        unit: body.unit,
        unitCost: Number(body.unitCost),
        currentStock: Number(body.currentStock || 0),
        minStockAlert: Number(body.minStockAlert || 5),
        yieldRate: 1.0,   
        supplierId: body.supplierId ? Number(body.supplierId) : null
      }
    });

    return c.json(newItem);
  } catch (e: any) {
    console.error("EROARE PRISMA:", e);
    return c.json({ error: e.message }, 400);
  }
});

// PUT – full update (name, unitCost, currentStock, minStockAlert, supplierId)
app.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);
  try {
    const data: { name?: string; unit?: string; unitCost?: number; currentStock?: number; minStockAlert?: number; supplierId?: number | null } = {};
    if (body.name != null) data.name = String(body.name);
    if (body.unit != null) data.unit = String(body.unit);
    if (body.unitCost != null) data.unitCost = parseFloat(body.unitCost);
    if (body.currentStock != null) data.currentStock = parseFloat(body.currentStock);
    if (body.minStockAlert != null) data.minStockAlert = parseFloat(body.minStockAlert);
    if (body.supplierId !== undefined) data.supplierId = body.supplierId ? Number(body.supplierId) : null;
    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data
    });
    return c.json(updatedItem);
  } catch (e) {
    return c.json({ error: "Materialul nu a fost găsit" }, 404);
  }
});

// PATCH – stock adjustment (use stock / restock)
app.patch("/:id/stock", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "ID invalid" }, 400);
  try {
    const body = await c.req.json();
    const delta = Number(body.quantity ?? body.delta ?? 0);
    if (!Number.isFinite(delta)) return c.json({ error: "quantity invalid" }, 400);
    const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { currentStock: true } });
    if (!item) return c.json({ error: "Articol negăsit" }, 404);
    const newStock = Math.max(0, item.currentStock + delta);
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { currentStock: newStock }
    });
    return c.json(updated);
  } catch (e) {
    return c.json({ error: "Eroare la actualizare stoc" }, 500);
  }
});

//DELETE
app.delete("/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = parseInt(idParam);

  if (isNaN(id)) {
    return c.json({ error: "ID invalid" }, 400);
  }

  try {
    await prisma.inventoryItem.delete({ 
      where: { id } 
    });
    
    return c.json({ success: true });

  } catch (e: any) {
    console.error("EROARE DELETE:", e);

    if (e.code === 'P2003') {
      return c.json({ 
        error: "IMPOSIBIL DE ȘTERS: Acest material este deja folosit într-o ofertă sau un job activ." 
      }, 409); 
    }

    return c.json({ error: "Eroare la ștergere: " + e.message }, 500);
  }
});

export const inventoryRouter = app;