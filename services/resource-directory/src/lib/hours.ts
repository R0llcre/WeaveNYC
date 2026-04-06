import type { HoursRecord, HoursWindow, WeekdayKey } from "../types.js";

const dayMap: Record<string, WeekdayKey> = {
  mon: "mon",
  monday: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  wed: "wed",
  wednesday: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  fri: "fri",
  friday: "fri",
  sat: "sat",
  saturday: "sat",
  sun: "sun",
  sunday: "sun"
};

const weekdayOrder: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function normalizeHoursValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^closed$/i.test(trimmed)) {
    return "closed";
  }

  return trimmed.replace(/\s+/g, "");
}

export function buildHoursFromSchedule(daysValue: string, hoursValue: string): HoursRecord {
  const hours = normalizeHoursValue(hoursValue);
  const days = daysValue
    .split(/[/,&]+/)
    .map((entry) => entry.trim().toLowerCase())
    .map((entry) => entry.replace(/\(.+\)/g, '').trim())
    .filter(Boolean)
    .map((entry) => dayMap[entry])
    .filter((entry): entry is WeekdayKey => Boolean(entry));

  if (days.length === 0) {
    return {
      notes: `${daysValue.trim()} ${hoursValue.trim()}`.trim()
    };
  }

  const record: HoursRecord = {};
  for (const day of days) {
    record[day] = hours;
  }
  return record;
}

export function mergeHours(primary: HoursRecord | null, secondary: HoursRecord | null): HoursRecord | null {
  if (!primary && !secondary) {
    return null;
  }

  const merged: HoursRecord = {
    ...secondary,
    ...primary
  };

  if (primary?.notes || secondary?.notes) {
    merged.notes = [primary?.notes, secondary?.notes].filter(Boolean).join(" | ");
  }

  return merged;
}

export function toWeeklyHours(hours: HoursRecord | null) {
  return weekdayOrder.map((day) => {
    const value = normalizeHoursValue(hours?.[day]);
    const parsed = parseTimeWindows(value);

    return {
      day,
      windows: parsed.map((entry) => ({
        opensAt: entry.opensAt,
        closesAt: entry.closesAt
      })),
      closed: parsed.length === 0
    };
  });
}

export function isOpenToday(hours: HoursRecord | null, now = new Date()): boolean {
  const day = getCurrentWeekday(now);
  return parseTimeWindows(normalizeHoursValue(hours?.[day])).length > 0;
}

export function isOpenNow(hours: HoursRecord | null, now = new Date()): boolean {
  const day = getCurrentWeekday(now);
  const parsed = parseTimeWindows(normalizeHoursValue(hours?.[day]));
  const minutes = getCurrentMinutes(now);
  return parsed.some((entry) => minutes >= entry.opensMinutes && minutes <= entry.closesMinutes);
}

export function parseTimeWindows(value: string | null): Array<HoursWindow & {
  opensMinutes: number;
  closesMinutes: number;
}> {
  if (!value || value.toLowerCase() === "closed") {
    return [];
  }

  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => parseSingleTimeWindow(segment))
    .filter((entry): entry is HoursWindow & { opensMinutes: number; closesMinutes: number } => entry !== null);
}

function getCurrentWeekday(now: Date): WeekdayKey {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short"
  })
    .format(now)
    .toLowerCase();

  return dayMap[value] ?? "mon";
}

function getCurrentMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinutes(value: string) {
  const normalized = normalizeClockLabel(value);
  const match = normalized.match(/^(\d{2}):(\d{2})(AM|PM)$/);
  if (!match) {
    return 0;
  }

  let hour = Number(match[1] ?? "0") % 12;
  const minute = Number(match[2] ?? "0");
  if ((match[3] ?? "AM") === "PM") {
    hour += 12;
  }
  return hour * 60 + minute;
}

function parseSingleTimeWindow(value: string) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/^(\d{1,2})-(\d{1,2}:\d{2}[AP]M)$/i, "$1:00$2");

  const match = normalized.match(/^(\d{1,2}(?::\d{2})?[AP]M)-(\d{1,2}(?::\d{2})?[AP]M)$/i);
  if (!match) {
    return null;
  }

  const opensValue = match[1] ?? "";
  const closesValue = match[2] ?? "";
  return {
    opensAt: normalizeClockLabel(opensValue),
    closesAt: normalizeClockLabel(closesValue),
    opensMinutes: toMinutes(opensValue),
    closesMinutes: toMinutes(closesValue)
  };
}

function normalizeClockLabel(value: string) {
  const match = value.toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
  if (!match) {
    return value.toUpperCase();
  }

  const hour = (match[1] ?? "0").padStart(2, "0");
  const minute = (match[2] ?? "00").padStart(2, "0");
  return `${hour}:${minute}${match[3] ?? "AM"}`;
}
