import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarView } from "./calendar-view";
import {
  getHolidaysBetween,
  getRecordsBetween,
  getUserContext,
  summarizeMonth,
} from "@/lib/attendance";
import { toDateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const now = new Date();
  const year = sp.y ? parseInt(sp.y, 10) : now.getFullYear();
  const month0 = sp.m ? parseInt(sp.m, 10) - 1 : now.getMonth();

  const userId = session.user.id;
  const ctx = await getUserContext(userId);

  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const [records, hols, summary] = await Promise.all([
    getRecordsBetween(userId, startKey, endKey),
    getHolidaysBetween(startKey, endKey),
    summarizeMonth(userId, year, month0),
  ]);

  return (
    <CalendarView
      year={year}
      month0={month0}
      records={records.map((r) => ({
        ...r,
        clockIn: r.clockIn?.toISOString() ?? null,
        clockOut: r.clockOut?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      holidays={hols.map((h) => ({ date: h.date, name: h.name }))}
      summary={summary}
      shift={ctx.shift}
      isAdmin={session.user.role === "admin"}
      targetUserId={userId}
    />
  );
}
