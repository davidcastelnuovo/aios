import { WeeklyTaskBoard } from "@/components/tasks/WeeklyTaskBoard";
import { GoalTree } from "@/components/tasks/GoalTree";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Target, ListTodo } from "lucide-react";

export default function Tasks() {
  const [showGoals, setShowGoals] = useState(false);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col min-h-0 overflow-hidden" style={{ overscrollBehavior: 'none' }}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold hidden md:block">משימות</h1>
        <Button
          variant={showGoals ? "default" : "outline"}
          size="sm"
          onClick={() => setShowGoals(!showGoals)}
          className="gap-1.5"
        >
          <Target className="h-4 w-4" />
          יעדים
        </Button>
      </div>

      {showGoals && (
        <div className="mb-4 shrink-0">
          <GoalTree />
        </div>
      )}

      <div className="flex-1 min-h-0">
        <WeeklyTaskBoard />
      </div>
    </div>
  );
}
