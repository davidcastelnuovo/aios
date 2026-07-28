const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'
const MORNING_HOUR = 8
const MORNING_MINUTE = 30
const EVENING_CUTOFF_HOUR = 20

type LocalParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function localParts(date: Date): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  }
}

function israelLocalToUtc(parts: LocalParts): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  let result = new Date(target)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localParts(result)
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    )
    result = new Date(result.getTime() + target - actualAsUtc)
  }
  return result
}

function shiftLocalDate(parts: LocalParts, days: number): LocalParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
  }
}

function isBeforeMorning(parts: LocalParts) {
  return parts.hour < MORNING_HOUR
    || (parts.hour === MORNING_HOUR && parts.minute < MORNING_MINUTE)
}

export function taskReminderAt(task: {
  priority: number
  created_at: string
  due_date: string | null
  due_time: string | null
}): Date | null {
  if (task.priority >= 8) {
    const fiveHoursLater = new Date(Date.parse(task.created_at) + 5 * 60 * 60 * 1000)
    const local = localParts(fiveHoursLater)
    if (local.hour >= EVENING_CUTOFF_HOUR) {
      const nextMorning = shiftLocalDate(local, 1)
      return israelLocalToUtc({ ...nextMorning, hour: MORNING_HOUR, minute: MORNING_MINUTE })
    }
    if (isBeforeMorning(local)) {
      return israelLocalToUtc({ ...local, hour: MORNING_HOUR, minute: MORNING_MINUTE })
    }
    return fiveHoursLater
  }

  if (!task.due_date) return null
  const [year, month, day] = task.due_date.split('-').map(Number)
  const [hour = 9, minute = 0] = (task.due_time || '09:00').split(':').map(Number)
  const previousDay = shiftLocalDate({ year, month, day, hour, minute }, -1)
  if (previousDay.hour >= EVENING_CUTOFF_HOUR || isBeforeMorning(previousDay)) {
    return israelLocalToUtc({ ...previousDay, hour: 19, minute: 0 })
  }
  return israelLocalToUtc(previousDay)
}
