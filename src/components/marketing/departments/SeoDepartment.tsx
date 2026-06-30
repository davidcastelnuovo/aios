import { Search } from "lucide-react";
import type { DepartmentProps } from "./types";

export function SeoDepartment({ clientId, tenantId }: DepartmentProps) {
  return (
    <div className="flex flex-1 h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Search className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">מחלקת SEO / GEO</p>
        <p className="mt-1 text-xs">בקרוב</p>
      </div>
    </div>
  );
}
