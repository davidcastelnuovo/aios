import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Form, FormField } from "@/components/ui/form";
import EditTaskTeamMemberSelector from "./EditTaskTeamMemberSelector";

describe("EditTaskTeamMemberSelector", () => {
  it("filters real options and selects a salesperson with the keyboard, clearing the campaigner", async () => {
    const { user, onSubmit } = mount();
    expect(selector()).toHaveTextContent("Alpha Campaigner");
    await user.click(selector());
    await user.type(
      await screen.findByPlaceholderText("חפש איש צוות..."),
      "Delta",
    );
    expect(
      screen.queryByRole("option", { name: "Alpha Campaigner" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Delta Salesperson" }),
    ).toBeVisible();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(selector()).toHaveAttribute("aria-expanded", "false"),
    );
    expect(selector()).toHaveTextContent("Delta Salesperson");
    await user.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        campaigner_id: "",
        sales_person_id: "s2",
      }),
    );
  });

  it("selects a campaigner and clears the previous salesperson in the real form", async () => {
    const { user, onSubmit } = mount({
      campaigner_id: "",
      sales_person_id: "s1",
    });
    expect(selector()).toHaveTextContent("Gamma Salesperson");
    await user.click(selector());
    await user.click(
      await screen.findByRole("option", { name: "Beta Campaigner" }),
    );
    expect(selector()).toHaveTextContent("Beta Campaigner");
    expect(selector()).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        campaigner_id: "c2",
        sales_person_id: "",
      }),
    );
  });

  it("preserves search through parent rerenders and dismisses with Escape without changing the assignment", async () => {
    const { user, rerender, onSubmit } = mount();
    await user.click(selector());
    await user.type(
      await screen.findByPlaceholderText("חפש איש צוות..."),
      "Missing member",
    );
    expect(await screen.findByText("לא נמצאו אנשי צוות")).toBeVisible();
    rerender();
    expect(selector()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toHaveValue(
      "Missing member",
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(selector()).toHaveAttribute("aria-expanded", "false"),
    );
    await user.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        campaigner_id: "c1",
        sales_person_id: "",
      }),
    );
    await user.click(selector());
    expect(await screen.findByPlaceholderText("חפש איש צוות...")).toHaveValue(
      "",
    );
  });
});

type Assignment = { campaigner_id: string; sales_person_id: string };

function mount(
  defaultValues: Assignment = { campaigner_id: "c1", sales_person_id: "" },
) {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  const view = () => (
    <AssignmentForm defaultValues={defaultValues} onSubmit={onSubmit} />
  );
  const result = render(view());
  return { user, onSubmit, rerender: () => result.rerender(view()) };
}

function AssignmentForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues: Assignment;
  onSubmit: (assignment: Assignment) => void;
}) {
  const form = useForm<Assignment>({ defaultValues });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((assignment) => onSubmit(assignment))}>
        <FormField
          control={form.control}
          name="campaigner_id"
          render={({ field }) => (
            <EditTaskTeamMemberSelector
              field={field}
              form={form}
              campaigners={[
                { id: "c1", full_name: "Alpha Campaigner" },
                { id: "c2", full_name: "Beta Campaigner" },
              ]}
              salesPeople={[
                { id: "s1", full_name: "Gamma Salesperson" },
                { id: "s2", full_name: "Delta Salesperson" },
              ]}
              t={(term) =>
                term === "campaigner" ? "Campaigners" : "Salespeople"
              }
            />
          )}
        />
        <button type="submit">Save assignment</button>
      </form>
    </Form>
  );
}

function selector() {
  return screen.getByRole("combobox", { name: "איש צוות אחראי" });
}

// cmdk scrolls its highlighted option; the DOM runner has no layout scrolling.
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
