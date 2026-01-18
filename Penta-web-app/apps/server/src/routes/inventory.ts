import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

//GET
app.get("/", async (c) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { id: 'desc' } // Cele mai noi primele
    });
    return c.json(items);
  } catch (e) {
    return c.json({ error: "Eroare la citire DB" }, 500);
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

//PUT
app.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();

  try {
    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: body.name,
        unitCost: body.unitCost ? parseFloat(body.unitCost) : undefined,
        currentStock: body.currentStock ? parseFloat(body.currentStock) : undefined,
      }
    });
    return c.json(updatedItem);
  } catch (e) {
    return c.json({ error: "Materialul nu a fost găsit" }, 404);
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