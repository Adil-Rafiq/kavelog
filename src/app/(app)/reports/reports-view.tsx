"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
  const [loading, setLoading] = React.useState(false);

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
    if (view === "month") setMonthRows(data.rows ?? []);
    else setYearRows(data.rows ?? []);
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

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <Card className="p-4">
        <CardContent className="grid grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
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
                  <Th>Employee</Th>
                  <Th>Department</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Target</Th>
                  <Th align="right">Present</Th>
                  <Th align="right">Absent</Th>
                  <Th align="right">Leave</Th>
                  <Th align="right">OT chunks</Th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => (
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
                    <Td align="right" mono>{r.totalHours.toFixed(2)}</Td>
                    <Td align="right" mono>{r.expectedHours.toFixed(0)}</Td>
                    <Td align="right" mono>{r.daysPresent}</Td>
                    <Td align="right" mono>{r.daysAbsent}</Td>
                    <Td align="right" mono>{r.daysPaidLeave}</Td>
                    <Td align="right" mono>{r.overtimeChunks}</Td>
                  </tr>
                ))}
                {monthRows.length === 0 && (
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
                  <Th>Employee</Th>
                  <Th align="right">Total hours</Th>
                  <Th align="right">OT chunks</Th>
                  <Th align="right">Leaves used</Th>
                  <Th align="right">Leaves left</Th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.userId} className="border-t border-border/50">
                    <Td>
                      <div className="font-medium text-foreground">{r.userName}</div>
                    </Td>
                    <Td align="right" mono>{r.totalHours.toFixed(2)}</Td>
                    <Td align="right" mono>{r.totalOvertimeChunks}</Td>
                    <Td align="right" mono>{r.paidLeavesUsed}</Td>
                    <Td align="right" mono>{r.paidLeavesRemaining}</Td>
                  </tr>
                ))}
                {yearRows.length === 0 && (
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
