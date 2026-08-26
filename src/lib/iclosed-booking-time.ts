type ObjectRecord = Record<string, unknown>;

export type IclosedBookingSlot = {
  date: string;
  time: string;
  at: string;
};

function asRecord(value: unknown): ObjectRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectRecord)
    : null;
}

function firstPayloadRecord(payload: unknown): ObjectRecord | null {
  if (Array.isArray(payload)) return asRecord(payload[0]);
  return asRecord(payload);
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wallParts(value: string): { date: string; time: string } | null {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

/** Décalage (ms) de la timezone IANA à un instant UTC donné. */
function timezoneOffsetMs(utcMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"] === "24" ? "0" : parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return asUtc - utcMs;
}

function wallToUtc(parts: { date: string; time: string }, timeZone: string): Date {
  const [year, month, day] = parts.date.split("-").map(Number);
  const [hour, minute] = parts.time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = naive - timezoneOffsetMs(naive, timeZone);
  utc = naive - timezoneOffsetMs(utc, timeZone);
  return new Date(utc);
}

function wallClockSlot(value: string, timeZone: string): IclosedBookingSlot | null {
  const local = wallParts(value);
  if (!local) return null;
  const instant = wallToUtc(local, validTimeZone(timeZone));
  if (Number.isNaN(instant.getTime())) return null;
  return { ...local, at: instant.toISOString() };
}

function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "Europe/Paris";
  }
}

function wallInZone(date: Date, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    time: `${parts["hour"] === "24" ? "00" : parts["hour"]}:${parts["minute"]}`,
  };
}

/**
 * Convertit un timestamp isolé : un offset explicite représente un instant,
 * sinon la valeur représente une heure murale dans `timeZone`.
 */
export function splitIclosedDateTime(
  value: string,
  timeZone: string,
): IclosedBookingSlot | null {
  const zone = validTimeZone(timeZone);
  const local = wallParts(value);
  if (!local) return null;
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());

  if (hasExplicitOffset) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) return null;
    return { ...wallInZone(instant, zone), at: instant.toISOString() };
  }

  const instant = wallToUtc(local, zone);
  if (Number.isNaN(instant.getTime())) return null;
  return { ...local, at: instant.toISOString() };
}

/**
 * Parse le vrai payload « Call booked » iClosed.
 * `event.utc_start_time` fournit l'instant à stocker, tandis que
 * `event.invitee_start_time` / `event.start_time` fournit l'heure murale choisie.
 */
export function bookingSlotFromCallBooked(
  payload: unknown,
  fallbackStart: string | undefined,
  timeZone: string,
): IclosedBookingSlot | null {
  const root = firstPayloadRecord(payload);
  const event = asRecord(root?.["event"]);
  const localStart = timestamp(event?.["invitee_start_time"])
    ?? timestamp(event?.["start_time"]);
  const utcStart = timestamp(event?.["utc_start_time"]);

  if (localStart && utcStart) {
    const local = wallParts(localStart);
    const instant = new Date(utcStart);
    if (local && !Number.isNaN(instant.getTime())) {
      return { ...local, at: instant.toISOString() };
    }
  }

  // Dans le payload Call booked, start_time / invitee_start_time sont des
  // heures locales par contrat iClosed. Certains envois les suffixent pourtant
  // de `Z` : ce suffixe ne doit pas transformer leur heure murale en UTC.
  if (localStart) return wallClockSlot(localStart, timeZone);

  return splitIclosedDateTime(fallbackStart ?? "", timeZone);
}

export function bookingTimeFieldsFromCallBooked(
  payload: unknown,
  fallbackStart: string | undefined,
  timeZone: string,
): { meeting_date: string; meeting_time: string; meeting_at: string } | null {
  const slot = bookingSlotFromCallBooked(payload, fallbackStart, timeZone);
  if (!slot) return null;
  return {
    meeting_date: slot.date,
    meeting_time: slot.time,
    meeting_at: slot.at,
  };
}