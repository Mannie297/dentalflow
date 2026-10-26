import type { AppUser, Organization, Permission } from "@/types";
import { DEMO_ORGANIZATION } from "@/lib/mock/constants";
import { DEFAULT_CURRENT_USER_ID, DEMO_USERS } from "@/lib/mock/current-user";
import { ROLE_PERMISSIONS } from "@/types";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapOrganizationRow, mapProfileRow } from "@/lib/supabase/mappers";

export interface Session {
  user: AppUser;
  organization: Organization;
  permissions: Permission[];
}

/** Thrown by `getCurrentSession()` in Live Mode when no Supabase Auth session exists yet. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not signed in to Supabase. Sign in at /login to use Live Mode.");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Returns the active session (current user + organization + resolved
 * permissions).
 *  - Demo Mode: reads from the local demo roster (`userId` lets the topbar's
 *    "view as role" switcher swap between demo users).
 *  - Live Mode: resolves the authenticated Supabase Auth user, then their
 *    `profiles` row (RLS-scoped) and `organizations` row.
 */
export async function getCurrentSession(userId: string = DEFAULT_CURRENT_USER_ID): Promise<Session> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new NotAuthenticatedError();

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();
    if (profileError || !profileRow) {
      throw new Error(
        "Signed in to Supabase, but no profile row links this user to an organization. See /docs/DEPLOYMENT.md for how to link a user to an organization."
      );
    }

    const { data: orgRow, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profileRow.organization_id)
      .single();
    if (orgError || !orgRow) {
      throw new Error("Signed in, but the organization linked to this profile could not be loaded.");
    }

    const user = mapProfileRow(profileRow);
    return {
      user,
      organization: mapOrganizationRow(orgRow),
      permissions: ROLE_PERMISSIONS[user.role],
    };
  }

  const user = DEMO_USERS.find((u) => u.id === userId) ?? DEMO_USERS[0];
  return {
    user,
    organization: DEMO_ORGANIZATION,
    permissions: ROLE_PERMISSIONS[user.role],
  };
}

export async function listOrganizationUsers(): Promise<AppUser[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) throw error;
    return (data ?? []).map(mapProfileRow);
  }
  return DEMO_USERS;
}

export function hasPermission(permissions: Permission[], permission: Permission): boolean {
  return permissions.includes(permission);
}
