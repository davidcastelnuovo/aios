import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Pin, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccessibleMenuModules } from "@/hooks/useAccessibleMenuModules";
import { useHeaderShortcuts } from "@/hooks/useHeaderShortcuts";
import { useTenantPath } from "@/hooks/useTenantPath";
import { cn } from "@/lib/utils";

export function HeaderModuleShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { buildPath } = useTenantPath();
  const { groups, modules, isLoading } = useAccessibleMenuModules();
  const accessibleKeys = modules.map((module) => module.key);
  const { selectedKeys, toggle, maxShortcuts, isAtLimit } =
    useHeaderShortcuts(accessibleKeys);
  const selectedModules = selectedKeys
    .map((key) => modules.find((module) => module.key === key))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));

  return (
    <div className="flex items-center gap-1">
      <div className="hidden xl:flex items-center gap-1">
        {selectedModules.map((module) => {
          const Icon = module.icon;
          const path = buildPath(module.route);
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
          return (
            <Button
              key={module.key}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className="h-9 gap-1.5 px-2"
              onClick={() => navigate(path)}
              title={module.label}
              aria-label={`פתח ${module.label}`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden 2xl:inline max-w-24 truncate">{module.label}</span>
            </Button>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 px-2 sm:px-2.5"
            disabled={isLoading}
            title="קיצורי דרך"
            aria-label="קיצורי דרך"
          >
            <Pin className="h-4 w-4" />
            <span className="text-xs sm:text-sm">קיצורים</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground xl:hidden" />
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground hidden xl:inline" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="z-[100] w-72 max-h-[70vh] overflow-y-auto"
          dir="rtl"
        >
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>קיצורי דרך בהדר</span>
            <span className="text-xs font-normal text-muted-foreground">
              {selectedKeys.length}/{maxShortcuts}
            </span>
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-xs text-muted-foreground">
            בחר עד {maxShortcuts} מודולים. הבחירה נשמרת עבורך בארגון הזה.
          </div>
          <DropdownMenuSeparator />

          {selectedModules.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                מעבר מהיר
              </DropdownMenuLabel>
              {selectedModules.map((module) => {
                const Icon = module.icon;
                return (
                  <DropdownMenuItem
                    key={`open-${module.key}`}
                    className="gap-2 font-medium"
                    onClick={() => navigate(buildPath(module.route))}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="truncate">{module.label}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            בחירת קיצורים
          </DropdownMenuLabel>
          {groups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.modules.map((module) => {
                const checked = selectedKeys.includes(module.key);
                const Icon = module.icon;
                return (
                  <DropdownMenuCheckboxItem
                    key={module.key}
                    checked={checked}
                    disabled={isAtLimit && !checked}
                    onCheckedChange={() => toggle(module.key)}
                    onSelect={(event) => event.preventDefault()}
                    className={cn("gap-2", checked && "font-medium")}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{module.label}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

