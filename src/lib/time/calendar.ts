/** Defines a shift start and end in the organization time zone. */
export type Shift = {
  /** The start time as `HH:mm`. */
  start: string;
  /** The end time as `HH:mm`. */
  end: string;
  /**
   * The flag is true when the shift ends on the next day.
   * The times decide the value when this is absent.
   */
  overnight?: boolean;
};

/** Defines the window of one shift in UTC milliseconds. */
export type ShiftWindow = {
  /** The first instant of the shift, in UTC milliseconds. */
  startMs: number;
  /** The end instant of the shift, in UTC milliseconds. */
  endMs: number;
  /** The organization-local start date as `YYYY-MM-DD`. */
  day: string;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

type DateParts = { year: number; month: number; day: number };
type TimeParts = { hours: number; minutes: number };

/**
 * Throws an error when the time zone is not valid.
 * The function asks the runtime, so the result matches `Intl`.
 */
function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error("The time zone is not valid.");
  }
}

/** Reads the parts of a `YYYY-MM-DD` date. */
function parseDate(date: string): DateParts {
  const match = DATE_PATTERN.exec(date);
  if (match === null) {
    throw new Error("The date is not valid. Use YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("The date is not valid. Use YYYY-MM-DD.");
  }

  return { year, month, day };
}

/** Reads the parts of an `HH:mm` time. */
function parseTime(time: string): TimeParts {
  const match = TIME_PATTERN.exec(time);
  if (match === null) {
    throw new Error("The time is not valid. Use HH:mm.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error("The time is not valid. Use HH:mm.");
  }

  return { hours, minutes };
}

/**
 * Returns the date after the given date.
 * The function uses the UTC calendar, so the device time zone has no effect.
 */
function nextDate(date: string): string {
  const { year, month, day } = parseDate(date);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = String(next.getUTCFullYear()).padStart(4, "0");
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Returns the parts of an instant in the given time zone.
 * The function uses `Intl`, so the device time zone has no effect.
 */
function zonedParts(
  timestampMs: number,
  timeZone: string,
): DateParts & TimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestampMs));

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hours: values.hour,
    minutes: values.minute,
  };
}

/**
 * Returns the offset of the time zone at one instant, in milliseconds.
 * The offset is the local wall-clock time minus the UTC time.
 */
function zoneOffsetMs(timestampMs: number, timeZone: string): number {
  const parts = zonedParts(timestampMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
  );

  return asUtc - timestampMs;
}

/**
 * Converts an organization-local date and time to UTC milliseconds.
 * The function corrects the value with the zone offset of the result.
 */
function zonedTimeToMs(date: string, time: string, timeZone: string): number {
  const { year, month, day } = parseDate(date);
  const { hours, minutes } = parseTime(time);
  const guessMs = Date.UTC(year, month - 1, day, hours, minutes);
  const firstMs = guessMs - zoneOffsetMs(guessMs, timeZone);

  return guessMs - zoneOffsetMs(firstMs, timeZone);
}

/**
 * Returns the organization-local day of an instant.
 * The function uses the given time zone, not the device time zone.
 * The result uses the format `YYYY-MM-DD`.
 */
export function organizationDay(timestampMs: number, timeZone: string): string {
  assertTimeZone(timeZone);

  if (!Number.isFinite(timestampMs)) {
    throw new Error("The timestamp is not valid.");
  }

  const { year, month, day } = zonedParts(timestampMs, timeZone);
  const yearText = String(year).padStart(4, "0");
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");

  return `${yearText}-${monthText}-${dayText}`;
}

/**
 * Returns the window of a shift on an organization-local date.
 * The window belongs to the start date, also when the shift crosses midnight.
 * The function returns UTC milliseconds.
 */
export function shiftWindow(
  date: string,
  shift: Shift,
  timeZone: string,
): ShiftWindow {
  assertTimeZone(timeZone);

  const start = parseTime(shift.start);
  const end = parseTime(shift.end);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const isOvernight = shift.overnight ?? endMinutes <= startMinutes;

  const startMs = zonedTimeToMs(date, shift.start, timeZone);
  const endMs = zonedTimeToMs(
    isOvernight ? nextDate(date) : date,
    shift.end,
    timeZone,
  );

  return { startMs, endMs, day: date };
}
