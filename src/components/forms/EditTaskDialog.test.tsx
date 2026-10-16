import type { QueryClient } from "@tanstack/react-query";
import { withTestQuery } from "@/test/withTestQuery";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import EditTaskDialog from "./EditTaskDialog";

describe("EditTaskDialog team-member selector", () => {
  it("searches real options, selects a salesperson by keyboard, closes, and submits only that assignment", async () => {
    const { user } = mount();
    expect(selector()).toHaveTextContent("Alpha Campaigner");
    expect(selector()).toHaveAttribute("aria-expanded", "false");
    const search = await openSelector(user);
    expect(screen.getByText("Campaigners")).toBeInTheDocument();
    expect(screen.getByText("Salespeople")).toBeInTheDocument();
    await user.type(search, "Delta");
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Alpha Campaigner" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("option", { name: "Delta Salesperson" }),
    ).toBeVisible();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("חפש איש צוות..."),
      ).not.toBeInTheDocument(),
    );
    expect(selector()).toHaveTextContent("Delta Salesperson");
    expect(selector()).toHaveAttribute("aria-expanded", "false");
    await submit(user);
    expect(backend.update).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({ campaigner_id: null, sales_person_id: "s2" }),
    );
    expect(backend.eq).toHaveBeenCalledWith("tasks", "id", "task-1");
  });

  it("switches an existing salesperson to a campaigner and clears the salesperson in the submitted payload", async () => {
    const { user } = mount({
      ...initialTask,
      campaigner_id: "",
      sales_person_id: "s1",
    });
    expect(selector()).toHaveTextContent("Gamma Salesperson");
    await openSelector(user);
    await user.click(screen.getByRole("option", { name: "Beta Campaigner" }));
    await waitFor(() =>
      expect(selector()).toHaveTextContent("Beta Campaigner"),
    );
    expect(selector()).toHaveAttribute("aria-expanded", "false");
    await submit(user);
    expect(backend.update).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({ campaigner_id: "c2", sales_person_id: null }),
    );
  });

  it("preserves open/search state through form and parent rerenders and responds to Escape", async () => {
    const { user, rerender } = mount();
    await user.clear(screen.getByLabelText("כותרת משימה"));
    await user.type(screen.getByLabelText("כותרת משימה"), "Changed title");
    const search = await openSelector(user);
    await user.type(search, "Beta");
    rerender({ ...initialTask });
    expect(selector()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toHaveValue("Beta");
    expect(screen.getByLabelText("כותרת משימה")).toHaveValue("Changed title");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(selector()).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("preserves the existing mounted form and selector lifetime when the edited task prop changes", async () => {
    const { user, rerender } = mount();
    const search = await openSelector(user);
    await user.type(search, "Alpha");
    rerender({ ...initialTask, id: "task-2", campaigner_id: "c2" });
    expect(selector()).toHaveAttribute("aria-expanded", "true");
    expect(selector()).toHaveTextContent("Alpha Campaigner");
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toHaveValue("Alpha");
  });

  it("resets selector open/search state on actual details-tab unmount while preserving the form assignment", async () => {
    const { user } = mount({
      ...initialTask,
      campaigner_id: "",
      sales_person_id: "s1",
    });
    const search = await openSelector(user);
    await user.type(search, "Delta");
    await user.click(screen.getByRole("tab", { name: "עדכונים" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("איש צוות אחראי")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("tab", { name: "פרטי משימה" }));
    expect(selector()).toHaveTextContent("Gamma Salesperson");
    expect(selector()).toHaveAttribute("aria-expanded", "false");
    expect(await openSelector(user)).toHaveValue("");
  });

  it("resets selector open/search state when the real dialog closes and reopens without resetting form values", async () => {
    const { user, rerender } = mount();
    const search = await openSelector(user);
    await user.type(search, "Beta");
    rerender(initialTask, false);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "עריכת משימה" }),
      ).not.toBeInTheDocument(),
    );
    rerender(initialTask, true);
    await waitFor(() =>
      expect(selector()).toHaveAttribute("aria-expanded", "false"),
    );
    expect(selector()).toHaveTextContent("Alpha Campaigner");
    expect(await openSelector(user)).toHaveValue("");
  });
});

const backend = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }));

interface QueryStub {
  data: never[];
  error: null;
  select: () => QueryStub;
  eq: (key: string, value: unknown) => QueryStub;
  order: () => Promise<{ data: never[]; error: null }>;
  update: (value: Record<string, unknown>) => QueryStub;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query: QueryStub = {
        data: [],
        error: null,
        select: () => query,
        eq: (key, value) => {
          backend.eq(table, key, value);
          return query;
        },
        order: async () => ({ data: [], error: null }),
        update: (value) => {
          backend.update(table, value);
          return query;
        },
      };
      return query;
    },
  },
}));
vi.mock("@/lib/notifyTaskPeers", () => ({ notifyTaskUpdateAdded: vi.fn() }));
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ userId: "user-fixture" }),
}));
vi.mock("@/hooks/useCrossTenantAgencyIds", () => ({
  useCrossTenantAgencyIds: () => ({
    crossTenantAgencyIds: [],
    tenantId: "tenant-fixture",
  }),
}));
vi.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({
    t: (term: string) =>
      term === "campaigner" ? "Campaigners" : "Salespeople",
  }),
}));
vi.mock("@/hooks/useEntityLists", () => ({
  useCampaigners: () => ({
    data: [
      { id: "c1", full_name: "Alpha Campaigner" },
      { id: "c2", full_name: "Beta Campaigner" },
    ],
  }),
  useSalesPeople: () => ({
    data: [
      { id: "s1", full_name: "Gamma Salesperson" },
      { id: "s2", full_name: "Delta Salesperson" },
    ],
  }),
}));

// cmdk scrolls the highlighted option; layout scrolling is absent in a DOM runner.
const scrollDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);
beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  }
});
afterAll(() => {
  if (scrollDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      scrollDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

const initialTask = {
  id: "task-1",
  title: "Existing task",
  campaigner_id: "c1",
  sales_person_id: "",
  agency_id: "agency-fixture",
  status: "open",
  priority: 5,
};

function mount(task = initialTask) {
  const user = userEvent.setup();
  const { queryClient, wrapper } = withTestQuery();
  clients.push(queryClient);
  const onOpenChange = vi.fn();
  const view = (nextTask = task, open = true) => (
    <EditTaskDialog task={nextTask} open={open} onOpenChange={onOpenChange} />
  );
  const result = render(view(), { wrapper });
  return {
    user,
    onOpenChange,
    rerender: (nextTask = task, open = true) =>
      result.rerender(view(nextTask, open)),
  };
}

function selector() {
  return screen.getByLabelText("איש צוות אחראי");
}

async function openSelector(user: ReturnType<typeof userEvent.setup>) {
  await user.click(selector());
  return screen.findByPlaceholderText("חפש איש צוות...");
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "עדכן משימה" }));
  await waitFor(() => expect(backend.update).toHaveBeenCalledOnce());
}
