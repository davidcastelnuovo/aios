import { WeeklyTaskBoard } from "@/components/tasks/WeeklyTaskBoard";

export default function Tasks() {
  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col min-h-0">
      <h1 className="text-2xl font-bold mb-4 shrink-0">משימות</h1>
      <div className="flex-1 min-h-0">
        <WeeklyTaskBoard />
      </div>
    </div>
  );
}
