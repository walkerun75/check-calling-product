import Link from "next/link";
import { redirect } from "next/navigation";
import { getLaunchContext } from "@/lib/launch";
import { addTeamInvitation, removeTeamInvitation } from "./actions";
import { SelectAllPermissions } from "./select-all-permissions";
import "./business.css";
import "./invite-button.css";

type Invitation = {
  email: string;
  fullName: string;
  status: string;
  permissions?: string[];
};

const permissionGroups = [
  ["Customers", ["Add", "Delete", "Edit", "Manage", "View"]],
  ["Team", ["Invite", "Remove", "Edit permissions", "View"]],
  ["Vehicles", ["Add", "Delete", "Edit", "Manage", "View"]],
  ["Rentals", ["Create", "Cancel", "Delete", "Edit", "View financials", "View"]],
  ["Payments", ["Collect", "Refund", "Edit", "View"]],
  ["Settings", ["Edit", "Manage", "View"]],
  ["Integrations", ["Manage", "Send messages", "View"]],
  ["Reports", ["Financial reports", "Operations reports", "View"]],
] as const;

export default async function TeamSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user, membership } = await getLaunchContext();
  if (!["owner", "admin"].includes(membership.role)) redirect("/dashboard/command-center");

  const { data: step } = await supabase
    .from("organization_launch_steps")
    .select("configuration,status")
    .eq("organization_id", membership.organization_id)
    .eq("step_key", "business")
    .single();
  const configuration = (step?.configuration ?? {}) as { invitations?: Invitation[] };
  const invitations = configuration.invitations ?? [];

  return (
    <main className="team-setup-page">
      <header className="team-topbar">
        <Link className="team-brand" href="/launch?edit=1&step=business">Check<i>✓</i>Calling</Link>
        <strong>Invite Team Member</strong>
        <div className="team-search">⌕ Search... <kbd>Ctrl K</kbd></div>
        <div className="team-progress">1/8 setup · <span>{step?.status?.replace("_", " ")}</span></div>
      </header>

      <section className="team-workspace">
        <Link className="back-setup" href="/launch?edit=1&step=business">← Back to setup</Link>
        <h1>Add New Employee</h1>
        {params.invited && <div className="business-success" role="status">Invitation created successfully. The teammate was added to the pending invitation list.</div>}
        {params.error && <div className="business-alert" role="alert">{params.error}</div>}

        <form action={addTeamInvitation} className="employee-form">
          <section className="form-panel account-panel">
            <h2>Account information</h2>
            <p>Invite a team member</p>
            <div className="name-fields">
              <label><span>First name</span><input name="firstName" placeholder="First Name" required /></label>
              <label><span>Last name</span><input name="lastName" placeholder="Last Name" required /></label>
            </div>
            <label><span>Email address</span><input name="email" type="email" placeholder="Email" required /></label>
          </section>

          <section className="form-panel permissions-panel">
            <h2>Permissions</h2>
            <p>Choose the access this team member needs. The account owner keeps full administrative control.</p>
            <label className="select-all"><b>Select All</b><SelectAllPermissions /></label>
            {permissionGroups.map(([group, permissions]) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                {permissions.map((permission) => {
                  const value = `${group.toLowerCase()}:${permission.toLowerCase().replaceAll(" ", "-")}`;
                  return <label key={value}><input type="checkbox" name="permissions" value={value} /> <span>{group} {permission}</span></label>;
                })}
              </fieldset>
            ))}
            <div className="form-submit"><button type="submit">Send invitation</button></div>
          </section>
        </form>

        <section className="pending-panel">
          <h2>Pending invitations ({invitations.length})</h2>
          {invitations.length ? invitations.map((invite) => (
            <div className="pending-row" key={invite.email}>
              <div><b>{invite.fullName}</b><small>{invite.email} · {invite.permissions?.length ?? 0} permissions</small></div>
              <form action={removeTeamInvitation}><input type="hidden" name="email" value={invite.email} /><button>Remove</button></form>
            </div>
          )) : <p>No pending invitations.</p>}
        </section>
        <p className="signed-in-note">Signed in as {user.email}</p>
      </section>
    </main>
  );
}
