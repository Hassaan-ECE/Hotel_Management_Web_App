import { z } from "zod";

export const reservationStatusSchema = z.enum(["pending", "confirmed", "checked-in", "checked-out", "cancelled"]);
export const roomStatusSchema = z.enum(["available", "occupied", "dirty", "cleaning", "maintenance", "ready"]);
export const maintenancePrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const maintenanceStatusSchema = z.enum(["pending-review", "open", "in-progress", "blocked", "resolved", "cancelled"]);

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
  status: z.string().trim().min(2),
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
