"use client";

import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { Save, UserCog, XCircle } from "lucide-react";
import { appRoles, roleLabels } from "@/lib/roles";
import type { AppRole, HostedSession, StaffMember } from "@/lib/types";

export type RolePreviewAccountContext = {
  hotelId: string;
  hotelName: string;
  session: HostedSession;
  housekeepers: StaffMember[];
};

export function AccountUserButton({ rolePreview }: { rolePreview?: RolePreviewAccountContext }) {
  if (!rolePreview?.session.rolePreviewEnabled) return <UserButton />;

  return (
    <UserButton userProfileMode="modal">
      <UserButton.UserProfilePage label="Role preview" url="role-preview" labelIcon={<UserCog size={16} />}>
        <AccountRolePreview rolePreview={rolePreview} />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}

function AccountRolePreview({ rolePreview }: { rolePreview: RolePreviewAccountContext }) {
  const router = useRouter();
  const { hotelId, hotelName, session, housekeepers } = rolePreview;
  const [selectedRole, setSelectedRole] = useState<AppRole>(session.previewRole ?? session.role);
  const [selectedStaffId, setSelectedStaffId] = useState(session.previewStaffId ?? housekeepers[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const needsHousekeeper = selectedRole === "housekeeping";
  const disableApply = pending || (needsHousekeeper && !selectedStaffId);

  async function request(path: string, init?: RequestInit) {
    setMessage("");
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Request failed.");
    }
  }

  function refreshWith(action: () => Promise<void>, success: string) {
    startTransition(() => {
      void action()
        .then(() => {
          setMessage(success);
          router.refresh();
        })
        .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    });
  }

  function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    refreshWith(
      () => {
        if (selectedRole === "owner") {
          return request(`/api/hotels/${hotelId}/role-preview`, { method: "DELETE" });
        }
        return request(`/api/hotels/${hotelId}/role-preview`, {
          method: "POST",
          body: JSON.stringify({ role: selectedRole, staffId: needsHousekeeper ? selectedStaffId : null }),
        });
      },
      selectedRole === "owner" ? "Role preview cleared." : `Previewing ${roleLabels[selectedRole]}.`,
    );
  }

  function clearPreview() {
    refreshWith(() => request(`/api/hotels/${hotelId}/role-preview`, { method: "DELETE" }), "Role preview cleared.");
  }

  return (
    <section className="account-role-preview" aria-label="Role preview">
      <div>
        <p className="eyebrow">{hotelName}</p>
        <h2>Profile role</h2>
      </div>
      {message ? <p className={message.includes("failed") || message.includes("cannot") ? "account-role-message error-message" : "account-role-message"}>{message}</p> : null}
      <form className="account-role-form" onSubmit={submitPreview}>
        <label>
          Role
          <select name="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as AppRole)}>
            {appRoles.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleLabels[roleOption]}
              </option>
            ))}
          </select>
        </label>
        {needsHousekeeper ? (
          <label>
            Housekeeper
            <select name="staffId" value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} required>
              {housekeepers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="account-role-actions">
          <button className="primary-button" type="submit" disabled={disableApply}>
            <Save size={16} />
            Apply
          </button>
          {session.previewRole ? (
            <button className="secondary-button" type="button" disabled={pending} onClick={clearPreview}>
              <XCircle size={16} />
              Exit preview
            </button>
          ) : null}
        </div>
      </form>
      <div className="account-role-state">
        <span>Real role: {roleLabels[session.actualRole ?? "owner"]}</span>
        <span>Viewing as: {roleLabels[session.role]}</span>
        {session.previewStaffId ? <span>Staff: {housekeepers.find((member) => member.id === session.previewStaffId)?.fullName ?? session.previewStaffId}</span> : null}
      </div>
    </section>
  );
}
