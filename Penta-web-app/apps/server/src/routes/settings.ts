import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";
import { write } from "bun";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

const app = new Hono();

/** Prisma User row including optional columns (ensure `bunx prisma generate` after schema changes). */
type UserSettingsRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  companyName: string | null;
  cui: string | null;
  bio: string | null;
  jobTitle: string | null;
  settings: unknown;
  updatedAt: Date;
};

type SettingsJson = {
  company?: {
    businessType?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  notifications?: Record<string, boolean | undefined>;
  appearance?: {
    accentColor?: string;
    compactMode?: boolean;
    theme?: "dark" | "light" | "auto";
  };
  security?: {
    twoFactorEnabled?: boolean;
    sessionTimeout?: string;
  };
};

function asSettings(raw: unknown): SettingsJson {
  if (!raw || typeof raw !== "object") return {};
  return raw as SettingsJson;
}

function defaultNotifications(): Record<string, boolean> {
  return {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    jobUpdates: true,
    paymentAlerts: true,
    teamMessages: true,
    inventoryAlerts: true,
    weeklyReports: true,
    monthlyReports: false,
  };
}

// GET /api/settings
app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const row = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!row) return c.json({ error: "User not found" }, 404);
    const user = row as unknown as UserSettingsRow;

    const s = asSettings(user.settings);
    const parts = user.name.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    const notifications = { ...defaultNotifications(), ...s.notifications };

    return c.json({
      profile: {
        firstName,
        lastName,
        email: user.email,
        phone: user.phone ?? "",
        jobTitle: user.jobTitle ?? "",
        bio: user.bio ?? "",
        image: user.image,
      },
      company: {
        name: user.companyName ?? "",
        businessType: s.company?.businessType ?? "General Contractor",
        taxId: user.cui ?? "",
        address: s.company?.address ?? "",
        city: s.company?.city ?? "",
        state: s.company?.state ?? "",
        zipCode: s.company?.zipCode ?? "",
        country: s.company?.country ?? "",
        phone: s.company?.phone ?? "",
        email: s.company?.email ?? "",
        website: s.company?.website ?? "",
      },
      notifications,
      appearance: {
        accentColor: s.appearance?.accentColor ?? "green",
        compactMode: s.appearance?.compactMode ?? false,
        theme: s.appearance?.theme ?? "dark",
      },
      security: {
        twoFactorEnabled: s.security?.twoFactorEnabled ?? false,
        sessionTimeout: s.security?.sessionTimeout ?? "30",
        passwordLastChanged: user.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("GET /api/settings", e);
    return c.json({ error: err?.message ?? "Server error" }, 500);
  }
});

// PATCH /api/settings  body: { section, ...payload }
app.patch("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const section = body.section as string | undefined;
  if (!section) return c.json({ error: "Missing section" }, 400);

  try {
    const row = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!row) return c.json({ error: "User not found" }, 404);
    const user = row as unknown as UserSettingsRow;

    const prev = asSettings(user.settings);

    if (section === "profile") {
      const firstName = String(body.firstName ?? "").trim();
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = body.phone != null ? String(body.phone) : undefined;
      const jobTitle = body.jobTitle != null ? String(body.jobTitle) : undefined;
      const bio = body.bio != null ? String(body.bio) : undefined;

      const name = [firstName, lastName].filter(Boolean).join(" ") || user.name;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          email: email || user.email,
          phone: phone ?? null,
          jobTitle: jobTitle ?? null,
          bio: bio ?? null,
        } as never,
      });

      return c.json({ ok: true });
    }

    if (section === "company") {
      const company = {
        ...prev.company,
        businessType: body.businessType != null ? String(body.businessType) : prev.company?.businessType,
        address: body.address != null ? String(body.address) : prev.company?.address,
        city: body.city != null ? String(body.city) : prev.company?.city,
        state: body.state != null ? String(body.state) : prev.company?.state,
        zipCode: body.zipCode != null ? String(body.zipCode) : prev.company?.zipCode,
        country: body.country != null ? String(body.country) : prev.company?.country,
        phone: body.phone != null ? String(body.phone) : prev.company?.phone,
        email: body.email != null ? String(body.email) : prev.company?.email,
        website: body.website != null ? String(body.website) : prev.company?.website,
      };

      const name = body.name != null ? String(body.name) : undefined;
      const taxId = body.taxId != null ? String(body.taxId) : undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          companyName: name ?? user.companyName,
          cui: taxId !== undefined ? taxId || null : user.cui,
          settings: {
            ...prev,
            company,
          } as object,
        } as never,
      });

      return c.json({ ok: true });
    }

    if (section === "notifications") {
      const n = body.notifications as Record<string, boolean> | undefined;
      if (!n || typeof n !== "object") return c.json({ error: "Invalid notifications" }, 400);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          settings: {
            ...prev,
            notifications: { ...defaultNotifications(), ...prev.notifications, ...n },
          } as object,
        } as never,
      });

      return c.json({ ok: true });
    }

    if (section === "appearance") {
      const accentColor = body.accentColor != null ? String(body.accentColor) : undefined;
      const compactMode = body.compactMode;
      const theme = body.theme as "dark" | "light" | "auto" | undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          settings: {
            ...prev,
            appearance: {
              ...prev.appearance,
              ...(accentColor != null ? { accentColor } : {}),
              ...(typeof compactMode === "boolean" ? { compactMode } : {}),
              ...(theme ? { theme } : {}),
            },
          } as object,
        } as never,
      });

      return c.json({ ok: true });
    }

    if (section === "security") {
      const twoFactorEnabled = body.twoFactorEnabled;
      const sessionTimeout = body.sessionTimeout != null ? String(body.sessionTimeout) : undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          settings: {
            ...prev,
            security: {
              ...prev.security,
              ...(typeof twoFactorEnabled === "boolean" ? { twoFactorEnabled } : {}),
              ...(sessionTimeout != null ? { sessionTimeout } : {}),
            },
          } as object,
        } as never,
      });

      return c.json({ ok: true });
    }

    return c.json({ error: "Unknown section" }, 400);
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("PATCH /api/settings", e);
    return c.json({ error: err?.message ?? "Server error" }, 500);
  }
});

const avatarsDir = "uploads/avatars";
const maxAvatarBytes = 2 * 1024 * 1024;

// POST /api/settings/avatar  (multipart file)
app.post("/avatar", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.parseBody();
  const file = body.file ?? body.avatar;
  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file" }, 400);
  }

  if (file.size > maxAvatarBytes) {
    return c.json({ error: "File too large (max 2MB)" }, 400);
  }

  const mime = file.type || "";
  if (!mime.startsWith("image/")) {
    return c.json({ error: "Only image files allowed" }, 400);
  }

  const ext = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : mime.includes("webp") ? "webp" : "jpg";
  if (!existsSync(avatarsDir)) {
    await mkdir(avatarsDir, { recursive: true });
  }

  const fileName = `${session.user.id}-${Date.now()}.${ext}`;
  const relativePath = `${avatarsDir}/${fileName}`;

  try {
    const buf = await file.arrayBuffer();
    await write(relativePath, buf);

    const publicUrl = `/${relativePath.replace(/\\/g, "/")}`;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: publicUrl },
    });

    return c.json({ image: publicUrl });
  } catch (e) {
    console.error("avatar upload", e);
    return c.json({ error: "Upload failed" }, 500);
  }
});

export { app as settingsRouter };
