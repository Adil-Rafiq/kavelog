import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { departments, users } from "@/db/schema";
import { auth } from "@/auth";
import { summarizeMonth, summarizeYear } from "@/lib/attendance";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(3000),
  month: z.coerce.number().int().min(1).max(12).optional(),
  scope: z.enum(["self", "all"]).default("self"),
  view: z.enum(["month", "ytd"]).default("month"),
  departmentId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return new Response("Invalid query", { status: 400 });
  const q = parsed.data;
  const isAdmin = session.user.role === "admin";
  const scope = isAdmin ? q.scope : "self";

  const targetUsers = await getUsers(scope, session.user.id, q.departmentId);

  let csv = "";
  let filename = "kavelog-report.csv";

  if (q.view === "month") {
    const month0 = (q.month ?? new Date().getMonth() + 1) - 1;
    const monthLabel = new Date(q.year, month0).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    filename = `kavelog-${monthLabel.replace(" ", "-").toLowerCase()}.csv`;

    csv =
      [
        "Employee",
        "Email",
        "Department",
        "Present",
        "Absent",
        "Paid Leave",
        "Hours Worked",
        "Expected Hours",
        "Overtime Chunks",
      ].join(",") + "\n";

    for (const u of targetUsers) {
      const s = await summarizeMonth(u.id, q.year, month0);
      csv +=
        [
          esc(u.name),
          esc(u.email),
          esc(u.departmentName ?? ""),
          s.daysPresent,
          s.daysAbsent,
          s.daysPaidLeave,
          s.totalHours.toFixed(2),
          s.expectedHours.toFixed(0),
          s.overtimeChunks,
        ].join(",") + "\n";
    }
  } else {
    filename = `kavelog-ytd-${q.year}.csv`;
    csv =
      [
        "Employee",
        "Email",
        "Department",
        "Total Hours",
        "Overtime Chunks",
        "Paid Leaves Used",
        "Paid Leaves Remaining",
      ].join(",") + "\n";
    for (const u of targetUsers) {
      const s = await summarizeYear(u.id, q.year);
      csv +=
        [
          esc(u.name),
          esc(u.email),
          esc(u.departmentName ?? ""),
          s.totalHours.toFixed(2),
          s.totalOvertimeChunks,
          s.paidLeavesUsed,
          s.paidLeavesRemaining,
        ].join(",") + "\n";
    }
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function esc(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function getUsers(
  scope: "self" | "all",
  selfId: string,
  departmentId?: string
) {
  if (scope === "self") {
    const [u] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, selfId))
      .limit(1);
    return u ? [u] : [];
  }
  const where = departmentId
    ? and(eq(users.status, "active"), eq(users.departmentId, departmentId))
    : eq(users.status, "active");
  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(asc(users.name));
}
