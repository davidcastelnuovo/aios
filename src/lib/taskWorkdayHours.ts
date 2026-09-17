/** Workday hours for the tasks calendar grid (7:00–19:00). */

export const TASK_DAY_START_HOUR = 7;
export const TASK_DAY_END_HOUR = 19;

export function generateWorkdayTimeSlots(
  startHour = TASK_DAY_START_HOUR,
  endHour = TASK_DAY_END_HOUR,
): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    const h = String(hour).padStart(2, "0");
    slots.push(`${h}:00`);
    if (hour < endHour) slots.push(`${h}:30`);
  }
  return slots;
}

export function workdaySlotIndex(time: string, startHour = TASK_DAY_START_HOUR): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours - startHour) * 2 + (minutes >= 30 ? 1 : 0);
}
