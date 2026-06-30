import { Video } from "lucide-react";
import type { DepartmentProps } from "./types";

export function VideoDepartment({ clientId, tenantId }: DepartmentProps) {
  return (
    <div className="flex flex-1 h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Video className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">יצירה ועריכת סרטונים</p>
        <p className="mt-1 text-xs">בקרוב</p>
      </div>
    </div>
  );
}
