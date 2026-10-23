import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  roleSkin,
  WORKSHOP_ROLES,
  type WorkshopRoleId,
  type WorkshopSkin,
} from "./workshopRoles";

export function WorkshopSkinBar({
  skins,
  activeRole,
  onChoose,
}: {
  skins: WorkshopSkin[];
  activeRole: WorkshopRoleId;
  onChoose: (slug: string) => void;
}) {
  return (
    <nav
      className="flex flex-1 items-end justify-center gap-4 overflow-x-auto"
      aria-label="סקינים"
    >
      {WORKSHOP_ROLES.map((role) => {
        const skin = roleSkin(role, skins);
        const active = activeRole === role.id && !!skin;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => {
              if (!skin) {
                toast.message("הסקין הזה עדיין לא הוגדר בהגדרות של כרמן");
                return;
              }
              onChoose(skin.slug);
            }}
            className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-muted shadow-sm",
                active &&
                  "ring-2 ring-pink-500 ring-offset-2 ring-offset-background",
                !skin && "opacity-40",
              )}
            >
              {skin?.avatarUrl ? (
                <img
                  src={skin.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              )}
            </span>
            <span className="text-center text-[11px] leading-tight">
              {role.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
