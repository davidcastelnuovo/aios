const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'
const MORNING_HOUR = 8
const MORNING_MINUTE = 30

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

/** Notify at 08:30 Israel on the follow-up date. */
export function clientFollowUpNotifyAt(followUpDate: string | null): Date | null {
  if (!followUpDate) return null
  const [year, month, day] = followUpDate.split('-').map(Number)
  return israelLocalToUtc({
    year,
    month,
    day,
    hour: MORNING_HOUR,
    minute: MORNING_MINUTE,
  })
}

export function isFollowUpDue(followUpDate: string | null, now = new Date()): boolean {
  const notifyAt = clientFollowUpNotifyAt(followUpDate)
  return notifyAt !== null && notifyAt.getTime() <= now.getTime()
}
