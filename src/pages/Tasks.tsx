import { WeeklyTaskBoard } from "@/components/tasks/WeeklyTaskBoard";

export default function Tasks() {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-h-0 overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <div className="flex-1 min-h-0">
        <WeeklyTaskBoard />
      </div>
    </div>
  );
}
