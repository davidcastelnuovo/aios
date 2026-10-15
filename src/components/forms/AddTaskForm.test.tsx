import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { withTestQuery } from "@/test/withTestQuery";
import AddTaskForm from "./AddTaskForm";

describe("AddTaskForm team-member assignment", () => {
  it.each([
    { name: "קמפיינר שני", campaignerId: "campaigner-2", salesId: null },
    { name: "מוכר שני", campaignerId: null, salesId: "sales-2" },
  ])(
    "submits the exclusive $name assignment through the real mutation",
    async ({ name, campaignerId, salesId }) => {
      const user = userEvent.setup();
      mountForm(<AddTaskForm clientId="client-1" />);
      await openDialog(user);
      await user.type(screen.getByLabelText("כותרת המשימה"), "בדיקת שיוך");
      await selectMember(user, "מוכר ראשון");
      await selectMember(user, "קמפיינר ראשון");
      await selectMember(user, name);
      await user.click(screen.getByRole("button", { name: "הוסף משימה" }));
      await waitFor(() =>
        expect(fixtures.insert).toHaveBeenCalledWith([
          expect.objectContaining({
            campaigner_id: campaignerId,
            sales_person_id: salesId,
            client_id: "client-1",
            title: "בדיקת שיוך",
            tenant_id: "tenant-1",
          }),
        ]),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "הוספת משימה חדשה" }),
        ).not.toBeInTheDocument(),
      );
    },
  );

  it("keeps ordinary campaigners assigned to themselves with a disabled selector", async () => {
    Object.assign(fixtures.role, {
      isOwner: false,
      isCampaigner: true,
      campaignerId: "campaigner-1",
    });
    const user = userEvent.setup();
    mountForm(<AddTaskForm />);
    await openDialog(user);
    expect(screen.getByLabelText("איש צוות אחראי")).toBeDisabled();
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveTextContent(
      "קמפיינר ראשון",
    );
    await user.click(screen.getByLabelText("איש צוות אחראי"));
    expect(
      screen.queryByPlaceholderText("חפש איש צוות..."),
    ).not.toBeInTheDocument();
  });

  it.each(["isOwner", "isTeamManager", "isSuperAdmin"] as const)(
    "allows %s to choose any campaigner",
    async (permission) => {
      Object.assign(fixtures.role, {
        isOwner: false,
        isCampaigner: true,
        campaignerId: "campaigner-1",
        [permission]: true,
      });
      const user = userEvent.setup();
      mountForm(<AddTaskForm />);
      await openDialog(user);
      expect(screen.getByLabelText("איש צוות אחראי")).toBeEnabled();
      await selectMember(user, "קמפיינר שני");
      expect(screen.getByLabelText("איש צוות אחראי")).toHaveTextContent(
        "קמפיינר שני",
      );
    },
  );

  it("closes naturally with its dialog and reopens closed with the assignment preserved", async () => {
    const user = userEvent.setup();
    mountForm(<AddTaskForm />);
    await openDialog(user);
    await selectMember(user, "קמפיינר שני");
    await user.click(screen.getByLabelText("איש צוות אחראי"));
    await screen.findByPlaceholderText("חפש איש צוות...");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "הוספת משימה חדשה" }),
      ).not.toBeInTheDocument(),
    );
    await openDialog(user);
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveTextContent(
      "קמפיינר שני",
    );
  });
});

function mountForm(form: ReactElement) {
  const { queryClient, wrapper } = withTestQuery();
  clients.push(queryClient);
  return render(form, { wrapper });
}
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "משימה חדשה" }));
  await screen.findByRole("dialog", { name: "הוספת משימה חדשה" });
}
async function selectMember(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("איש צוות אחראי"));
  await user.click(await screen.findByRole("option", { name }));
  await waitFor(() =>
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveAttribute(
      "aria-expanded",
      "false",
    ),
  );
  expect(screen.getByLabelText("איש צוות אחראי")).toHaveTextContent(name);
}

type BackendResult = { data: unknown; error: null };
interface BackendQuery {
  select(): BackendQuery;
  eq(): BackendQuery;
  neq(): BackendQuery;
  order(): BackendQuery;
  insert(rows: unknown): BackendQuery;
  maybeSingle(): Promise<BackendResult>;
  single(): Promise<BackendResult>;
  then(resolve: (value: BackendResult) => unknown): Promise<unknown>;
}

const clients: ReturnType<typeof withTestQuery>["queryClient"][] = [];
const fixtures = vi.hoisted(() => ({
  campaigners: [
    { id: "campaigner-1", full_name: "קמפיינר ראשון" },
    { id: "campaigner-2", full_name: "קמפיינר שני" },
  ],
  salesPeople: [
    { id: "sales-1", full_name: "מוכר ראשון" },
    { id: "sales-2", full_name: "מוכר שני" },
  ],
  client: { id: "client-1", name: "לקוח לדוגמה", agency_id: "agency-1" },
  emptyRows: [],
  role: {
    isCampaigner: false,
    isTeamManager: false,
    isOwner: true,
    isSuperAdmin: false,
    campaignerId: "",
  },
  insert: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
    },
    from: (table: string) => {
      const query: BackendQuery = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        order: () => query,
        insert: (rows: unknown) => {
          fixtures.insert(rows);
          return query;
        },
        maybeSingle: async () => ({ data: fixtures.client, error: null }),
        single: async () => ({ data: { id: "created-task" }, error: null }),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({
            data:
              table === "clients"
                ? [fixtures.client]
                : table === "client_team"
                  ? [{ client_id: "client-1" }]
                  : [],
            error: null,
          }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/hooks/useCurrentTenant", () => ({
  useCurrentTenant: () => ({ tenantId: "tenant-1" }),
}));
vi.mock("@/hooks/useCustomFieldLabels", () => ({
  useCustomFieldLabels: () => ({
    getFieldLabel: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => fixtures.role }));
vi.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({ t: (key: string) => key }),
}));
vi.mock("@/contexts/ViewAsContext", () => ({
  useViewAs: () => ({ isViewingAs: false }),
}));
vi.mock("@/hooks/useEntityLists", () => ({
  useAgencies: () => ({ data: fixtures.emptyRows }),
  useSalesPeople: () => ({ data: fixtures.salesPeople }),
}));
vi.mock("@/hooks/useAssignableCampaigners", () => ({
  useAssignableCampaigners: () => ({ data: fixtures.campaigners }),
}));

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value() {},
    });
});
beforeEach(() => {
  Object.assign(fixtures.role, {
    isCampaigner: false,
    isTeamManager: false,
    isOwner: true,
    isSuperAdmin: false,
    campaignerId: "",
  });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
