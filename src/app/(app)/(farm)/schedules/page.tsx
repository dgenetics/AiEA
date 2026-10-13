import { SchedulesView } from "@/components/farm/schedules-view";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { loadSchedulesPage } from "@/lib/schedules-page";

export default async function SchedulesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;
  const initial = await loadSchedulesPage(workspaceId);

  return (
    <div className="mx-auto max-w-5xl">
      <SchedulesView initial={initial} />
    </div>
  );
}
