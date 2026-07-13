"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatHours } from "@/lib/utils";

interface MonthRow {
  userId: string;
  userName: string;
  email: string;
  department: string | null;
  daysPresent: number;
  daysAbsent: number;
  daysPaidLeave: number;
  totalHours: number;
  expectedHours: number;
  overtimeChunks: number;
}

interface YearRow {
  userId: string;
  userName: string;
  paidLeavesUsed: number;
  paidLeavesRemaining: number;
  totalOvertimeChunks: number;
  totalHours: number;
}

interface DailyEntry {
  date: string;
  hours: number;
  status: "present" | "absent" | "paid_leave" | null;
  overtimeChunks: number;
  isHoliday: boolean;
  isWeekend: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ReportsView({ role }: { role: "admin" | "employee" }) {
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [scope, setScope] = React.useState<"self" | "all">(
    role === "admin" ? "all" : "self"
  );
  const [departmentId, setDepartmentId] = React.useState<string>("");
  const [view, setView] = React.useState<"month" | "ytd">("month");

  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const [monthRows, setMonthRows] = React.useState<MonthRow[]>([]);
  const [yearRows, setYearRows] = React.useState<YearRow[]>([]);
  const [daily, setDaily] = React.useState<DailyEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [monthSort, setMonthSort] = React.useState<{
    key: keyof MonthRow;
    dir: "asc" | "desc";
  }>({ key: "userName", dir: "asc" });
  const [yearSort, setYearSort] = React.useState<{
    key: keyof YearRow;
    dir: "asc" | "desc";
  }>({ key: "userName", dir: "asc" });

  React.useEffect(() => {
    if (role !== "admin") return;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.items ?? []))
      .catch(() => {});
  }, [role]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const url = new URL("/api/reports", window.location.origin);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    url.searchParams.set("scope", scope);
    url.searchParams.set("view", view);
    if (departmentId) url.searchParams.set("departmentId", departmentId);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (view === "month") {
      setMonthRows(data.rows ?? []);
      setDaily(data.daily ?? null);
    } else {
      setYearRows(data.rows ?? []);
      setDaily(null);
    }
    setLoading(false);
  }, [year, month, scope, view, departmentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const url = new URL("/api/reports/csv", window.location.origin);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    url.searchParams.set("scope", scope);
    url.searchParams.set("view", view);
    if (departmentId) url.searchParams.set("departmentId", departmentId);
    window.location.href = url.toString();
  }

  const monthAggregate = React.useMemo(() => {
    if (monthRows.length === 0) {
      return {
        totalHours: 0,
        expectedHours: 0,
        present: 0,
        absent: 0,
        leave: 0,
        ot: 0,
        attendancePct: 0,
      };
    }
    let totalHours = 0;
    let expectedHours = 0;
    let present = 0;
    let absent = 0;
    let leave = 0;
    let ot = 0;
    for (const r of monthRows) {
      totalHours += r.totalHours;
      expectedHours += r.expectedHours;
      present += r.daysPresent;
      absent += r.daysAbsent;
      leave += r.daysPaidLeave;
      ot += r.overtimeChunks;
    }
    const denom = present + absent + leave;
    return {
      totalHours,
      expectedHours,
      present,
      absent,
      leave,
      ot,
      attendancePct: denom === 0 ? 0 : ((present + leave) / denom) * 100,
    };
  }, [monthRows]);

  const sortedMonthRows = React.useMemo(
    () => sortRows(monthRows, monthSort.key, monthSort.dir),
    [monthRows, monthSort]
  );
  const sortedYearRows = React.useMemo(
    () => sortRows(yearRows, yearSort.key, yearSort.dir),
    [yearRows, yearSort]
  );

  function toggleMonthSort(key: keyof MonthRow) {
    setMonthSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDirFor(key) }
    );
  }
  function toggleYearSort(key: keyof YearRow) {
    setYearSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: defaultDirFor(key) }
    );
  }

  const yearAggregate = React.useMemo(() => {
    if (yearRows.length === 0) {
      return { totalHours: 0, ot: 0, leavesUsed: 0 };
    }
    let totalHours = 0;
    let ot = 0;
    let leavesUsed = 0;
    for (const r of yearRows) {
      totalHours += r.totalHours;
      ot += r.totalOvertimeChunks;
      leavesUsed += r.paidLeavesUsed;
    }
    return { totalHours, ot, leavesUsed };
  }, [yearRows]);

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <Card className="p-4" data-tour="reports">
        <CardContent
          className={cn(
            "grid grid-cols-1 gap-4 p-0 sm:grid-cols-2",
            role === "admin" ? "lg:grid-cols-5" : "lg:grid-cols-3"
          )}
        >
          <div className="flex flex-col gap-1.5">
            <Label>View</Label>
            <Select
              value={view}
              onChange={(e) => setView(e.target.value as "month" | "ytd")}
            >
              <option value="month">Monthly</option>
              <option value="ytd">Year-to-date</option>
            </Select>
          </div>
          {view === "month" && (
            <div className="flex flex-col gap-1.5">
              <Label>Month</Label>
              <Select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Year</Label>
            <Select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const y = now.getFullYear() - 2 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </Select>
          </div>
          {role === "admin" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Scope</Label>
                <Select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "self" | "all")}
                >
                  <option value="all">All employees</option>
                  <option value="self">Just me</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Aggregate stat cards + charts */}
      {view === "month" && monthRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4">
              <Stat
                label="Total hours"
                value={formatHours(monthAggregate.totalHours)}
                unit={`/ ${monthAggregate.expectedHours.toFixed(0)} h`}
                hint={
                  monthAggregate.expectedHours > 0
                    ? `${Math.round(
                        (monthAggregate.totalHours /
                          monthAggregate.expectedHours) *
                          100
                      )}% of target`
                    : undefined
                }
              />
            </Card>
            <Card className="p-4">
              <Stat
                label="Attendance"
                value={`${monthAggregate.attendancePct.toFixed(0)}%`}
                hint={`${monthAggregate.present} present · ${monthAggregate.absent} absent`}
              />
            </Card>
            <Card className="p-4">
              <Stat
                label="OT chunks"
                value={monthAggregate.ot}
                unit="× 30m"
                hint={
                  monthRows.length > 0
                    ? `avg ${(monthAggregate.ot / monthRows.length).toFixed(1)} per person`
                    : undefined
                }
              />
            </Card>
            <Card className="p-4">
              <Stat
                label="Paid leaves"
                value={monthAggregate.leave}
                unit="days"
                hint={`across ${monthRows.length} ${monthRows.length === 1 ? "person" : "people"}`}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {monthRows.length === 1 && daily ? (
              <>
                <DailyHoursChart daily={daily} year={year} month0={month - 1} />
                <StatusBreakdownChart
                  present={monthAggregate.present}
                  absent={monthAggregate.absent}
                  leave={monthAggregate.leave}
                />
              </>
            ) : (
              <>
                <HoursVsTargetChart rows={monthRows} />
                <StatusBreakdownChart
                  present={monthAggregate.present}
                  absent={monthAggregate.absent}
                  leave={monthAggregate.leave}
                />
              </>
            )}
          </div>
        </>
      )}

      {view === "ytd" && yearRows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card className="p-4">
              <Stat
                label="Total hours (YTD)"
                value={formatHours(yearAggregate.totalHours)}
                unit="h"
                hint={`across ${yearRows.length} ${yearRows.length === 1 ? "person" : "people"}`}
              />
            </Card>
            <Card className="p-4">
              <Stat
                label="OT chunks (YTD)"
                value={yearAggregate.ot}
                unit="× 30m"
              />
            </Card>
            <Card className="p-4">
              <Stat
                label="Paid leaves used"
                value={yearAggregate.leavesUsed}
                unit="days"
                hint={
                  yearRows.length > 0
                    ? `avg ${(yearAggregate.leavesUsed / yearRows.length).toFixed(1)} per person`
                    : undefined
                }
              />
            </Card>
          </div>
          <YtdHoursChart rows={yearRows} />
        </>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {loading ? "Loading…" : view === "month"
            ? `${MONTHS[month - 1]} ${year} · ${monthRows.length} ${monthRows.length === 1 ? "row" : "rows"}`
            : `${year} YTD · ${yearRows.length} ${yearRows.length === 1 ? "row" : "rows"}`}
        </span>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      {/* Tables */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {view === "month" ? (
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <SortTh sortKey="userName" sort={monthSort} onClick={toggleMonthSort}>
                    Employee
                  </SortTh>
                  <SortTh sortKey="department" sort={monthSort} onClick={toggleMonthSort}>
                    Department
                  </SortTh>
                  <SortTh align="right" sortKey="totalHours" sort={monthSort} onClick={toggleMonthSort}>
                    Hours
                  </SortTh>
                  <SortTh align="right" sortKey="expectedHours" sort={monthSort} onClick={toggleMonthSort}>
                    Target
                  </SortTh>
                  <SortTh align="right" sortKey="daysPresent" sort={monthSort} onClick={toggleMonthSort}>
                    Present
                  </SortTh>
                  <SortTh align="right" sortKey="daysAbsent" sort={monthSort} onClick={toggleMonthSort}>
                    Absent
                  </SortTh>
                  <SortTh align="right" sortKey="daysPaidLeave" sort={monthSort} onClick={toggleMonthSort}>
                    Leave
                  </SortTh>
                  <SortTh align="right" sortKey="overtimeChunks" sort={monthSort} onClick={toggleMonthSort}>
                    OT chunks
                  </SortTh>
                </tr>
              </thead>
              <tbody>
                {loading && monthRows.length === 0 ? (
                  <SkeletonRows cols={8} />
                ) : (
                  sortedMonthRows.map((r) => (
                    <tr key={r.userId} className="border-t border-border/50">
                      <Td>
                        <div className="font-medium text-foreground">{r.userName}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </Td>
                      <Td>
                        {r.department ? (
                          <Badge variant="outline">{r.department}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td align="right" mono>{formatHours(r.totalHours)}</Td>
                      <Td align="right" mono>{r.expectedHours.toFixed(0)}</Td>
                      <Td align="right" mono>{r.daysPresent}</Td>
                      <Td align="right" mono>{r.daysAbsent}</Td>
                      <Td align="right" mono>{r.daysPaidLeave}</Td>
                      <Td align="right" mono>{r.overtimeChunks}</Td>
                    </tr>
                  ))
                )}
                {!loading && monthRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No data for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <SortTh sortKey="userName" sort={yearSort} onClick={toggleYearSort}>
                    Employee
                  </SortTh>
                  <SortTh align="right" sortKey="totalHours" sort={yearSort} onClick={toggleYearSort}>
                    Total hours
                  </SortTh>
                  <SortTh align="right" sortKey="totalOvertimeChunks" sort={yearSort} onClick={toggleYearSort}>
                    OT chunks
                  </SortTh>
                  <SortTh align="right" sortKey="paidLeavesUsed" sort={yearSort} onClick={toggleYearSort}>
                    Leaves used
                  </SortTh>
                  <SortTh align="right" sortKey="paidLeavesRemaining" sort={yearSort} onClick={toggleYearSort}>
                    Leaves left
                  </SortTh>
                </tr>
              </thead>
              <tbody>
                {loading && yearRows.length === 0 ? (
                  <SkeletonRows cols={5} />
                ) : (
                  sortedYearRows.map((r) => (
                    <tr key={r.userId} className="border-t border-border/50">
                      <Td>
                        <div className="font-medium text-foreground">{r.userName}</div>
                      </Td>
                      <Td align="right" mono>{formatHours(r.totalHours)}</Td>
                      <Td align="right" mono>{r.totalOvertimeChunks}</Td>
                      <Td align="right" mono>{r.paidLeavesUsed}</Td>
                      <Td align="right" mono>{r.paidLeavesRemaining}</Td>
                    </tr>
                  ))
                )}
                {!loading && yearRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No data for this year.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function SortTh<K extends string>({
  children,
  align = "left",
  sortKey,
  sort,
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortKey: K;
  sort: { key: K; dir: "asc" | "desc" };
  onClick: (key: K) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = active
    ? sort.dir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <th
      className={cn(
        "px-4 py-3",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground"
        )}
      >
        {children}
        <Icon size={11} className={cn(!active && "opacity-50")} />
      </button>
    </th>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-t border-border/50">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <span className="block h-3 w-full max-w-[80px] animate-pulse rounded bg-muted-foreground/15" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function defaultDirFor(key: string): "asc" | "desc" {
  // Numeric columns default to descending (most-of-thing first); names asc.
  return key === "userName" || key === "department" || key === "email"
    ? "asc"
    : "desc";
}

function sortRows<T>(rows: T[], key: keyof T, dir: "asc" | "desc"): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * sign;
    }
    return String(av).localeCompare(String(bv)) * sign;
  });
}

function Td({
  children,
  align = "left",
  mono,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} ${
        mono ? "font-mono tabular text-foreground" : ""
      }`}
    >
      {children}
    </td>
  );
}

/**
 * Horizontal bar chart of hours worked per employee for the selected month,
 * with a marker line at the per-employee target.
 */
function HoursVsTargetChart({ rows }: { rows: MonthRow[] }) {
  const LIMIT = 12;
  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => b.totalHours - a.totalHours).slice(0, LIMIT),
    [rows]
  );
  const hidden = Math.max(0, rows.length - sorted.length);
  const max = Math.max(
    1,
    ...sorted.map((r) => Math.max(r.totalHours, r.expectedHours))
  );
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Hours vs target
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {hidden > 0 ? `Top ${sorted.length} of ${rows.length}` : `${sorted.length} ${sorted.length === 1 ? "person" : "people"}`}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {sorted.map((r) => {
          const pct = (r.totalHours / max) * 100;
          const targetPct = (r.expectedHours / max) * 100;
          const meetsTarget =
            r.expectedHours > 0 && r.totalHours >= r.expectedHours;
          return (
            <div key={r.userId} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{r.userName}</span>
                <span className="font-mono tabular text-muted-foreground">
                  {formatHours(r.totalHours)}
                  {r.expectedHours > 0 && (
                    <span className="text-muted-foreground/60">
                      {" / "}
                      {r.expectedHours.toFixed(0)}h
                    </span>
                  )}
                </span>
              </div>
              <div
                className="relative h-2 overflow-hidden rounded-full bg-secondary/50"
                role="img"
                aria-label={`${r.userName}: ${formatHours(r.totalHours)} of ${r.expectedHours.toFixed(0)} hour target`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    meetsTarget ? "bg-success" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
                {r.expectedHours > 0 && (
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/40"
                    style={{ left: `${targetPct}%` }}
                    aria-hidden
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          + {hidden} more — see full table below
        </p>
      )}
    </Card>
  );
}

/**
 * Donut/segmented bar showing the present / absent / leave split for the month.
 */
function StatusBreakdownChart({
  present,
  absent,
  leave,
}: {
  present: number;
  absent: number;
  leave: number;
}) {
  const total = present + absent + leave;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const segments = [
    { key: "present", label: "Present", value: present, color: "bg-success" },
    { key: "absent", label: "Absent", value: absent, color: "bg-destructive" },
    { key: "leave", label: "Paid leave", value: leave, color: "bg-warning" },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Status breakdown
        </h3>
        <span className="font-mono text-[10px] tabular text-muted-foreground">
          {total} {total === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary/50">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className={cn("h-full transition-all", s.color)}
              style={{ width: `${pct(s.value)}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ) : null
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        {segments.map((s) => (
          <div key={s.key} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", s.color)} />
              {s.label}
            </span>
            <span className="font-mono tabular text-foreground">
              {s.value}
              <span className="text-muted-foreground">
                {" "}
                · {pct(s.value).toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Vertical bar chart of daily hours for a single user across one month.
 * Color-codes status (present/absent/leave) and dims weekends; holidays
 * get an info-tinted bar background.
 */
function DailyHoursChart({
  daily,
  year,
  month0,
}: {
  daily: DailyEntry[];
  year: number;
  month0: number;
}) {
  const max = Math.max(8, ...daily.map((d) => d.hours));
  const monthLabel = new Date(year, month0).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">Daily hours</h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {monthLabel}
        </span>
      </div>
      <div className="flex h-40 items-end gap-[2px]">
        {daily.map((d) => {
          const dayNum = parseInt(d.date.slice(-2), 10);
          const heightPct = max > 0 ? (d.hours / max) * 100 : 0;
          const barColor =
            d.status === "present"
              ? "bg-success"
              : d.status === "paid_leave"
                ? "bg-warning"
                : d.status === "absent"
                  ? "bg-destructive/70"
                  : "bg-muted-foreground/20";
          const tooltip = d.hours
            ? `${d.date}: ${formatHours(d.hours)}h${d.overtimeChunks ? ` +${d.overtimeChunks} OT` : ""}`
            : `${d.date}: ${d.status ?? (d.isHoliday ? "holiday" : d.isWeekend ? "weekend" : "no record")}`;
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col items-center"
              title={tooltip}
            >
              <div
                className={cn(
                  "flex w-full flex-1 items-end rounded-t-sm",
                  d.isHoliday && "bg-info/10",
                  d.isWeekend && !d.status && "opacity-50"
                )}
              >
                <div
                  className={cn("w-full rounded-t-sm transition-all", barColor)}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="mt-1 font-mono text-[8px] tabular text-muted-foreground/60">
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <LegendSwatch className="bg-success" label="Present" />
        <LegendSwatch className="bg-warning" label="Leave" />
        <LegendSwatch className="bg-destructive/70" label="Absent" />
        <LegendSwatch className="bg-info/30" label="Holiday" />
      </div>
    </Card>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-sm", className)} />
      {label}
    </span>
  );
}

function YtdHoursChart({ rows }: { rows: YearRow[] }) {
  const LIMIT = 12;
  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => b.totalHours - a.totalHours).slice(0, LIMIT),
    [rows]
  );
  const hidden = Math.max(0, rows.length - sorted.length);
  const max = Math.max(1, ...sorted.map((r) => r.totalHours));
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Total hours (YTD)
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {hidden > 0 ? `Top ${sorted.length} of ${rows.length}` : `${sorted.length} ${sorted.length === 1 ? "person" : "people"}`}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {sorted.map((r) => (
          <div key={r.userId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{r.userName}</span>
              <span className="font-mono tabular text-muted-foreground">
                {formatHours(r.totalHours)}
                {r.totalOvertimeChunks > 0 && (
                  <span className="ml-2 text-warning">
                    +{r.totalOvertimeChunks} OT
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary/50">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(r.totalHours / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          + {hidden} more — see full table below
        </p>
      )}
    </Card>
  );
}
