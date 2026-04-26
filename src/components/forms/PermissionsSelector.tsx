import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PERMISSION_CATEGORIES } from "@/lib/modules";
import {
  ClipboardList,
  MessageSquare,
  TrendingUp,
  Share2,
  Building2,
  Zap,
  Plug,
  Settings,
  ShieldAlert,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  daily:         <ClipboardList className="h-4 w-4" />,
  communication: <MessageSquare className="h-4 w-4" />,
  sales:         <TrendingUp className="h-4 w-4" />,
  marketing:     <Share2 className="h-4 w-4" />,
  organization:  <Building2 className="h-4 w-4" />,
  automation:    <Zap className="h-4 w-4" />,
  integrations:  <Plug className="h-4 w-4" />,
  settings:      <Settings className="h-4 w-4" />,
  special:       <ShieldAlert className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  daily:         "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  communication: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  sales:         "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  marketing:     "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  organization:  "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  automation:    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  integrations:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  settings:      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  special:       "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export interface PermissionsSelectorProps {
  /** Map of moduleId -> boolean (true = granted) */
  value: Record<string, boolean>;
  /** Called with the next full map whenever a permission changes */
  onChange: (next: Record<string, boolean>) => void;
  /** Optional id-prefix to avoid duplicate DOM ids when rendered multiple times */
  idPrefix?: string;
}

/**
 * Shared categorized permissions selector.
 * Renders all PERMISSION_CATEGORIES with per-category bulk toggle and
 * indeterminate state. Used both in EditUserPermissionsDialog and the
 * invite-new-user dialog so the two flows stay in sync automatically.
 */
export function PermissionsSelector({
  value,
  onChange,
  idPrefix = "perm",
}: PermissionsSelectorProps) {
  const togglePermission = (moduleId: string) => {
    onChange({ ...value, [moduleId]: !value[moduleId] });
  };

  const toggleCategory = (categoryId: string, next: boolean) => {
    const cat = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return;
    const merged = { ...value };
    cat.modules.forEach((m) => { merged[m.id] = next; });
    onChange(merged);
  };

  const isCategoryFullyChecked = (categoryId: string): boolean => {
    const cat = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return false;
    return cat.modules.every((m) => value[m.id] === true);
  };

  const isCategoryPartiallyChecked = (categoryId: string): boolean => {
    const cat = PERMISSION_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) return false;
    const checked = cat.modules.filter((m) => value[m.id] === true).length;
    return checked > 0 && checked < cat.modules.length;
  };

  return (
    <div className="space-y-4">
      {PERMISSION_CATEGORIES.map((category) => {
        const fullyChecked = isCategoryFullyChecked(category.id);
        const partiallyChecked = isCategoryPartiallyChecked(category.id);
        const colorClass = CATEGORY_COLORS[category.id] ?? "bg-gray-100 text-gray-800";
        const icon = CATEGORY_ICONS[category.id];
        const categoryActiveCount = category.modules.filter((m) => value[m.id]).length;

        return (
          <div
            key={category.id}
            className="rounded-lg border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-cat-${category.id}`}
                  checked={fullyChecked}
                  data-state={partiallyChecked ? "indeterminate" : undefined}
                  className={partiallyChecked ? "opacity-70" : ""}
                  onCheckedChange={(checked) => toggleCategory(category.id, !!checked)}
                />
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                >
                  {icon}
                  {category.label}
                </span>
                {category.description && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {category.description}
                  </span>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {categoryActiveCount}/{category.modules.length}
              </Badge>
            </div>

            <div className="divide-y">
              {category.modules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    id={`${idPrefix}-module-${module.id}`}
                    checked={value[module.id] ?? false}
                    onCheckedChange={() => togglePermission(module.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`${idPrefix}-module-${module.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {module.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {module.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
