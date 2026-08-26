import { describe, it, expect } from "vitest";
import { bookingTypeFromIclosedSlug } from "@/lib/booking-types";
import { BOOKING_URL_SETUP } from "@/lib/config";
import { bookingTimeFieldsFromCallBooked } from "@/lib/iclosed-booking-time";

describe("setup_test", () => {
  it("url", () => expect(BOOKING_URL_SETUP).toBe("https://app.iclosed.io/e/Iucie/setup-test-lucie"));
  it("slug", () => {
    expect(bookingTypeFromIclosedSlug("setup-test-lucie")).toBe("setup_test");
    expect(bookingTypeFromIclosedSlug("demo-lucie")).toBe("r2_demo");
  });
  it("tz", () => {
    const f = bookingTimeFieldsFromCallBooked(
      { event: { start_time: "2026-09-10T09:00:00Z" } }, "2026-09-10T09:00:00Z", "Europe/Paris");
    expect(f?.meeting_time).toBe("09:00");
    expect(new Date(f!.meeting_at as string).toISOString()).toBe("2026-09-10T07:00:00.000Z");
  });
});
