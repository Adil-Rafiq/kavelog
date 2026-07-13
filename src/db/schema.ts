import {
  pgTable,
  text,
  uuid,
  varchar,
  timestamp,
  date,
  time,
  pgEnum,
  integer,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum("user_role", ["admin", "employee"]);
export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "active",
  "rejected",
]);
export const shiftEnum = pgEnum("shift", ["first", "second"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "paid_leave",
]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "closed"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "registration_pending",
  "account_approved",
  "account_rejected",
  "record_edited",
  "ticket_reply",
  "ticket_opened",
]);

// ============================================================================
// DEPARTMENTS
// ============================================================================

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    shift: shiftEnum("shift").notNull().default("first"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("departments_name_idx").on(t.name),
  })
);

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("employee"),
    status: userStatusEnum("status").notNull().default("pending"),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    /**
     * When true, the daily auto-absent cron logs a fully-missed weekday as
     * Present using the user's shift default times instead of marking Absent.
     * Opt-in, self-service from the account page.
     */
    autoLogShift: boolean("auto_log_shift").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    statusIdx: index("users_status_idx").on(t.status),
  })
);

// ============================================================================
// ATTENDANCE RECORDS
// ============================================================================

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    clockIn: timestamp("clock_in", { withTimezone: true }),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    overtimeChunks: integer("overtime_chunks").notNull().default(0),
    notes: text("notes"),
    editedByAdmin: boolean("edited_by_admin").notNull().default(false),
    /**
     * True when this record was created by the nightly auto-log cron (see
     * users.autoLogShift) rather than by the employee or an admin. Cleared the
     * moment the day is manually touched, so the flag only ever marks an
     * untouched auto-fill the user can review.
     */
    autoLogged: boolean("auto_logged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: uniqueIndex("attendance_user_date_idx").on(t.userId, t.date),
    dateIdx: index("attendance_date_idx").on(t.date),
  })
);

// ============================================================================
// HOLIDAYS
// ============================================================================

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dateIdx: uniqueIndex("holidays_date_idx").on(t.date),
  })
);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    link: varchar("link", { length: 500 }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.read),
  })
);

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 200 }).notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("support_tickets_user_idx").on(t.userId),
    statusIdx: index("support_tickets_status_idx").on(t.status),
  })
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ticketIdx: index("support_messages_ticket_idx").on(t.ticketId),
  })
);

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("password_reset_token_idx").on(t.tokenHash),
    userIdx: index("password_reset_user_idx").on(t.userId),
  })
);

// ============================================================================
// SETTINGS (key-value global app settings)
// ============================================================================

export const settings = pgTable(
  "settings",
  {
    key: varchar("key", { length: 100 }).primaryKey(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

// ============================================================================
// RELATIONS
// ============================================================================

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  attendanceRecords: many(attendanceRecords),
  notifications: many(notifications),
  supportTickets: many(supportTickets),
  supportMessages: many(supportMessages),
}));

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    user: one(users, {
      fields: [attendanceRecords.userId],
      references: [users.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(
  supportTickets,
  ({ one, many }) => ({
    user: one(users, {
      fields: [supportTickets.userId],
      references: [users.id],
    }),
    messages: many(supportMessages),
  })
);

export const supportMessagesRelations = relations(
  supportMessages,
  ({ one }) => ({
    ticket: one(supportTickets, {
      fields: [supportMessages.ticketId],
      references: [supportTickets.id],
    }),
    user: one(users, {
      fields: [supportMessages.userId],
      references: [users.id],
    }),
  })
);

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type NewSupportMessage = typeof supportMessages.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type Setting = typeof settings.$inferSelect;

// ============================================================================
// SETTINGS KEYS (used as constants)
// ============================================================================

export const SETTING_KEYS = {
  OPEN_REGISTRATION: "open_registration", // "true" | "false"
} as const;
