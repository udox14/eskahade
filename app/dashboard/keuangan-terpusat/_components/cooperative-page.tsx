import { CooperativeActivity } from "./cooperative-activity";
import { requireFinanceAccess } from "@/lib/finance/access";
import { loadScreen, type ScreenView } from "@/lib/finance/cooperative/screen";
import { CooperativeScreen } from "./cooperative-ui";
import { FinanceWorkspaceNavigation } from "./workspace-navigation";
export async function CooperativePage({
  view,
  searchParams,
}: {
  view: ScreenView;
  searchParams: Promise<{
    q?: string; tool?: string;
    p?: string;
    sort?: string;
    dir?: string; from?: string; to?: string;
  }>;
}) {
  const session = await requireFinanceAccess(
    view === "settings" ? "CONFIGURE" : view === "cashier" ? "CREATE" : "VIEW",
  );
  const data = await loadScreen(view, session, await searchParams);
  return (
    <>
      <FinanceWorkspaceNavigation />
      <CooperativeScreen data={data} />
      {data.tool === "overview" ? <CooperativeActivity view={view} /> : null}
    </>
  );
}
