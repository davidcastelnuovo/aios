import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AddTaskForm from "./AddTaskForm";

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
  mutate: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "task-form-forced-client"
        ? queryKey[1]
          ? fixtures.client
          : null
        : queryKey[0] === "task-form-clients"
          ? [fixtures.client]
          : fixtures.emptyRows,
  }),
  useQueryClient: () => ({ invalidateQueries: fixtures.invalidateQueries }),
  useMutation: () => ({ mutate: fixtures.mutate, isPending: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("Unexpected backend access in selector test");
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
  // cmdk scrolls its active option; Happy DOM has no layout to scroll.
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value() {},
    });
  }
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

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "משימה חדשה" }));
  await screen.findByRole("dialog", { name: "הוספת משימה חדשה" });
}
function teamSelector() {
  return screen.getByLabelText("איש צוות אחראי");
}
async function openSelector(user: ReturnType<typeof userEvent.setup>) {
  await user.click(teamSelector());
  return screen.findByPlaceholderText("חפש איש צוות...");
}
async function selectMember(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await openSelector(user);
  await user.click(await screen.findByRole("option", { name }));
  await waitFor(() =>
    expect(
      screen.queryByPlaceholderText("חפש איש צוות..."),
    ).not.toBeInTheDocument(),
  );
  expect(teamSelector()).toHaveTextContent(name);
  expect(teamSelector()).toHaveAttribute("aria-expanded", "false");
}

describe("AddTaskForm team-member selector", () => {
  it("keeps the popover open through form and category rerenders", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AddTaskForm />);
    await openDialog(user);
    await openSelector(user);

    fireEvent.change(screen.getByLabelText("כותרת המשימה"), {
      target: { value: "משימה חדשה" },
    });
    rerender(<AddTaskForm agencyId="agency-2" />);
    expect(teamSelector()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toBeInTheDocument();

    rerender(<AddTaskForm leadId="lead-1" />);
    await waitFor(() =>
      expect(screen.getByLabelText("סוג משימה")).toHaveTextContent(
        "משימה לליד",
      ),
    );
    expect(teamSelector()).toHaveAttribute("aria-expanded", "true");
    rerender(<AddTaskForm clientId="client-1" />);
    await waitFor(() =>
      expect(screen.getByLabelText("סוג משימה")).toHaveTextContent(
        "משימה ללקוח",
      ),
    );
    expect(teamSelector()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toBeInTheDocument();
  });

  it("searches real options and submits mutually exclusive assignments when switching member types", async () => {
    const user = userEvent.setup();
    render(<AddTaskForm clientId="client-1" />);
    await openDialog(user);
    await user.type(screen.getByLabelText("כותרת המשימה"), "בדיקת שיוך");

    const search = await openSelector(user);
    await user.type(search, "מוכר שני");
    expect(
      await screen.findByRole("option", { name: "מוכר שני" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "קמפיינר ראשון" }),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("option", { name: "מוכר שני" }));
    await waitFor(() =>
      expect(teamSelector()).toHaveAttribute("aria-expanded", "false"),
    );

    for (const [name, campaignerId, salesId] of [
      ["קמפיינר שני", "campaigner-2", ""],
      ["מוכר ראשון", "", "sales-1"],
      ["מוכר שני", "", "sales-2"],
      ["קמפיינר ראשון", "campaigner-1", ""],
    ]) {
      await selectMember(user, name);
      fixtures.mutate.mockClear();
      await user.click(screen.getByRole("button", { name: "הוסף משימה" }));
      await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledOnce());
      expect(fixtures.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          campaigner_id: campaignerId,
          sales_person_id: salesId,
          client_id: "client-1",
          title: "בדיקת שיוך",
        }),
      );
      await openSelector(user);
      expect(
        screen.getByRole("option", { name }).querySelector("svg"),
      ).toHaveClass("opacity-100");
      await user.keyboard("{Escape}");
      await waitFor(() =>
        expect(teamSelector()).toHaveAttribute("aria-expanded", "false"),
      );
    }
  });

  it("keeps ordinary campaigners assigned to themselves with a disabled selector", async () => {
    Object.assign(fixtures.role, {
      isOwner: false,
      isCampaigner: true,
      campaignerId: "campaigner-1",
    });
    const user = userEvent.setup();
    render(<AddTaskForm />);
    await openDialog(user);
    expect(teamSelector()).toBeDisabled();
    expect(teamSelector()).toHaveTextContent("קמפיינר ראשון");
    await user.click(teamSelector());
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
      render(<AddTaskForm />);
      await openDialog(user);
      expect(teamSelector()).toBeEnabled();
      await openSelector(user);
      expect(
        await screen.findByRole("option", { name: "קמפיינר שני" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("option", { name: "קמפיינר שני" }));
      await waitFor(() =>
        expect(teamSelector()).toHaveTextContent("קמפיינר שני"),
      );
    },
  );

  it("resets popover state after closing and reopening the real dialog while preserving form values", async () => {
    const user = userEvent.setup();
    render(<AddTaskForm />);
    await openDialog(user);
    await selectMember(user, "קמפיינר שני");
    await openSelector(user);
    // Click the real dialog close control without an outside pointerdown first,
    // so its open selector unmounts rather than closing before the dialog does.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "הוספת משימה חדשה" }),
      ).not.toBeInTheDocument(),
    );
    await openDialog(user);
    expect(teamSelector()).toHaveAttribute("aria-expanded", "false");
    expect(teamSelector()).toHaveTextContent("קמפיינר שני");
    expect(
      screen.queryByPlaceholderText("חפש איש צוות..."),
    ).not.toBeInTheDocument();
  });
});
