import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Form, FormField } from "@/components/ui/form";
import { AddTaskTeamMemberSelector } from "./AddTaskTeamMemberSelector";

describe("AddTaskTeamMemberSelector", () => {
  it("searches and switches between campaigners and salespeople with exclusive submitted values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SelectorHarness onSubmit={onSubmit} />);
    for (const [name, campaignerId, salesId] of [
      ["קמפיינר שני", "campaigner-2", ""],
      ["מוכר ראשון", "", "sales-1"],
      ["מוכר שני", "", "sales-2"],
      ["קמפיינר ראשון", "campaigner-1", ""],
    ]) {
      await user.click(screen.getByLabelText("איש צוות אחראי"));
      const search = await screen.findByPlaceholderText("חפש איש צוות...");
      await user.type(search, name);
      expect(await screen.findByRole("option", { name })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getAllByRole("option")).toHaveLength(1),
      );
      await user.click(screen.getByRole("option", { name }));
      expect(screen.getByLabelText("איש צוות אחראי")).toHaveTextContent(name);
      await waitFor(() =>
        expect(
          screen.queryByPlaceholderText("חפש איש צוות..."),
        ).not.toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "בדוק שיוך" }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenLastCalledWith({
          campaigner_id: campaignerId,
          sales_person_id: salesId,
        }),
      );
    }
  });

  it("preserves open state and search on parent rerenders and resets them after unmount", async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(<SelectorHarness category="client" />);
    await user.click(screen.getByLabelText("איש צוות אחראי"));
    await user.type(
      await screen.findByPlaceholderText("חפש איש צוות..."),
      "מוכר",
    );
    rerender(<SelectorHarness category="lead" />);
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByPlaceholderText("חפש איש צוות...")).toHaveValue("מוכר");
    expect(screen.getByText("lead")).toBeInTheDocument();
    unmount();
    render(<SelectorHarness category="client" />);
    expect(screen.getByLabelText("איש צוות אחראי")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByPlaceholderText("חפש איש צוות..."),
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("איש צוות אחראי"));
    expect(await screen.findByPlaceholderText("חפש איש צוות...")).toHaveValue(
      "",
    );
  });
});

function SelectorHarness({
  category = "client",
  onSubmit,
}: {
  category?: string;
  onSubmit?: (values: {
    campaigner_id: string;
    sales_person_id: string;
  }) => void;
}) {
  const form = useForm({
    defaultValues: { campaigner_id: "", sales_person_id: "" },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onSubmit?.(values))}>
        <p>{category}</p>
        <FormField
          control={form.control}
          name="campaigner_id"
          render={({ field }) => (
            <AddTaskTeamMemberSelector
              field={field}
              form={form}
              visibleCampaigners={[
                { id: "campaigner-1", full_name: "קמפיינר ראשון" },
                { id: "campaigner-2", full_name: "קמפיינר שני" },
              ]}
              salesPeople={[
                { id: "sales-1", full_name: "מוכר ראשון" },
                { id: "sales-2", full_name: "מוכר שני" },
              ]}
              disabled={false}
              campaignerLabel="קמפיינרים"
              salesPersonLabel="מכירות"
            />
          )}
        />
        <button type="submit">בדוק שיוך</button>
      </form>
    </Form>
  );
}

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value() {},
    });
  }
});
