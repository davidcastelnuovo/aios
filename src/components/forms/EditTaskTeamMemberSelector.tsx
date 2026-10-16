import { useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { useTerminology } from "@/hooks/useTerminology";

export default function EditTaskTeamMemberSelector({
  field,
  form,
  campaigners,
  salesPeople,
  t,
}: {
  field: Pick<
    ControllerRenderProps<{ campaigner_id?: string }, "campaigner_id">,
    "value" | "onChange"
  >;
  form: {
    getValues: (name: "sales_person_id") => string | undefined;
    setValue: (name: "sales_person_id", value: string) => void;
  };
  campaigners: { id: string; full_name: string }[] | undefined;
  salesPeople: { id: string; full_name: string }[] | undefined;
  t: ReturnType<typeof useTerminology>["t"];
}) {
  const [teamMemberPopoverOpen, setTeamMemberPopoverOpen] = useState(false);

  // Combine campaigners and sales people into one list
  const allTeamMembers = [
    ...(campaigners?.map((c) => ({
      id: c.id,
      name: c.full_name,
      type: "campaigner" as const,
    })) || []),
    ...(salesPeople?.map((s) => ({
      id: s.id,
      name: s.full_name,
      type: "sales" as const,
    })) || []),
  ];

  // Find selected member
  const selectedMember = allTeamMembers.find(
    (m) =>
      (m.type === "campaigner" && m.id === field.value) ||
      (m.type === "sales" && m.id === form.getValues("sales_person_id")),
  );

  return (
    <FormItem className="flex flex-col">
      <FormLabel className="text-right block">איש צוות אחראי</FormLabel>
      <Popover
        open={teamMemberPopoverOpen}
        onOpenChange={setTeamMemberPopoverOpen}
      >
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "w-full justify-between",
                !selectedMember && "text-muted-foreground",
              )}
            >
              <span className="text-right flex-1">
                {selectedMember ? selectedMember.name : "בחר איש צוות"}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-0 bg-background"
          align="end"
          dir="rtl"
        >
          <Command>
            <CommandInput placeholder="חפש איש צוות..." />
            <CommandList>
              <CommandEmpty>לא נמצאו אנשי צוות</CommandEmpty>
              {campaigners && campaigners.length > 0 && (
                <CommandGroup heading={t("campaigner", true)}>
                  {campaigners.map((campaigner) => (
                    <CommandItem
                      key={`campaigner:${campaigner.id}`}
                      value={campaigner.full_name}
                      onSelect={() => {
                        field.onChange(campaigner.id);
                        form.setValue("sales_person_id", "");
                        setTeamMemberPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          field.value === campaigner.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {campaigner.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {salesPeople && salesPeople.length > 0 && (
                <CommandGroup heading={t("sales_person", true)}>
                  {salesPeople.map((salesPerson) => (
                    <CommandItem
                      key={`sales:${salesPerson.id}`}
                      value={salesPerson.full_name}
                      onSelect={() => {
                        field.onChange("");
                        form.setValue("sales_person_id", salesPerson.id);
                        setTeamMemberPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          form.getValues("sales_person_id") === salesPerson.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {salesPerson.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}
