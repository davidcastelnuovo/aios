import { WeeklyTaskBoard } from "@/components/tasks/WeeklyTaskBoard";

export default function Tasks() {
  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold mb-4">משימות</h1>
      <WeeklyTaskBoard />
    </div>
  );
}
