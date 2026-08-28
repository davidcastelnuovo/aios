/** Standing fact: AIOS has a development environment. Never claim otherwise. */

export const DEV_ENVIRONMENT_SKILL_SLUG = 'dev_environment_exists'

export const DEV_ENVIRONMENT_STANDING = `יש סביבת פיתוח. אסור להגיד לדוד או לכל אייג׳נט שאין.
סביבת הפיתוח = קישור Vercel Preview של הענף (מדבר עם Staging).
Staging = ענף develop. Production = main בלבד.
אם Cloud Agent לא רואה Staging ב-.env המקומי — זה מצביע ל-Production בכוונה. זה לא אומר שאין סביבת פיתוח.
כששואלים — אמרי שכן יש, ושלחי את קישור ה-Preview. מקור: docs/ENVIRONMENTS.md`

export const DEV_ENVIRONMENT_TRIGGERS = [
  'סביבת פיתוח',
  'סביבת בדיקות',
  'אין סביבת פיתוח',
  'לא רואה סביבה',
  'לא רואה סביבת פיתוח',
  'סטייג',
  'סטייג׳ינג',
  'staging',
  'preview',
  'develop',
  'development environment',
  'dev environment',
  'אין staging',
  'vercel preview',
]
