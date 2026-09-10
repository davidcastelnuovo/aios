import { useEffect, useState } from "react";
import { isDbOverloadActive, subscribeDbOverload } from "@/lib/dbOverload";

export function SystemStatusBanner() {
  const [overloaded, setOverloaded] = useState(isDbOverloadActive);

  useEffect(() => subscribeDbOverload(() => setOverloaded(isDbOverloadActive())), []);

  useEffect(() => {
    if (!overloaded) return;
    const timer = window.setInterval(() => setOverloaded(isDbOverloadActive()), 5000);
    return () => window.clearInterval(timer);
  }, [overloaded]);

  if (!overloaded) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[80] border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100"
    >
      המערכת עמוסה כרגע (חיבורי דאטאבייס) — לא קורסת. מנסה שוב לבד; אפשר גם לרענן.
    </div>
  );
}
