import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { boardSteps } from "./workshopBoard";

export function WorkshopBoard({
  title,
  payload,
  toolsHref,
}: {
  title: string;
  payload: Record<string, unknown> | null;
  toolsHref: string | null;
}) {
  const steps = boardSteps(payload);
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        דברו עם כרמן על הפרויקט. הכלים הקיימים נשארים זמינים עד שהלוח יחליף
        אותם.
      </p>
      <ol className="mt-6 flex flex-wrap gap-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex h-28 w-40 flex-col justify-between rounded-2xl border bg-background p-3 shadow-sm"
          >
            <span className="text-xs text-muted-foreground">{index + 1}</span>
            <span className="font-medium">{step.label}</span>
            <span
              className={cn(
                "text-xs",
                step.ready ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {step.ready ? "התחיל" : "עדיין לא"}
            </span>
          </li>
        ))}
      </ol>
      {toolsHref ? (
        <Button className="mt-6" asChild>
          <Link to={toolsHref}>המשך בכלים הקיימים</Link>
        </Button>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          בונה אתרים יתווסף בשלב הבא.
        </p>
      )}
    </div>
  );
}
