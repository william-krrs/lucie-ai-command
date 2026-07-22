import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "lucie:booking:v1";

export type Booking = {
  /** ISO date (YYYY-MM-DD) du RDV pris via Calendly. */
  date: string;
  /** Horaire lisible optionnel. */
  time?: string;
  /** Nom d'invitee retourné par Calendly (optionnel). */
  inviteeName?: string;
  /** Timestamp de création. */
  createdAt: string;
};

type Ctx = {
  booking: Booking | null;
  setBooking: (b: Booking) => void;
  clearBooking: () => void;
  /** true si un RDV existe et que la date est aujourd'hui ou passée. */
  isUnlocked: boolean;
  /** true si un RDV existe mais est dans le futur. */
  isPendingMeeting: boolean;
};

const BookingCtx = createContext<Ctx | null>(null);

function read(): Booking | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Booking;
    if (!parsed?.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBookingState] = useState<Booking | null>(null);

  useEffect(() => {
    setBookingState(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setBookingState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setBooking = useCallback((b: Booking) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    }
    setBookingState(b);
  }, []);

  const clearBooking = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setBookingState(null);
  }, []);

  const value = useMemo<Ctx>(() => {
    const today = todayISO();
    const isUnlocked = !!booking && booking.date <= today;
    const isPendingMeeting = !!booking && booking.date > today;
    return { booking, setBooking, clearBooking, isUnlocked, isPendingMeeting };
  }, [booking, setBooking, clearBooking]);

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingCtx);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}

export function formatBookingDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m ?? 1) - 1, d ?? 1);
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}