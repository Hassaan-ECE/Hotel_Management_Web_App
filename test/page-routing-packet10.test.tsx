import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AppRole, HostedSession, HotelMembership } from "@/lib/types";

type Identity = {
  userId: string;
  clerkOrganizationId: string | null;
  displayName: string;
  email: string;
};

let redirectCalls: string[] = [];
let signInProps: Record<string, unknown> | null = null;

let demoMode = false;
let clerkConfigured = true;
let databaseConfigured = true;
let identity: Identity | null = null;
let memberships: HotelMembership[] = [];
let listMembershipCalls: string[] = [];
let requireAnyHotelSessionCalls = 0;
let requireAnySessionRole: AppRole = "owner";
let requireAnySessionHotelId = "hotel-1";
let requireAnySessionMemberships: HotelMembership[] = [];
let loadPortfolioCalls: HostedSession[] = [];
let loadPortfolioCalled = false;
const loadPortfolioResult = {
  session: {
    userId: "fallback-user",
    displayName: "Fallback User",
    organizationId: "fallback-org",
    role: "owner" as const,
  },
  hotels: [],
  totals: {
    hotels: 0,
    rooms: 0,
    inHouse: 0,
    arrivalsToday: 0,
    departuresToday: 0,
    openMaintenance: 0,
    revenueCents: 0,
  },
};

mock.module("next/navigation", () => ({
  redirect: (href: string) => {
    redirectCalls.push(href);
    const error = new Error(`REDIRECT:${href}`);
    throw error;
  },
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
}));

mock.module("@clerk/nextjs", () => ({
  SignIn: (props: Record<string, unknown>) => {
    signInProps = props;
    return <div>Mock SignIn</div>;
  },
  UserButton: () => <div>Mock UserButton</div>,
}));

mock.module("@/lib/db", () => ({
  isDatabaseConfigured: () => databaseConfigured,
  getSql: () => {
    throw new Error("getSql should be mocked in the module under test.");
  },
  getDb: () => {
    throw new Error("getDb should be mocked in the module under test.");
  },
}));

mock.module("@/lib/authz", () => ({
  demoSessionCookie: "hotel_demo_user_id",
  getIdentity: async () => identity,
  requireIdentity: async () => {
    if (!identity) throw new Error("identity required");
    return identity;
  },
  isClerkConfigured: () => clerkConfigured,
  isDemoMode: () => demoMode,
  listMembershipsForUser: async (userId: string) => {
    listMembershipCalls.push(userId);
    return memberships;
  },
  requireAnyHotelSession: async () => {
    requireAnyHotelSessionCalls += 1;
    if (!identity) {
      throw new Error("identity required");
    }
    const resolvedMemberships = requireAnySessionMemberships.length > 0 ? requireAnySessionMemberships : memberships;
    return {
      identity,
      memberships: resolvedMemberships,
      session: {
        userId: identity.userId,
        displayName: identity.displayName,
        organizationId: identity.clerkOrganizationId ?? "org-missing",
        role: requireAnySessionRole,
        activeHotelId: resolvedMemberships[0]?.hotelId ?? requireAnySessionHotelId,
      },
    };
  },
  requireHotelSession: async (hotelId: string) => {
    if (!identity) throw new Error("identity required");
    return {
      identity,
      memberships: requireAnySessionMemberships,
      session: {
        userId: identity.userId,
        displayName: identity.displayName,
        organizationId: identity.clerkOrganizationId ?? "org-missing",
        role: requireAnySessionRole,
        activeHotelId: hotelId,
      },
      membership: requireAnySessionMemberships[0] ?? {
        id: "fallback-membership",
        organizationId: identity.clerkOrganizationId ?? "org-missing",
        hotelId,
        clerkUserId: identity.userId,
        displayName: identity.displayName,
        email: identity.email,
        role: requireAnySessionRole,
        active: true,
      },
    };
  },
}));

mock.module("@/lib/hotel-service", () => ({
  loadPortfolio: async (session: HostedSession) => {
    loadPortfolioCalled = true;
    loadPortfolioCalls.push(session);
    return loadPortfolioResult;
  },
}));

mock.module("@/components/app-topbar", () => ({
  AppTopbar: () => <div>APP_TOPBAR</div>,
}));

mock.module("@/components/portfolio-dashboard", () => ({
  PortfolioDashboard: () => <div>PORTFOLIO_DASHBOARD</div>,
}));

const signInPageModule = await import("@/app/sign-in/[[...sign-in]]/page");
const portfolioPageModule = await import("@/app/portfolio/page");

const SignInPage = signInPageModule.default;
const PortfolioPage = portfolioPageModule.default;

function ownerMembership(overrides: Partial<HotelMembership> = {}): HotelMembership {
  return {
    id: "membership-owner",
    organizationId: "org-1",
    hotelId: "hotel-1",
    clerkUserId: "user-1",
    displayName: "Packet Owner",
    email: "owner@example.com",
    role: "owner",
    active: true,
    ...overrides,
  };
}

async function runPage<T>(page: () => Promise<T>) {
  redirectCalls = [];
  try {
    const rendered = await page();
    return { rendered, error: null as unknown };
  } catch (error) {
    return { rendered: null as unknown as T, error };
  }
}

describe("packet 10 page routing", () => {
  beforeEach(() => {
    demoMode = false;
    clerkConfigured = true;
    databaseConfigured = true;
    identity = null;
    memberships = [];
    requireAnySessionMemberships = [];
    listMembershipCalls = [];
    requireAnyHotelSessionCalls = 0;
    requireAnySessionRole = "owner";
    requireAnySessionHotelId = "hotel-main";
    loadPortfolioCalls = [];
    loadPortfolioCalled = false;
    signInProps = null;
  });

  test("real Clerk signed-out sign-in renders SignIn with portfolio redirects and sign-up disabled", async () => {
    identity = null;

    const { rendered, error } = await runPage(SignInPage);
    expect(error).toBe(null);
    expect(redirectCalls.length).toBe(0);
    expect(rendered).toBeDefined();
    const html = renderToStaticMarkup(rendered);
    expect(html.includes("auth-container")).toBe(true);
    expect(html.includes("auth-panel")).toBe(true);
    expect(html.includes("Mock SignIn")).toBe(true);
    expect(signInProps?.routing).toBe("path");
    expect(signInProps?.path).toBe("/sign-in");
    expect(signInProps?.forceRedirectUrl).toBe("/portfolio");
    expect(signInProps?.fallbackRedirectUrl).toBe("/portfolio");
    expect(signInProps?.withSignUp).toBe(false);
    expect(signInProps?.signUpUrl).toBe("");
  });

  test("real Clerk signed-in sign-in redirects to /portfolio", async () => {
    identity = {
      userId: "user-1",
      clerkOrganizationId: "org-1",
      displayName: "Signed-in User",
      email: "signed-in@example.com",
    };

    const { error } = await runPage(SignInPage);
    expect(error === null).toBe(false);
    expect(redirectCalls).toEqual(["/portfolio"]);
    expect(signInProps).toBe(null);
  });

  test("portfolio signed-out redirects to sign-in", async () => {
    const { error } = await runPage(PortfolioPage);
    expect(error === null).toBe(false);
    expect(redirectCalls).toEqual(["/sign-in"]);
  });

  test("portfolio signed-in with no memberships shows no-access panel and skips loadPortfolio", async () => {
    identity = {
      userId: "user-no-hotel",
      clerkOrganizationId: "org-1",
      displayName: "No Hotel User",
      email: "no-hotel@example.com",
    };
    memberships = [];

    const { rendered, error } = await runPage(PortfolioPage);
    expect(error).toBe(null);
    expect(redirectCalls.length).toBe(0);
    expect(requireAnyHotelSessionCalls).toBe(0);
    expect(loadPortfolioCalled).toBe(false);
    expect(loadPortfolioCalls.length).toBe(0);
    const html = renderToStaticMarkup(rendered);
    expect(html.includes("You are signed in, but no hotel access has been provisioned yet.")).toBe(true);
  });

  test("portfolio signed-in non-owner redirects to active hotel", async () => {
    identity = {
      userId: "user-staff",
      clerkOrganizationId: "org-1",
      displayName: "Staff User",
      email: "staff@example.com",
    };
    memberships = [ownerMembership({ role: "front-desk", hotelId: "hotel-staff", id: "membership-staff" })];
    requireAnySessionRole = "front-desk";
    requireAnySessionHotelId = "hotel-staff";

    const { error } = await runPage(PortfolioPage);
    expect(error === null).toBe(false);
    expect(requireAnyHotelSessionCalls).toBe(1);
    expect(loadPortfolioCalled).toBe(false);
    expect(redirectCalls).toEqual(["/hotels/hotel-staff"]);
  });

  test("portfolio signed-in owner loads portfolio normally", async () => {
    identity = {
      userId: "user-owner",
      clerkOrganizationId: "org-1",
      displayName: "Owner User",
      email: "owner@example.com",
    };
    memberships = [ownerMembership()];
    requireAnySessionRole = "owner";
    requireAnySessionHotelId = "hotel-owner";
    requireAnySessionMemberships = [ownerMembership({ hotelId: "hotel-owner" })];

    const { rendered, error } = await runPage(PortfolioPage);
    expect(error).toBe(null);
    expect(redirectCalls.length).toBe(0);
    expect(requireAnyHotelSessionCalls).toBe(1);
    expect(loadPortfolioCalled).toBe(true);
    expect(loadPortfolioCalls.length).toBe(1);
    expect(loadPortfolioCalls[0]).toEqual({
      userId: "user-owner",
      displayName: "Owner User",
      organizationId: "org-1",
      role: "owner",
      activeHotelId: "hotel-owner",
    });
    const html = renderToStaticMarkup(rendered);
    expect(html.includes("PORTFOLIO_DASHBOARD")).toBe(true);
  });
});
