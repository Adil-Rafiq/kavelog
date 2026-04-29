import { NextResponse } from "next/server";
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
  if (!session?.user) return NextResponse.json({ rows: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const isAdmin = session.user.role === "admin";
  const scope = isAdmin ? q.scope : "self";

  const targetUsers = await selectUsers(scope, session.user.id, q.departmentId);

  if (q.view === "month") {
    const month0 = (q.month ?? new Date().getMonth() + 1) - 1;
    const rows = await Promise.all(
      targetUsers.map(async (u) => {
        const s = await summarizeMonth(u.id, q.year, month0);
        return {
          userId: u.id,
          userName: u.name,
          email: u.email,
          department: u.departmentName,
          daysPresent: s.daysPresent,
          daysAbsent: s.daysAbsent,
          daysPaidLeave: s.daysPaidLeave,
          totalHours: s.totalHours,
          expectedHours: s.expectedHours,
          overtimeChunks: s.overtimeChunks,
        };
      })
    );
    return NextResponse.json({ rows });
  } else {
    const rows = await Promise.all(
      targetUsers.map(async (u) => {
        const s = await summarizeYear(u.id, q.year);
        return {
          userId: u.id,
          userName: u.name,
          paidLeavesUsed: s.paidLeavesUsed,
          paidLeavesRemaining: s.paidLeavesRemaining,
          totalOvertimeChunks: s.totalOvertimeChunks,
          totalHours: s.totalHours,
        };
      })
    );
    return NextResponse.json({ rows });
  }
}

async function selectUsers(
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
