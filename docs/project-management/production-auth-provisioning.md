# Production Auth And Membership Provisioning

Last updated: 2026-06-01

Use this runbook for staging and production pilot access until the app has an admin UI or dedicated provisioning command. Clerk handles identity. The app database controls hotel access and roles.

## Current Auth Model

- Clerk authenticates the user and provides `userId`.
- `hotel_memberships` is the source of truth for app access.
- A user can access a hotel only when `hotel_memberships.clerk_user_id` matches their Clerk user id, `hotel_id` matches the requested hotel, and `active = true`.
- Clerk organization membership alone does not grant app access.
- Non-owner staff should also have a `staff` row when they need to appear in operational queues, especially housekeeping assignment and housekeeper work.

Allowed app roles:

- `owner`
- `manager`
- `front-desk`
- `housekeeping-supervisor`
- `housekeeping`
- `maintenance`

## Pilot Provisioning Method

For the pilot, use manual operator provisioning:

1. Invite or create the user in the correct Clerk environment.
2. Record the Clerk user id (`user_...`) and email.
3. Add or reactivate app database membership rows in Neon.
4. Add or update a `staff` row for every non-owner operational user.
5. Smoke the login and role landing page.

Do not use demo mode for staging or production provisioning. `HOTEL_APP_DEMO_MODE` must be `"false"` and the target must use dedicated Clerk and Neon resources.

## Clerk Invite Steps

1. Open the Clerk Dashboard for the staging or production Clerk app.
2. Confirm sign-up policy is invite-only or otherwise intentionally restricted for the pilot. Clerk application invitations do not, by themselves, prevent unrelated sign-ups.
3. Create an application invitation for the user's email address.
4. If the user should belong to a Clerk Organization, create or reuse the organization and send an organization invitation as well.
5. After the user accepts or is created, copy the Clerk user id.
6. If an invitation was sent to the wrong email, revoke it in Clerk before creating the replacement invite.

Official Clerk references:

- Application invitations: https://clerk.com/docs/guides/users/inviting
- Organization invitations: https://clerk.com/docs/guides/organizations/add-members/invitations
- Organization member management UI: https://clerk.com/docs/nextjs/reference/components/organization/organization-profile

## Database Membership Provisioning

Run SQL against the correct staging or production Neon database only. Use a transaction for each user/hotel change.

Before making changes, identify the target organization and hotels:

```sql
SELECT id, clerk_organization_id, name FROM organizations ORDER BY name;
SELECT id, organization_id, name, active FROM hotels ORDER BY name;
```

Create or reactivate one membership per user per hotel:

```sql
BEGIN;

WITH input AS (
  SELECT
    '<organization_id>'::text AS organization_id,
    '<hotel_id>'::text AS hotel_id,
    '<clerk_user_id>'::text AS clerk_user_id,
    '<display_name>'::text AS display_name,
    '<email>'::text AS email,
    '<role>'::text AS role
),
validated AS (
  SELECT input.*
  FROM input
  JOIN hotels h
    ON h.id = input.hotel_id
   AND h.organization_id = input.organization_id
   AND h.active = true
  WHERE input.role IN ('owner', 'manager', 'front-desk', 'housekeeping-supervisor', 'housekeeping', 'maintenance')
)
INSERT INTO hotel_memberships (
  id,
  organization_id,
  hotel_id,
  clerk_user_id,
  display_name,
  email,
  role,
  active,
  created_at,
  updated_at
)
SELECT
  'member_' || hotel_id || '_' || clerk_user_id,
  organization_id,
  hotel_id,
  clerk_user_id,
  display_name,
  email,
  role,
  true,
  now(),
  now()
FROM validated
ON CONFLICT (clerk_user_id, hotel_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  active = true,
  updated_at = now()
RETURNING hotel_id, clerk_user_id, display_name, email, role, active;

COMMIT;
```

If the insert returns zero rows, stop and verify the organization id, hotel id, hotel active status, and role value.

For owners with portfolio access, repeat the membership insert for each hotel they should own. For staff, add only the hotels they actually work in.

## Staff Row Provisioning

Skip this section for `owner`. For every non-owner role, create or update the matching `staff` row so the user can participate in operational workflows.

This row is mandatory for housekeepers who need assigned room work, because housekeeper task filtering can match `staff.clerk_user_id`.

First check whether an active staff row already exists for the person or role placeholder:

```sql
SELECT id, hotel_id, full_name, role, active, clerk_user_id
FROM staff
WHERE hotel_id = '<hotel_id>'
  AND (
    clerk_user_id = '<clerk_user_id>'
    OR lower(full_name) = lower('<display_name>')
  )
ORDER BY active DESC, full_name;
```

If an existing row should represent this user, link it instead of creating a duplicate:

```sql
UPDATE staff
SET
  full_name = '<display_name>',
  role = '<staff_role>',
  active = true,
  clerk_user_id = '<clerk_user_id>',
  updated_at = now()
WHERE id = '<existing_staff_id>'
  AND hotel_id = '<hotel_id>'
  AND '<staff_role>' IN ('manager', 'front-desk', 'housekeeping-supervisor', 'housekeeping', 'maintenance')
RETURNING id, hotel_id, full_name, role, active, clerk_user_id;
```

If no existing row should be reused, create a new stable row:

```sql
BEGIN;

WITH input AS (
  SELECT
    '<hotel_id>'::text AS hotel_id,
    '<clerk_user_id>'::text AS clerk_user_id,
    '<display_name>'::text AS full_name,
    '<staff_role>'::text AS role
),
validated AS (
  SELECT input.*
  FROM input
  JOIN hotels h ON h.id = input.hotel_id AND h.active = true
  WHERE input.role IN ('manager', 'front-desk', 'housekeeping-supervisor', 'housekeeping', 'maintenance')
)
INSERT INTO staff (
  id,
  hotel_id,
  full_name,
  role,
  active,
  clerk_user_id,
  created_at,
  updated_at
)
SELECT
  'staff_' || hotel_id || '_' || clerk_user_id,
  hotel_id,
  full_name,
  role,
  true,
  clerk_user_id,
  now(),
  now()
FROM validated
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = true,
  clerk_user_id = EXCLUDED.clerk_user_id,
  updated_at = now()
RETURNING id, hotel_id, full_name, role, active, clerk_user_id;

COMMIT;
```

If a user changes from staff to owner-only access, deactivate their old `staff` row so they no longer appear in operational assignment lists.

If seeded placeholder staff rows are not real pilot users, deactivate or rename/link them before pilot smoke checks so assignment lists do not show duplicate or fake staff.

## Role Changes

Use the membership provisioning SQL with the new role. Then update the `staff` row:

- New role is `owner`: deactivate any matching `staff` rows for that user/hotel.
- New role is non-owner: run the staff row provisioning SQL with the matching staff role.
- Moving a user to another hotel: create the new hotel membership and staff row first, then deactivate the old hotel membership/staff row if access should end there.

Verify:

```sql
SELECT hotel_id, clerk_user_id, display_name, email, role, active
FROM hotel_memberships
WHERE clerk_user_id = '<clerk_user_id>'
ORDER BY hotel_id;

SELECT id, hotel_id, full_name, role, active, clerk_user_id
FROM staff
WHERE clerk_user_id = '<clerk_user_id>'
ORDER BY hotel_id, role;
```

## Staff Deactivation

Deactivate app access before or at the same time as Clerk removal:

```sql
BEGIN;

UPDATE hotel_memberships
SET active = false, updated_at = now()
WHERE hotel_id = '<hotel_id>'
  AND clerk_user_id = '<clerk_user_id>'
RETURNING hotel_id, clerk_user_id, role, active;

UPDATE staff
SET active = false, updated_at = now()
WHERE hotel_id = '<hotel_id>'
  AND clerk_user_id = '<clerk_user_id>'
RETURNING id, hotel_id, full_name, role, active;

COMMIT;
```

Then handle Clerk as appropriate:

- Revoke pending invitations sent to the wrong user.
- Remove the user from the Clerk Organization if organization membership is used.
- Disable or delete the Clerk user only when they should lose access to the entire application, not just one hotel.

## Smoke Checks

After provisioning or role changes:

- User can sign in with Clerk in the target environment.
- Owner sees `/portfolio` with every expected hotel and no unexpected hotels.
- Staff user lands on the correct default workspace for their role.
- Wrong-hotel URL access returns a 403-style app denial.
- Housekeeper appears in assignment lists when expected and can see assigned room work after assignment.
- Deactivated user has no active hotel memberships and cannot access hotel workspaces.

Record the Clerk environment, Neon environment, non-secret user id prefix, hotel ids, role, and smoke result in `docs/project-management/validation-log.md`.

## Known Limitations

- There is no in-app admin UI for provisioning yet.
- There is no dedicated provisioning script yet.
- Clerk organization roles are not mapped into app roles; app roles live in `hotel_memberships`.
- Manual SQL changes must be peer-reviewed before production use.
