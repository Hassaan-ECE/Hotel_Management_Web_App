import type { AppRole, StaffRole } from "@/lib/types";

export const roleLabels: Record<AppRole, string> = {
  owner: "Admin",
  manager: "Manager",
  "front-desk": "Front desk",
  housekeeping: "Housekeeper",
  "housekeeping-supervisor": "Housekeeping supervisor",
  maintenance: "Maintenance",
};

export function roleAllowed(role: AppRole, allowed: readonly AppRole[]) {
  return role === "owner" || allowed.includes(role);
}

export function defaultHotelScreen(role: AppRole) {
  if (role === "owner" || role === "manager") return "manager";
  if (role === "housekeeping-supervisor") return "housekeeping-supervisor";
  if (role === "housekeeping") return "housekeeping";
  if (role === "maintenance") return "maintenance";
  return "front-desk";
}

export function staffRoleFromMembership(role: AppRole): StaffRole | null {
  return role === "owner" ? null : role;
}
