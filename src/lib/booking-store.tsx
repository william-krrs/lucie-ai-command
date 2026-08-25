import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "lucie:booking:v2";
const LEGACY_KEY = "lucie:booking:v1";
const CLIENT_REF_KEY = "lucie:booking:clientRef";

function getOrCreateClientRef(): string {
  if (typeof window === "undefined") return "";
  let ref = window.localStorage.getItem(CLIENT_REF_KEY);
  if (!ref) {
    ref =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CLIENT_REF_KEY, ref);
  }
  return ref;
}

export function getClientRef(): string {
  return getOrCreateClientRef();
}

export type BookingStatus = "pending" | "active" | "completed" | "cancelled";

export type BookingUser = {
  name?: string;
  email?: string;
};

export type Booking = {
  /** ISO date (YYYY-MM-DD) du RDV pris dans l’agenda en ligne. */
  date: string;
  /** Horaire HH:MM lisible optionnel. */
  time?: string;
  /** Nom du participant retourné par l’agenda en ligne (optionnel). */
  inviteeName?: string;
  /** Contact associé au RDV (nom + email). */
  user?: BookingUser;
  /** Statut calculé/enregistré du RDV. */
  status: BookingStatus;
  /** Timestamp de création (ISO). */
  createdAt: string;
  /** Timestamp de dernière mise à jour (ISO). */
  updatedAt: string;
};

type Ctx = {
  booking: Booking | null;
  setBooking: (b: Omit<Booking, "status" | "updatedAt" | "createdAt"> & Partial<Pick<Booking, "status" | "createdAt" | "updatedAt">>) => void;
  updateBooking: (patch: Partial<Booking>) => void;
  clearBooking: () => void;
  /** true si un RDV existe et que la date est aujourd'hui ou passée (status !== cancelled). */
  isUnlocked: boolean;
  /** true si un RDV existe mais est dans le futur (status !== cancelled). */
  isPendingMeeting: boolean;
};

const BookingCtx = createContext<Ctx | null>(null);

function computeStatus(date: string, current: BookingStatus | undefined): BookingStatus {
  if (current === "cancelled") return "cancelled";
  const today = todayISO();
  if (date > today) return "pending";
  if (date === today) return "active";
  return "completed";
}

function normalize(raw: unknown): Booking | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Booking> & Record<string, unknown>;
  if (!r.date || typeof r.date !== "string") return null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  const status = computeStatus(r.date, r.status as BookingStatus | undefined);
  return {
    date: r.date,
    time: typeof r.time === "string" ? r.time : undefined,
    inviteeName: typeof r.inviteeName === "string" ? r.inviteeName : undefined,
    user:
      r.user && typeof r.user === "object"
        ? {
            name: typeof (r.user as BookingUser).name === "string" ? (r.user as BookingUser).name : undefined,
            email: typeof (r.user as BookingUser).email === "string" ? (r.user as BookingUser).email : undefined,
          }
        : undefined,
    status,
    createdAt,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : createdAt,
  };
}

function read(): Booking | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy v1 record if present.
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (!legacy) return null;
      const migrated = normalize(JSON.parse(legacy));
      if (migrated) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
      return null;
    }
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persist(b: Booking | null) {
  if (typeof window === "undefined") return;
  if (b) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  else window.localStorage.removeItem(STORAGE_KEY);
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
      if (e.key === STORAGE_KEY || e.key === LEGACY_KEY) setBookingState(read());
    };
    window.addEventListener("storage", onStorage);

    // Re-evaluate status when day changes / tab is refocused after midnight.
    const onFocus = () => setBookingState((prev) => (prev ? normalize(prev) : null));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const setBooking = useCallback<Ctx["setBooking"]>((b) => {
    const now = new Date().toISOString();
    const next: Booking = normalize({
      ...b,
      createdAt: b.createdAt ?? now,
      updatedAt: now,
      status: b.status ?? computeStatus(b.date, undefined),
    })!;
    persist(next);
    setBookingState(next);
  }, []);

  const updateBooking = useCallback<Ctx["updateBooking"]>((patch) => {
    setBookingState((prev) => {
      if (!prev) return prev;
      const merged = normalize({
        ...prev,
        ...patch,
        user: patch.user ? { ...prev.user, ...patch.user } : prev.user,
        updatedAt: new Date().toISOString(),
      });
      persist(merged);
      return merged;
    });
  }, []);

  const clearBooking = useCallback(() => {
    setBookingState((prev) => {
      if (prev) {
        // Persist a cancelled marker briefly for audit, then clear.
        const cancelled: Booking = {
          ...prev,
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        };
        persist(cancelled);
      }
      persist(null);
      return null;
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const active = !!booking && booking.status !== "cancelled";
    const today = todayISO();
    const isUnlocked = active && booking!.date <= today;
    const isPendingMeeting = active && booking!.date > today;
    return { booking, setBooking, updateBooking, clearBooking, isUnlocked, isPendingMeeting };
  }, [booking, setBooking, updateBooking, clearBooking]);

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