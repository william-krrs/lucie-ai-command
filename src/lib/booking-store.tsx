import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";
import { readAdminMode } from "@/lib/admin-mode";
import { UNLOCK_ALL_PAGES } from "@/lib/config";
import {
  BOOKING_TYPES,
  DEFAULT_BOOKING_TYPE,
  isBookingType,
  type BookingType,
  type BookingStatusNorm,
} from "@/lib/booking-types";

const STORAGE_KEY = "lucie:booking:v3";
const LEGACY_KEY_V2 = "lucie:booking:v2";
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
  /**
   * Statut normalisé côté base (`bookings.status_norm`). Un RDV créé depuis
   * l'agenda iClosed est confirmé par défaut ; le webhook/Realtime peut le
   * repasser à `pending`, `cancelled`, etc.
   */
  statusNorm: BookingStatusNorm;
  /** Type métier du rendez-vous (Découverte / Démo / Test & paramétrage). */
  bookingType: BookingType;
  /** Identifiant de l'événement côté agenda externe (iClosed), si connu. */
  iclosedEventId?: string;
  /** Lieu ou lien de la réunion. */
  meetingLocation?: string;
  /** Timestamp de création (ISO). */
  createdAt: string;
  /** Timestamp de dernière mise à jour (ISO). */
  updatedAt: string;
};

export type BookingMap = Partial<Record<BookingType, Booking>>;

type BookingInput = Omit<
  Booking,
  "status" | "statusNorm" | "updatedAt" | "createdAt" | "bookingType"
> &
  Partial<Pick<Booking, "status" | "statusNorm" | "createdAt" | "updatedAt" | "bookingType">>;

type Ctx = {
  /** Tous les rendez-vous connus, indexés par type. */
  bookings: BookingMap;
  /** Raccourci historique : le RDV Démo (r2_demo). */
  booking: Booking | null;
  getBookingFor: (type: BookingType) => Booking | null;
  setBookingFor: (type: BookingType, b: BookingInput) => void;
  updateBookingFor: (type: BookingType, patch: Partial<Booking>) => void;
  clearBookingFor: (type: BookingType) => void;
  setBooking: (b: BookingInput) => void;
  updateBooking: (patch: Partial<Booking>) => void;
  clearBooking: () => void;
  /** true dès qu'un RDV Démo confirmé existe (status !== cancelled). */
  isUnlocked: boolean;
  /** true si le RDV Démo existe mais est dans le futur (status !== cancelled). */
  isPendingMeeting: boolean;
};

type BookingGlobal = typeof globalThis & {
  __lucieBookingContext?: Context<Ctx | null>;
};

// Keep one context identity across Vite hot updates. Without this, the provider
// and a freshly reloaded consumer can temporarily reference different contexts.
const bookingGlobal = globalThis as BookingGlobal;
const BookingCtx =
  bookingGlobal.__lucieBookingContext ?? createContext<Ctx | null>(null);
bookingGlobal.__lucieBookingContext = BookingCtx;

function computeStatus(date: string, current: BookingStatus | undefined): BookingStatus {
  if (current === "cancelled") return "cancelled";
  const today = todayISO();
  if (date > today) return "pending";
  if (date === today) return "active";
  return "completed";
}

function normalize(raw: unknown, fallbackType: BookingType = DEFAULT_BOOKING_TYPE): Booking | null {
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
    bookingType: isBookingType(r.bookingType) ? r.bookingType : fallbackType,
    iclosedEventId: typeof r.iclosedEventId === "string" ? r.iclosedEventId : undefined,
    meetingLocation: typeof r.meetingLocation === "string" ? r.meetingLocation : undefined,
    createdAt,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : createdAt,
  };
}

function normalizeMap(raw: unknown): BookingMap {
  if (!raw || typeof raw !== "object") return {};
  const out: BookingMap = {};
  for (const type of BOOKING_TYPES) {
    const entry = normalize((raw as Record<string, unknown>)[type], type);
    if (entry) out[type] = { ...entry, bookingType: type };
  }
  return out;
}

function read(): BookingMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeMap(JSON.parse(raw));

    // Migration des formats précédents : un RDV unique = un RDV Démo.
    const legacy =
      window.localStorage.getItem(LEGACY_KEY_V2) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return {};
    const migrated = normalize(JSON.parse(legacy), DEFAULT_BOOKING_TYPE);
    if (!migrated) return {};
    const map: BookingMap = { [DEFAULT_BOOKING_TYPE]: migrated };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.localStorage.removeItem(LEGACY_KEY_V2);
    window.localStorage.removeItem(LEGACY_KEY);
    return map;
  } catch {
    return {};
  }
}

function persist(map: BookingMap) {
  if (typeof window === "undefined") return;
  const hasAny = Object.values(map).some(Boolean);
  if (hasAny) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  else window.localStorage.removeItem(STORAGE_KEY);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Le type de RDV concerné dépend de la page en cours (fallback : Démo). */
function bookingTypeForCurrentPage(): BookingType {
  if (typeof window === "undefined") return DEFAULT_BOOKING_TYPE;
  return window.location.pathname.startsWith("/rdv-test") ? "setup_test" : DEFAULT_BOOKING_TYPE;
}

function bookingFromIclosedConfirmation(
  event: MessageEvent,
): Omit<Booking, "status" | "updatedAt" | "bookingType"> | null {
  if (event.origin !== "https://app.iclosed.io") return null;
  if (!event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  if (data.type !== "openInParentTab" || typeof data.url !== "string") return null;

  try {
    const confirmation = new URL(data.url, window.location.origin);
    const start = confirmation.searchParams.get("event_start_time");
    const confirmationId =
      confirmation.searchParams.get("previewId") ??
      confirmation.searchParams.get("invitee_uuid");
    if (!start || !confirmationId) return null;

    const dateTime = new Date(start);
    if (Number.isNaN(dateTime.getTime())) return null;
    const wallClock = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    const date = wallClock
      ? `${wallClock[1]}-${wallClock[2]}-${wallClock[3]}`
      : `${dateTime.getFullYear()}-${String(dateTime.getMonth() + 1).padStart(2, "0")}-${String(dateTime.getDate()).padStart(2, "0")}`;
    const time = wallClock
      ? `${wallClock[4]}:${wallClock[5]}`
      : `${String(dateTime.getHours()).padStart(2, "0")}:${String(dateTime.getMinutes()).padStart(2, "0")}`;
    const name = confirmation.searchParams.get("invitee_full_name") ?? undefined;
    const email =
      confirmation.searchParams.get("Invitee_email") ??
      confirmation.searchParams.get("invitee_email") ??
      undefined;

    return {
      date,
      time,
      inviteeName: name,
      user: email ? { name, email } : undefined,
      iclosedEventId: confirmationId,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<BookingMap>({});
  const [adminPreview, setAdminPreview] = useState(false);

  useEffect(() => {
    setAdminPreview(readAdminMode());
    setBookings(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_KEY_V2 || e.key === LEGACY_KEY) {
        setBookings(read());
      }
    };
    window.addEventListener("storage", onStorage);

    // Re-evaluate status when day changes / tab is refocused after midnight.
    const onFocus = () => setBookings((prev) => normalizeMap(prev));
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const setBookingFor = useCallback<Ctx["setBookingFor"]>((type, b) => {
    const now = new Date().toISOString();
    const next = normalize(
      {
        ...b,
        bookingType: type,
        createdAt: b.createdAt ?? now,
        updatedAt: now,
        status: b.status ?? computeStatus(b.date, undefined),
      },
      type,
    );
    if (!next) return;
    setBookings((prev) => {
      const merged: BookingMap = { ...prev, [type]: next };
      persist(merged);
      return merged;
    });
  }, []);

  const updateBookingFor = useCallback<Ctx["updateBookingFor"]>((type, patch) => {
    setBookings((prev) => {
      const current = prev[type];
      if (!current) return prev;
      const next = normalize(
        {
          ...current,
          ...patch,
          bookingType: type,
          user: patch.user ? { ...current.user, ...patch.user } : current.user,
          updatedAt: new Date().toISOString(),
        },
        type,
      );
      if (!next) return prev;
      const merged: BookingMap = { ...prev, [type]: next };
      persist(merged);
      return merged;
    });
  }, []);

  const clearBookingFor = useCallback<Ctx["clearBookingFor"]>((type) => {
    setBookings((prev) => {
      const merged: BookingMap = { ...prev };
      delete merged[type];
      persist(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    const onIclosedConfirmation = (event: MessageEvent) => {
      const confirmed = bookingFromIclosedConfirmation(event);
      if (confirmed) setBookingFor(bookingTypeForCurrentPage(), confirmed);
    };
    // The provider mounts before the external widget script, so this listener
    // records the confirmation before iClosed redirects the parent tab.
    window.addEventListener("message", onIclosedConfirmation);
    return () => window.removeEventListener("message", onIclosedConfirmation);
  }, [setBookingFor]);

  const value = useMemo<Ctx>(() => {
    const demo = bookings[DEFAULT_BOOKING_TYPE] ?? null;
    const active = !!demo && demo.status !== "cancelled";
    const today = todayISO();
    // Seul un RDV Démo confirmé (r2_demo) débloque la suite du parcours.
    // Le mode aperçu interne permet à l'équipe Lucie de revoir chaque étape
    // sans créer de faux rendez-vous prospect.
    const isUnlocked = UNLOCK_ALL_PAGES || active || adminPreview;
    const isPendingMeeting = active && demo!.date > today;
    return {
      bookings,
      booking: demo,
      getBookingFor: (type) => bookings[type] ?? null,
      setBookingFor,
      updateBookingFor,
      clearBookingFor,
      setBooking: (b) => setBookingFor(DEFAULT_BOOKING_TYPE, b),
      updateBooking: (patch) => updateBookingFor(DEFAULT_BOOKING_TYPE, patch),
      clearBooking: () => clearBookingFor(DEFAULT_BOOKING_TYPE),
      isUnlocked,
      isPendingMeeting,
    };
  }, [adminPreview, bookings, setBookingFor, updateBookingFor, clearBookingFor]);

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
