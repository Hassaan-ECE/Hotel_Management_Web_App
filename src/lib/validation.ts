import { z } from "zod";
import { appRoles } from "@/lib/roles";
import type { MaintenanceStatus, ReservationStatus } from "@/lib/types";

export const appRoleSchema = z.enum(appRoles);
export const reservationStatusSchema = z.enum(["pending", "confirmed", "checked-in", "checked-out", "cancelled"]);
export const roomStatusSchema = z.enum(["available", "occupied", "dirty", "cleaning", "maintenance", "ready"]);
export const maintenancePrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const maintenanceStatusSchema = z.enum(["pending-review", "open", "in-progress", "blocked", "resolved", "cancelled"]);
export const housekeepingStatusSchema = z.enum(["dirty", "cleaning", "inspection", "blocked", "ready"]);

export type HousekeepingAction = "start" | "finish" | "approve" | "send-back";

export function isReservationTransitionAllowed(current: ReservationStatus, next: ReservationStatus) {
  if (current === next) return true;
  const allowed: Record<ReservationStatus, ReservationStatus[]> = {
    pending: ["confirmed", "checked-in", "cancelled"],
    confirmed: ["checked-in", "cancelled"],
    "checked-in": ["checked-out"],
    "checked-out": [],
    cancelled: [],
  };
  return allowed[current].includes(next);
}

export function isHousekeepingActionAllowed(currentStatus: string, action: HousekeepingAction) {
  const requiredStatus: Record<HousekeepingAction, string> = {
    start: "dirty",
    finish: "cleaning",
    approve: "inspection",
    "send-back": "inspection",
  };
  return currentStatus === requiredStatus[action];
}

export function isMaintenanceCreateStatusAllowed(status: MaintenanceStatus) {
  return status === "open" || status === "in-progress" || status === "blocked";
}

export function isMaintenanceTransitionAllowed(current: MaintenanceStatus, next: MaintenanceStatus) {
  if (current === "pending-review" || next === "pending-review") return false;
  if (current === next) return true;
  if (current === "resolved" || current === "cancelled") return false;
  return isMaintenanceCreateStatusAllowed(current) && (isMaintenanceCreateStatusAllowed(next) || next === "resolved" || next === "cancelled");
}

export function normalizeSearchLimit(value: unknown): number {
  const fallback = 25;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    value = Number(trimmed);
  }
  if (typeof value !== "number") return fallback;
  if (!Number.isFinite(value)) return fallback;

  const truncated = Math.trunc(value);
  if (truncated < 1) return 1;
  if (truncated > 50) return 50;
  return truncated;
}

export const demoLoginSchema = z.object({
  code: z.string().trim().min(1),
});

export const walkInSchema = z.object({
  guestId: z.string().optional().nullable(),
  fullName: z.string().trim().min(2),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  guestNotes: z.string().trim().default(""),
  roomId: z.string().trim().min(1),
  checkIn: z.string().trim().min(8),
  checkOut: z.string().trim().min(8),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0),
  nightlyRateCents: z.coerce.number().int().min(0),
  notes: z.string().trim().default(""),
});

export const reservationStatusInputSchema = z.object({
  status: reservationStatusSchema,
});

export const guestInputSchema = z.object({
  id: z.string().optional().nullable(),
  fullName: z.string().trim().min(2),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

export const roomStatusInputSchema = z.object({
  status: roomStatusSchema,
});

export const housekeepingInputSchema = z.object({
  roomId: z.string().trim().min(1),
  title: z.string().trim().min(2),
  status: housekeepingStatusSchema,
  dueDate: z.string().trim().min(8),
});

export const assignHousekeepingSchema = z.object({
  roomId: z.string().trim().min(1),
  staffId: z.string().trim().min(1),
});

export const roomActionSchema = z.object({
  roomId: z.string().trim().min(1),
});

export const sendBackSchema = z.object({
  roomId: z.string().trim().min(1),
  reason: z.string().trim().min(2).max(120),
});

export const maintenanceInputSchema = z.object({
  id: z.string().optional().nullable(),
  roomId: z.string().trim().min(1),
  title: z.string().trim().min(2),
  priority: maintenancePrioritySchema,
  status: maintenanceStatusSchema,
  dueDate: z.string().trim().min(8),
});

export const reportRoomIssueSchema = z.object({
  roomId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(120),
});

export const reviewRoomIssueSchema = z.object({
  ticketId: z.string().trim().min(1),
  title: z.string().trim().min(2).max(120),
  priority: maintenancePrioritySchema,
});

export const cancelRoomIssueSchema = z.object({
  ticketId: z.string().trim().min(1),
});

export const rolePreviewInputSchema = z
  .object({
    role: appRoleSchema,
    staffId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((input, context) => {
    if (input.role === "housekeeping" && !input.staffId) {
      context.addIssue({
        code: "custom",
        message: "Choose a housekeeper for Housekeeper preview.",
        path: ["staffId"],
      });
    }
  });
