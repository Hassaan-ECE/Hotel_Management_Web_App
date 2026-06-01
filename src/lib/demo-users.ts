import type { AppRole } from "@/lib/types";

export type DemoLoginUser = {
  code: string;
  userId: string;
  displayName: string;
  email: string;
  role: AppRole;
  hotelIds: string[];
};

export const demoLoginUsers: DemoLoginUser[] = [
  {
    code: "0",
    userId: "demo-owner",
    displayName: "Demo Portfolio Owner",
    email: "owner@example.com",
    role: "owner",
    hotelIds: ["hotel_realistic_pecos", "hotel_realistic_roswell"],
  },
  {
    code: "1",
    userId: "staff-manager",
    displayName: "Demo Manager",
    email: "manager@example.com",
    role: "manager",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "2",
    userId: "staff-front-desk",
    displayName: "Demo Front Desk",
    email: "frontdesk@example.com",
    role: "front-desk",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "3",
    userId: "staff-housekeeping-supervisor",
    displayName: "Demo Housekeeping Supervisor",
    email: "hks@example.com",
    role: "housekeeping-supervisor",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "31",
    userId: "staff-hk-ava",
    displayName: "Ava Patel",
    email: "ava@example.com",
    role: "housekeeping",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "32",
    userId: "staff-hk-ben",
    displayName: "Ben Carter",
    email: "ben@example.com",
    role: "housekeeping",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "33",
    userId: "staff-hk-mia",
    displayName: "Mia Nguyen",
    email: "mia@example.com",
    role: "housekeeping",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "34",
    userId: "staff-hk-noah",
    displayName: "Noah Williams",
    email: "noah@example.com",
    role: "housekeeping",
    hotelIds: ["hotel_realistic_pecos"],
  },
  {
    code: "4",
    userId: "staff-maintenance",
    displayName: "Demo Maintenance",
    email: "maintenance@example.com",
    role: "maintenance",
    hotelIds: ["hotel_realistic_pecos"],
  },
];

export function demoUserForCredential(credential: string) {
  const value = credential.trim().toLowerCase();
  return demoLoginUsers.find((user) => user.code === value || user.userId.toLowerCase() === value) ?? null;
}

export function demoUserForId(userId: string) {
  return demoLoginUsers.find((user) => user.userId === userId) ?? null;
}
