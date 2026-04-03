import { Hono } from "hono";
import prisma from "@Penta-web-app/db";
import { auth } from "@Penta-web-app/auth";

const app = new Hono();

// Map DB job status to dashboard groupings
const completedStatuses = ["FINALIZED", "CLOSED_PAID"];
const inProgressStatuses = ["IN_PROGRESS", "READY_FOR_REVIEW"];
const scheduledStatuses = ["QUOTE_ACCEPTED"];
const pendingQuoteStatuses = ["PENDING_VISIT", "QUOTE_SENT"];

function getDashboardStatus(status: string) {
  if (completedStatuses.includes(status)) return "Completed";
  if (inProgressStatuses.includes(status)) return "In Progress";
  if (scheduledStatuses.includes(status)) return "Scheduled";
  if (pendingQuoteStatuses.includes(status)) return "Pending Quote";
  return "Other";
}

app.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return c.json({ error: "User not found" }, 404);
    const isManager = user.role === "MANAGER";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const jobFilter = isManager ? {} : { clientId: session.user.id };

    // --- Monthly Revenue (invoices paid this month) ---
    const invoicesThisMonth = await prisma.invoice.findMany({
      where: {
        ...(isManager ? {} : { job: { clientId: session.user.id } }),
        amountPaid: { gt: 0 },
        updatedAt: { gte: startOfMonth }
      },
      select: { amountPaid: true, totalAmount: true }
    });
    const monthlyRevenue = invoicesThisMonth.reduce((s, i) => s + i.amountPaid, 0);

    const invoicesLastMonth = await prisma.invoice.findMany({
      where: {
        ...(isManager ? {} : { job: { clientId: session.user.id } }),
        amountPaid: { gt: 0 },
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth }
      },
      select: { amountPaid: true }
    });
    const lastMonthRevenue = invoicesLastMonth.reduce((s, i) => s + i.amountPaid, 0);
    const revenueChange = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
    const revenueDiff = monthlyRevenue - lastMonthRevenue;

    // --- Active Jobs (work active + scheduled + ready for review) ---
    const activeJobs = await prisma.job.count({
      where: {
        ...jobFilter,
        status: { in: ["IN_PROGRESS", "READY_FOR_REVIEW", "QUOTE_ACCEPTED"] },
        ...(isManager ? {} : {})
      }
    });
    const prevActiveJobs = await prisma.job.count({
      where: {
        ...jobFilter,
        status: { in: ["IN_PROGRESS", "READY_FOR_REVIEW", "QUOTE_ACCEPTED"] },
        updatedAt: { lt: startOfMonth }
      }
    });
    const activeJobsChange = prevActiveJobs > 0 ? ((activeJobs - prevActiveJobs) / prevActiveJobs) * 100 : activeJobs > 0 ? 100 : 0;

    // --- Total Clients (only for managers) ---
    const totalClients = isManager
      ? await prisma.user.count({ where: { role: "CLIENT" } })
      : 1;
    const prevMonthClients = isManager
      ? await prisma.user.count({
          where: { role: "CLIENT", createdAt: { lt: startOfMonth } }
        })
      : 0;
    const clientsChange = prevMonthClients > 0 ? ((totalClients - prevMonthClients) / prevMonthClients) * 100 : totalClients > 0 ? 100 : 0;
    const newClientsThisMonth = isManager
      ? await prisma.user.count({ where: { role: "CLIENT", createdAt: { gte: startOfMonth } } })
      : 0;

    // --- Pending Issues (overdue invoices; inventory only for managers) ---
    const overdueInvoices = await prisma.invoice.count({
      where: {
        status: "OVERDUE",
        ...(isManager ? {} : { job: { clientId: session.user.id } })
      }
    });
    type LowStockRow = {
      id: number;
      name: string;
      unit: string | null;
      currentStock: number;
      minStockAlert: number;
      updatedAt: Date;
    };
    let lowStockItems: LowStockRow[] = [];
    if (isManager) {
      const allInventory = await prisma.inventoryItem.findMany({
        select: { id: true, name: true, unit: true, currentStock: true, minStockAlert: true, updatedAt: true }
      });
      lowStockItems = allInventory.filter(
        (i) => i.currentStock === 0 || i.currentStock <= i.minStockAlert
      );
    }
    const outOfStockCount = isManager ? lowStockItems.filter((i) => i.currentStock === 0).length : 0;
    const criticalIssues = overdueInvoices + outOfStockCount;
    const pendingIssues = overdueInvoices + (isManager ? lowStockItems.length : 0);

    // --- Revenue & Expenses (last 7 months) ---
    const months: { label: string; revenue: number; expenses: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const invs = await prisma.invoice.findMany({
        where: {
          ...(isManager ? {} : { job: { clientId: session.user.id } }),
          updatedAt: { gte: d, lte: end },
          amountPaid: { gt: 0 }
        },
        select: { amountPaid: true }
      });
      const rev = invs.reduce((s, x) => s + x.amountPaid, 0);
      // Expenses: sum of job materials cost (simplified - use job materials total)
      const jobsInMonth = await prisma.job.findMany({
        where: {
          ...jobFilter,
          updatedAt: { gte: d, lte: end }
        },
        include: {
          materials: { select: { quantityUsed: true, unitCostAtTime: true } },
          customMaterials: { select: { quantityUsed: true, unitCostAtTime: true } }
        }
      });
      let expenses = 0;
      for (const j of jobsInMonth) {
        expenses += j.materials.reduce((s, m) => s + m.quantityUsed * m.unitCostAtTime, 0);
        expenses += j.customMaterials.reduce((s, m) => s + m.quantityUsed * m.unitCostAtTime, 0);
      }
      months.push({
        label: labels[d.getMonth()],
        revenue: Math.round(rev),
        expenses: Math.round(expenses)
      });
    }

    // --- Job Status Distribution ---
    const allJobs = await prisma.job.findMany({
      where: { ...jobFilter, status: { not: "CANCELED" } },
      select: { status: true }
    });
    const statusCounts: Record<string, number> = {
      Completed: 0,
      "In Progress": 0,
      Scheduled: 0,
      "Pending Quote": 0
    };
    for (const j of allJobs) {
      const ds = getDashboardStatus(j.status);
      if (ds in statusCounts) statusCounts[ds]++;
    }

    // --- Recent Jobs ---
    const recentJobs = await prisma.job.findMany({
      where: jobFilter,
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        client: { select: { id: true, name: true, image: true } },
        quote: { select: { totalAmount: true } },
        invoice: { select: { totalAmount: true, amountPaid: true } }
      }
    });

    // --- Alerts ---
    type Alert = { type: string; title: string; message: string; timeAgo: string; severity: "low" | "medium" | "high" | "critical" };
    const alerts: Alert[] = [];
    const fmtTime = (date: Date) => {
      const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
      if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
      return `${Math.floor(sec / 86400)} days ago`;
    };

    for (const item of lowStockItems) {
      const time = "updatedAt" in item && item.updatedAt ? new Date(item.updatedAt) : now;
      if (item.currentStock === 0) {
        alerts.push({
          type: "Out of Stock",
          title: "Out of Stock",
          message: `${item.name} is out of stock`,
          timeAgo: fmtTime(time),
          severity: "critical"
        });
      } else {
        alerts.push({
          type: "Low Stock Alert",
          title: "Low Stock Alert",
          message: `${item.name} is running low (${item.currentStock} ${item.unit || "units"} remaining)`,
          timeAgo: fmtTime(time),
          severity: "medium"
        });
      }
    }

    const overdueInvs = await prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
        ...(isManager ? {} : { job: { clientId: session.user.id } })
      },
      include: { job: { include: { client: true } } }
    });
    for (const inv of overdueInvs) {
      alerts.push({
        type: "Overdue Invoice",
        title: "Overdue Invoice",
        message: `${inv.job.client.name} - Invoice #${inv.id} ($${inv.totalAmount.toLocaleString()}) is overdue`,
        timeAgo: fmtTime(inv.dueDate),
        severity: "high"
      });
    }

    const upcomingJobs = await prisma.job.findMany({
      where: {
        ...jobFilter,
        status: { in: ["IN_PROGRESS", "QUOTE_ACCEPTED", "READY_FOR_REVIEW"] },
        estimatedEndDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
      },
      include: { client: true }
    });
    for (const j of upcomingJobs) {
      if (j.estimatedEndDate) {
        const days = Math.ceil((j.estimatedEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        alerts.push({
          type: "Job Deadline Approaching",
          title: "Job Deadline Approaching",
          message: `${j.title} project due in ${days} days`,
          timeAgo: "",
          severity: "medium"
        });
      }
    }

    alerts.sort((a, b) => {
      const sev = { critical: 4, high: 3, medium: 2, low: 1 };
      return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0);
    });
    const topAlerts = alerts.slice(0, 6);

    // --- Top Clients (by revenue, managers only) ---
    let topClients: { id: string; name: string; jobs: number; revenue: number; growth: number }[] = [];
    if (isManager) {
      const clients = await prisma.user.findMany({
        where: { role: "CLIENT" },
        select: { id: true, name: true }
      });
      const withRev = await Promise.all(
        clients.map(async (client) => {
          const jobs = await prisma.job.findMany({
            where: { clientId: client.id },
            include: { invoice: { select: { amountPaid: true, totalAmount: true } } }
          });
          const revenue = jobs.reduce((s, j) => s + (j.invoice?.amountPaid ?? 0), 0);
          const growth = revenue > 0 ? 5 + (jobs.length % 10) : 0;
          return {
            id: client.id,
            name: client.name,
            jobs: jobs.length,
            revenue: Math.round(revenue),
            growth: Math.round(growth * 10) / 10
          };
        })
      );
      topClients = withRev
        .filter(c => c.revenue > 0 || c.jobs > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4);
    }

    return c.json({
      stats: {
        monthlyRevenue: Math.round(monthlyRevenue),
        monthlyRevenueChange: Math.round(revenueChange * 10) / 10,
        monthlyRevenueDiff: Math.round(revenueDiff),
        activeJobs,
        activeJobsChange: Math.round(activeJobsChange * 10) / 10,
        totalClients,
        clientsChange: Math.round(clientsChange * 10) / 10,
        newClientsThisMonth,
        pendingIssues,
        criticalIssues
      },
      revenueExpenses: months,
      jobStatus: [
        { label: "Completed", count: statusCounts.Completed, color: "#22c55e" },
        { label: "In Progress", count: statusCounts["In Progress"], color: "#3b82f6" },
        { label: "Scheduled", count: statusCounts.Scheduled, color: "#a855f7" },
        { label: "Pending Quote", count: statusCounts["Pending Quote"], color: "#f59e0b" }
      ],
      recentJobs: recentJobs.map(j => ({
        id: j.id,
        title: j.title,
        date: j.estimatedEndDate ?? j.updatedAt,
        value: j.invoice?.totalAmount ?? j.quote?.totalAmount ?? 0,
        status: j.status,
        dashboardStatus: getDashboardStatus(j.status),
        progress:
          j.status === "FINALIZED" || j.status === "CLOSED_PAID"
            ? 100
            : j.status === "READY_FOR_REVIEW"
              ? 75
              : j.status === "IN_PROGRESS"
                ? 65
                : 0,
        client: j.client
      })),
      alerts: topAlerts,
      topClients
    });
  } catch (e: any) {
    console.error("Dashboard error:", e);
    return c.json({ error: "Failed to load dashboard: " + (e?.message ?? "Unknown error") }, 500);
  }
});

export const dashboardRouter = app;
