import { describe, expect, it } from "vitest";
import {
  bookingTimeFieldsFromCallBooked,
  splitIclosedDateTime,
} from "../src/lib/iclosed-booking-time";

describe("iClosed booking timezone conversion", () => {
  it("converts 09:00 Europe/Paris in summer to 07:00Z", () => {
    expect(splitIclosedDateTime("2026-08-27T09:00:00", "Europe/Paris")).toEqual({
      date: "2026-08-27",
      time: "09:00",
      at: "2026-08-27T07:00:00.000Z",
    });
  });

  it("converts 09:00 Europe/Paris in winter to 08:00Z", () => {
    expect(splitIclosedDateTime("2026-01-27T09:00:00", "Europe/Paris")).toEqual({
      date: "2026-01-27",
      time: "09:00",
      at: "2026-01-27T08:00:00.000Z",
    });
  });

  it("preserves a timestamp that already has an explicit offset", () => {
    expect(splitIclosedDateTime("2026-08-27T09:00:00+02:00", "Europe/Paris")).toEqual({
      date: "2026-08-27",
      time: "09:00",
      at: "2026-08-27T07:00:00.000Z",
    });
  });

  it("builds the final Call booked upsert time fields from the real payload path", () => {
    const payload = [
      {
        event: {
          start_time: "2026-08-27T09:00:00Z",
        },
        invitee: { timezone: "Europe/Paris" },
        hookType: "Call booked",
      },
    ];

    expect(
      bookingTimeFieldsFromCallBooked(
        payload,
        "2026-08-27T09:00:00Z",
        "Europe/Paris",
      ),
    ).toEqual({
      meeting_date: "2026-08-27",
      meeting_time: "09:00",
      meeting_at: "2026-08-27T07:00:00.000Z",
    });
  });

  it("uses iClosed utc_start_time as the instant without converting it twice", () => {
    const payload = [
      {
        event: {
          start_time: "2026-08-27T09:00:00+02:00",
          utc_start_time: "2026-08-27T07:00:00Z",
        },
        hookType: "Call booked",
      },
    ];

    expect(bookingTimeFieldsFromCallBooked(payload, undefined, "Europe/Paris")).toEqual({
      meeting_date: "2026-08-27",
      meeting_time: "09:00",
      meeting_at: "2026-08-27T07:00:00.000Z",
    });
  });
});