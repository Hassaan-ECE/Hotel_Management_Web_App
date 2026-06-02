import { describe, expect, mock, test } from "bun:test";
import type { PropsWithChildren, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RolePreviewAccountContext } from "@/components/account-user-button";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
  }),
}));

function MockUserButton({ children }: PropsWithChildren) {
  return <div className="mock-user-button">{children ?? "USER_BUTTON"}</div>;
}

function MockUserProfilePage({ label, children }: PropsWithChildren<{ label: string; labelIcon?: ReactNode; url?: string }>) {
  return <section data-user-profile-page={label}>{children}</section>;
}

MockUserButton.UserProfilePage = MockUserProfilePage;

mock.module("@clerk/nextjs", () => ({
  UserButton: MockUserButton,
}));

const { AccountUserButton } = await import("@/components/account-user-button");

const rolePreview: RolePreviewAccountContext = {
  hotelId: "hotel-1",
  hotelName: "Packet Hotel",
  session: {
    userId: "owner-1",
    displayName: "Owner",
    organizationId: "org-1",
    role: "owner",
    actualRole: "owner",
    activeHotelId: "hotel-1",
    rolePreviewEnabled: true,
  },
  housekeepers: [{ id: "staff-hk", fullName: "Ava Patel", role: "housekeeping", active: true }],
};

describe("packet 16 account role preview", () => {
  test("renders role dropdown inside UserButton profile page", () => {
    const html = renderToStaticMarkup(<AccountUserButton rolePreview={rolePreview} />);

    expect(html.includes('data-user-profile-page="Role preview"')).toBe(true);
    expect(html.includes("Profile role")).toBe(true);
    expect(html.includes("Packet Hotel")).toBe(true);
    expect(html.includes("Front desk")).toBe(true);
    expect(html.includes("Housekeeper")).toBe(true);
    expect(html.includes("Ava Patel")).toBe(false);
    expect(html.includes("Real role: Admin")).toBe(true);
  });

  test("does not add custom profile content when role preview is disabled", () => {
    const html = renderToStaticMarkup(<AccountUserButton />);

    expect(html.includes("Profile role")).toBe(false);
    expect(html.includes("USER_BUTTON")).toBe(true);
  });

  test("shows selected housekeeper and exit action when previewing housekeeping", () => {
    const html = renderToStaticMarkup(
      <AccountUserButton
        rolePreview={{
          ...rolePreview,
          session: {
            ...rolePreview.session,
            role: "housekeeping",
            previewRole: "housekeeping",
            previewStaffId: "staff-hk",
          },
        }}
      />,
    );

    expect(html.includes("Ava Patel")).toBe(true);
    expect(html.includes("Exit preview")).toBe(true);
    expect(html.includes("Viewing as: Housekeeper")).toBe(true);
  });
});
