import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck2,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BOOKING_URL, REQUIRE_ACCOUNT } from "@/lib/config";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BOOKING_TYPE, type BookingType } from "@/lib/booking-types";
import { useIsAdmin } from "@/lib/use-is-admin";

import { useBooking, formatBookingDate, getClientRef, type Booking } from "@/lib/booking-store";
import { upsertBooking, cancelBooking } from "@/lib/bookings.functions";
import { issueBookingToken } from "@/lib/booking-token.functions";
import { createSharedDiagnostic } from "@/lib/share.functions";
import { useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import { useJourneyAccess } from "@/lib/journey-access";
import { addShareHistoryEntry } from "@/lib/share-history";
import { toast } from "sonner";

/** Source du script du widget inline iClosed. */
const ICLOSED_WIDGET_SRC = "https://app.iclosed.io/assets/widget.js";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export type DetectedBooking = {
  date: string;
  time?: string;
  name?: string;
  email?: string;
};

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase()) && typeof obj[k] === "string" && obj[k]) {
      return obj[k] as string;
    }
  }
  return undefined;
}

function flatten(value: unknown, out: Record<string, unknown> = {}, depth = 0) {
  if (depth > 4 || !value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v && typeof v === "object") flatten(v, out, depth + 1);
    else if (!(k in out)) out[k] = v;
  }
  return out;
}

function mergeUrlParameters(value: unknown, out: Record<string, unknown>) {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value, window.location.origin);
    url.searchParams.forEach((parameterValue, key) => {
      if (!(key in out)) out[key] = parameterValue;
    });
  } catch {
    // The value is not a URL; there is nothing to extract.
  }
}

/**
 * Analyse un message posté par le widget iClosed et en extrait la réservation
 * si l'événement correspond à un créneau confirmé.
 */
export function parseIclosedBooking(raw: unknown): DetectedBooking | null {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const flat = flatten(data);
  // After a successful booking, iClosed asks the parent page to open its
  // confirmation URL. The booking details are carried as query parameters
  // inside `data.url`, rather than as top-level postMessage fields.
  for (const value of Object.values(flat)) mergeUrlParameters(value, flat);
  const kind = String(
    pick(flat, ["event", "type", "action", "name", "status"]) ?? "",
  ).toLowerCase();
  const confirmationId = pick(flat, ["previewid", "invitee_uuid", "call_id", "callid"]);
  const looksBooked =
    (/book|schedul|appointment|meeting|confirm|complete/.test(kind) ||
      (kind === "openinparenttab" && !!confirmationId)) &&
    !/cancel/.test(kind);
  const start = pick(flat, [
    "event_start_time",
    "invitee_start_time",
    "utc_start_time",
    "starttime",
    "start_time",
    "startsat",
    "starts_at",
    "eventstarttime",
    "scheduledat",
    "scheduled_at",
    "datetime",
    "date",
  ]);
  if (!looksBooked || !start) return null;
  const wallClock = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  const date = wallClock
    ? `${wallClock[1]}-${wallClock[2]}-${wallClock[3]}`
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = wallClock
    ? `${wallClock[4]}:${wallClock[5]}`
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return {
    date,
    time,
    name: pick(flat, [
      "name",
      "invitee",
      "inviteename",
      "invitee_full_name",
      "fullname",
      "firstname",
    ]),
    email: pick(flat, ["email", "inviteeemail", "invitee_email", "useremail", "answer_1"]),
  };
}


export type BookingEmbedProps = {
  url?: string;
  /** Type métier du rendez-vous géré par ce module (défaut : RDV Démo). */
  bookingType?: BookingType;
  eyebrow?: string;
  title?: string;
  description?: string;
  bookedTitle?: string;
  bookedDescription?: string;
  /** État R2 serveur faisant autorité sur le cache local. */
  authoritativeBooking?: {
    statusNorm: Booking["statusNorm"] | null;
    meetingAt: string | null;
    loading: boolean;
  };
};

export function BookingEmbed({
  url,
  bookingType = DEFAULT_BOOKING_TYPE,
  eyebrow,
  title,
  description,
  bookedTitle,
  bookedDescription,
  authoritativeBooking,
}: BookingEmbedProps = {}) {
  const { getBookingFor, setBookingFor, clearBookingFor } = useBooking();
  const cachedBooking = getBookingFor(bookingType);
  const booking = (() => {
    if (!authoritativeBooking) return cachedBooking;
    if (authoritativeBooking.loading || authoritativeBooking.statusNorm !== "confirmed" || !authoritativeBooking.meetingAt) {
      return null;
    }
    const date = new Date(authoritativeBooking.meetingAt);
    if (Number.isNaN(date.getTime())) return null;
    return {
      ...(cachedBooking ?? {}),
      date: new Intl.DateTimeFormat("fr-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date),
      time: new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date),
      status: "pending" as const,
      statusNorm: "confirmed" as const,
      bookingType,
      createdAt: cachedBooking?.createdAt ?? authoritativeBooking.meetingAt,
      updatedAt: cachedBooking?.updatedAt ?? authoritativeBooking.meetingAt,
    } satisfies Booking;
  })();
  const setBooking = (b: Parameters<typeof setBookingFor>[1]) => setBookingFor(bookingType, b);
  const clearBooking = () => clearBookingFor(bookingType);
  const isAdmin = useIsAdmin();

  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [manualDate, setManualDate] = useState(todayISO());
  const [manualTime, setManualTime] = useState("10:00");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const [scriptError, setScriptError] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const upsertBookingFn = useServerFn(upsertBooking);
  const cancelBookingFn = useServerFn(cancelBooking);
  const issueBookingTokenFn = useServerFn(issueBookingToken);
  const createShareFn = useServerFn(createSharedDiagnostic);
  const { state } = useLucie();
  const metrics = useMetrics();
  const recommendation = useRecommendation();
  const { refresh: refreshJourney } = useJourneyAccess();

  /**
   * URL brute de l'événement iClosed (servant à la fois de `data-url` pour le
   * widget inline et de lien « ouvrir dans un nouvel onglet »). iClosed récupère
   * automatiquement les paramètres UTM depuis les cookies et le référent, il n'y
   * a donc pas de pré-remplissage d'URL à construire comme avec l’ancien outil
   * de réservation. On ajoute `utm_booking_token` : un token signé côté serveur
   * qui permet au webhook iClosed de rattacher le RDV au bon utilisateur sans
   * exposer d'identifiant métier dans l'URL.
   */
  const baseBookingUrl = url ?? BOOKING_URL;
  const [bookingUrl, setBookingUrl] = useState(baseBookingUrl);

  // Construit l'URL iClosed avec un token de corrélation signé (utm_booking_token).
  // Le token est renouvelé tant que la page est ouverte : à chaque variation du
  // client_ref / bookingType on en demande un nouveau au serveur. Tant que la
  // requête est en cours, on affiche le widget avec une URL sans token (iClosed
  // reste fonctionnel, mais sans corrélation fiable : le webhook replantera sur
  // client_ref/utm_client_ref).
  useEffect(() => {
    let cancelled = false;
    async function buildUrl() {
      let hadSession = false;
      try {
        const clientRef = getClientRef();
        // Référence héritée non-UUID : on ne sollicite pas le serveur (ZodError).
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientRef)) {
          throw new Error("invalid-client-ref");
        }
        // Le token est émis par une fonction serveur authentifiée : sans session
        // (bootstrap anonyme encore en cours), on part directement sur le repli
        // plutôt que de déclencher une 401.
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        const sessionUser = sessionData.session?.user as
          | { is_anonymous?: boolean; email?: string | null }
          | undefined;
        if (!sessionUser) throw new Error("no-session");
        // Une session anonyme héritée ne doit jamais porter un RDV client.
        if (REQUIRE_ACCOUNT && (sessionUser.is_anonymous === true || !sessionUser.email)) {
          throw new Error("no-account");
        }
        hadSession = true;
        const { token } = await issueBookingTokenFn({
          data: { clientRef, bookingType },
        });
        if (cancelled) return;

        const next = new URL(baseBookingUrl);
        next.searchParams.set("utm_booking_token", token);
        // Corrélation secondaire conservée : le token signé reste prioritaire
        // côté webhook, client_ref n'est qu'un repli.
        next.searchParams.set("utm_client_ref", clientRef);
        next.searchParams.set("utm_source", "lucie-command-center");
        next.searchParams.set("utm_medium", bookingType);
        setBookingUrl(next.toString());
      } catch (error) {
        if (cancelled) return;
        // Session présente mais émission échouée : ce n'est PAS un cas nominal.
        // On journalise une raison technique non sensible (pas de token, pas
        // d'identifiant) pour que le repli reste détectable en production.
        if (hadSession) {
          console.error(
            "[booking-token] emission failed with an active session",
            { bookingType, reason: error instanceof Error ? error.name : "unknown" },
          );
        }
        // Repli : sans token, on garde utm_client_ref pour la corrélation legacy.
        try {
          const next = new URL(baseBookingUrl);
          next.searchParams.set("utm_client_ref", getClientRef());
          next.searchParams.set("utm_source", "lucie-command-center");
          next.searchParams.set("utm_medium", bookingType);
          setBookingUrl(next.toString());
        } catch {
          setBookingUrl(baseBookingUrl);
        }
      }
    }

    void buildUrl();
    // Dès qu'une session apparaît (bootstrap anonyme / connexion), on retente
    // l'émission du token signé.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void buildUrl();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [baseBookingUrl, bookingType, issueBookingTokenFn]);


  // Realtime : le webhook iClosed peut confirmer/annuler le RDV côté serveur.
  useEffect(() => {
    const clientRef = getClientRef();
    if (!clientRef) return;
    const channel = supabase
      .channel(`bookings:${clientRef}:${bookingType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `client_ref=eq.${clientRef}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row || row.booking_type !== bookingType) return;
          if (row.status_norm === "cancelled") {
            clearBookingFor(bookingType);
            return;
          }
          if (typeof row.meeting_date !== "string") return;
          setBookingFor(bookingType, {
            date: row.meeting_date,
            time: typeof row.meeting_time === "string" ? row.meeting_time : undefined,
            inviteeName: typeof row.name === "string" ? row.name : undefined,
            user: typeof row.email === "string" ? { email: row.email } : undefined,
            iclosedEventId:
              typeof row.iclosed_event_id === "string" ? row.iclosed_event_id : undefined,
            meetingLocation:
              typeof row.meeting_location === "string" ? row.meeting_location : undefined,
            statusNorm:
              typeof row.status_norm === "string"
                ? (row.status_norm as Booking["statusNorm"])
                : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingType, clearBookingFor, setBookingFor]);

  const [recapUrl, setRecapUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Monte le widget inline iClosed de façon impérative : on crée le
  // <div class="iclosed-widget"> et on charge widget.js une seule fois. Le
  // MutationObserver interne de iClosed détecte alors le div et l'initialise
  // (création de l'iframe + squelette de chargement). On procède impérativement
  // pour éviter que React n'écrase le DOM manipulé par le widget.
  useEffect(() => {
    const container = widgetContainerRef.current;
    if (!container) return;
    setScriptError(false);
    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "iclosed-widget";
    widget.setAttribute("data-url", bookingUrl);
    widget.setAttribute("data-resize", "true");
    widget.setAttribute(
      "title",
      title ?? "Prise de rendez-vous avec l'équipe Lucie",
    );
    widget.style.width = "100%";
    widget.style.height = "620px";
    container.appendChild(widget);

    // Retire un éventuel script précédemment en échec pour pouvoir réessayer.
    const previousFailed = document.querySelector<HTMLScriptElement>(
      `script[src="${ICLOSED_WIDGET_SRC}"][data-failed="true"]`,
    );
    if (previousFailed) previousFailed.remove();

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${ICLOSED_WIDGET_SRC}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = ICLOSED_WIDGET_SRC;
      script.async = true;
      script.addEventListener("error", () => {
        script?.setAttribute("data-failed", "true");
        setScriptError(true);
      });
      document.body.appendChild(script);
    }
    // Si le script était déjà chargé avec succès, son MutationObserver
    // ré-initialise automatiquement ce nouveau div .iclosed-widget.

    return () => {
      container.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingUrl, title, widgetKey]);

  // Écoute la redirection de confirmation publiée par iClosed. Le widget ne
  // publie pas un événement « booked » dédié : il envoie `openInParentTab`
  // avec une URL contenant event_start_time, previewId et les coordonnées.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      try {
        if (!/(^|\.)iclosed\.io$/i.test(new URL(event.origin).hostname)) return;
      } catch {
        return;
      }
      const parsed = parseIclosedBooking(event.data);
      if (!parsed) return;
      void applyDetectedBooking(parsed);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyDetectedBooking(detected: DetectedBooking) {
    const email = detected.email ?? booking?.user?.email;
    const name = detected.name ?? booking?.user?.name;
    setBooking({
      date: detected.date,
      time: detected.time,
      inviteeName: name,
      user: email ? { name, email } : booking?.user,
      createdAt: new Date().toISOString(),
    });
    setAwaitingConfirm(false);
    setRescheduling(false);
    setManualDate(detected.date);
    if (detected.time) setManualTime(detected.time);
    toast.success("Rendez-vous détecté et enregistré automatiquement.");
    if (email) {
      try {
        const meetingAt = new Date(
          `${detected.date}T${detected.time || "10:00"}:00`,
        ).toISOString();
        await upsertBookingFn({
          data: {
            clientRef: getClientRef(),
            email,
            name,
            meetingDate: detected.date,
            meetingTime: detected.time,
            meetingAt,
            bookingType,
          },
        });
        await refreshJourney();
      } catch (e) {
        console.warn("[booking sync] failed", e);
      }
    }
  }

  function retryWidget() {
    setWidgetKey((k) => k + 1);
    toast.info("Nouvelle tentative de chargement du calendrier…");
  }


  async function generateRecap() {
    if (!booking || sharing) return;
    setSharing(true);
    try {
      const { token } = await createShareFn({
        data: {
          companyName: state.companyName,
          activity: state.activity,
          city: state.city,
          employees: state.employees,
          callsPerWeek: state.callsPerWeek,
          missedCalls: state.missedCalls,
          averageBasket: state.averageBasket,
          revenueGoal: state.revenueGoal,
          conversionRate: state.conversionRate,
          channels: state.channels,
          recommendation: {
            score: recommendation.score,
            tier: recommendation.tier,
            plan: recommendation.plan,
            priority: recommendation.priority,
            estimatedMonthlyRoi: recommendation.estimatedMonthlyRoi,
            justifications: recommendation.justifications,
            concerns: recommendation.concerns,
            planReason: recommendation.planReason,
          },
          metrics: {
            monthlyReceived: metrics.monthlyReceived,
            monthlyMissed: metrics.monthlyMissed,
            monthlyLostRevenue: metrics.monthlyLostRevenue,
            yearlyLostRevenue: metrics.yearlyLostRevenue,
            recoverableOpportunities: metrics.recoverableOpportunities,
            timeSavedHours: metrics.timeSavedHours,
          },
          booking: {
            date: booking.date,
            time: booking.time,
            inviteeName: booking.user?.name,
          },
        },
      });
      const link = `${window.location.origin}/d/${token}`;
      setRecapUrl(link);
      addShareHistoryEntry({ url: link, token, companyName: state.companyName || "Récap RDV" });
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Lien récap copié — envoyez-le au prospect.");
      } catch {
        toast.info("Lien récap généré — copiez-le ci-dessous.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Impossible de générer le lien récap.");
    } finally {
      setSharing(false);
    }
  }

  async function copyRecap() {
    if (!recapUrl) return;
    try {
      await navigator.clipboard.writeText(recapUrl);
      toast.success("Lien copié dans le presse-papiers.");
    } catch {
      toast.error("Copie impossible. Sélectionnez le lien manuellement.");
    }
  }

  async function confirm() {
    if (!manualDate) {
      toast.error("Sélectionnez la date de votre rendez-vous.");
      dateInputRef.current?.focus();
      return;
    }
    const email = booking?.user?.email;
    const name = booking?.user?.name;
    setBooking({
      date: manualDate,
      time: manualTime || undefined,
      inviteeName: name,
      user: email ? { name, email } : booking?.user,
      createdAt: new Date().toISOString(),
    });
    setAwaitingConfirm(false);
    setRescheduling(false);
    // Fire-and-forget server sync so reminders can be scheduled.
    if (email) {
      try {
        const meetingAt = new Date(
          `${manualDate}T${(manualTime || "10:00")}:00`,
        ).toISOString();
        await upsertBookingFn({
          data: {
            clientRef: getClientRef(),
            email,
            name,
            meetingDate: manualDate,
            meetingTime: manualTime || undefined,
            meetingAt,
            bookingType,
          },
        });
        await refreshJourney();
      } catch (e) {
        console.warn("[booking sync] failed", e);
      }
    }
    toast.success("Rendez-vous enregistré. La suite du parcours sera débloquée le jour J.");
  }

  if (booking && !rescheduling) {
    return (
      <section
        aria-labelledby="booking-booked-title"
        aria-live="polite"
        className="rounded-3xl border border-[oklch(0.65_0.17_155)]/40 bg-[oklch(0.65_0.17_155)]/[0.06] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[oklch(0.65_0.17_155)]/15 text-[oklch(0.45_0.17_155)]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-widest text-[oklch(0.45_0.17_155)]">
                Rendez-vous confirmé
              </div>
              <h2
                id="booking-booked-title"
                className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
              >
                {bookedTitle
                  ? bookedTitle
                  : `${formatBookingDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {bookedDescription ??
                  "Votre rendez-vous est confirmé. La Démonstration sera accessible 15 minutes avant votre rendez-vous. Les étapes suivantes se débloqueront progressivement au fil de votre accompagnement."}
              </p>
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-auto">
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => {
                setRescheduling(true);
                setManualDate(booking.date);
                setManualTime(booking.time ?? "10:00");
                toast.info("Choisissez un nouveau créneau ci-dessous.");
              }}
              aria-label="Reprogrammer mon rendez-vous"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Reprogrammer
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 rounded-xl text-destructive hover:text-destructive"
              onClick={async () => {
                clearBooking();
                setRescheduling(false);
                setRecapUrl(null);
                try {
                  await cancelBookingFn({ data: { clientRef: getClientRef(), bookingType } });
                  await refreshJourney();
                } catch {
                  /* silent */
                }
                toast.info("Rendez-vous annulé. Les pages suivantes sont à nouveau verrouillées.");
              }}
              aria-label="Annuler mon rendez-vous"
            >
              Annuler le RDV
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-primary">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Lien récap partageable
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Générez un lien lecture seule (diagnostic + RDV confirmé) à envoyer au prospect
            juste après la prise de rendez-vous.
          </p>
          {recapUrl ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={recapUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 min-h-11 rounded-xl bg-background font-mono text-xs"
                aria-label="Lien récapitulatif partageable"
              />
              <Button
                variant="outline"
                className="h-11 min-h-11 rounded-xl"
                onClick={copyRecap}
                aria-label="Copier le lien récap"
              >
                <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Copier
              </Button>
              <Button
                variant="ghost"
                className="h-11 min-h-11 rounded-xl"
                onClick={generateRecap}
                disabled={sharing}
                aria-label="Regénérer un nouveau lien"
              >
                Regénérer
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Button
                onClick={generateRecap}
                disabled={sharing}
                className="h-11 min-h-11 rounded-xl"
              >
                {sharing ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    Génération…
                  </>
                ) : (
                  <>
                    <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Générer le lien récap
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="booking-title"
      className="rounded-3xl border border-primary/30 bg-primary/[0.04] p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
            {eyebrow ?? "Étape suivante · Réservez votre rendez-vous"}
          </div>
          <h2
            id="booking-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {title ?? "Choisissez un créneau avec l'équipe Lucie"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description ??
              "Sélectionnez directement votre horaire ci-dessous. La suite du parcours se débloque automatiquement dès que votre rendez-vous est confirmé."}
          </p>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {scriptError && (
          <div
            role="alert"
            className="absolute inset-0 z-20 flex min-h-[400px] flex-col items-center justify-center gap-4 bg-card p-6 text-center"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="max-w-md">
              <h3 className="text-base font-semibold text-foreground">
                Impossible de charger le calendrier
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Le module de réservation iClosed n'a pas pu se charger. Un bloqueur de
                scripts, une extension ou une connexion instable peuvent en être la cause.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={retryWidget} className="min-h-11 rounded-xl">
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Réessayer
              </Button>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Ouvrir dans un nouvel onglet
              </a>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Vous pouvez aussi renseigner votre créneau manuellement ci-dessous une fois
              votre RDV pris.
            </p>
          </div>
        )}
        {/* Conteneur du widget inline iClosed (géré impérativement). */}
        <div ref={widgetContainerRef} className="min-h-[400px]" />
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Le calendrier ne s'affiche pas ?{" "}
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
        >
          Ouvrir dans un nouvel onglet <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>

      {isAdmin || awaitingConfirm ? (
      <div
        ref={confirmPanelRef}
        tabIndex={-1}
        role={awaitingConfirm ? "status" : undefined}
        aria-live={awaitingConfirm ? "polite" : undefined}
        className={
          "mt-6 scroll-mt-24 rounded-2xl border p-4 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary/50 sm:p-5 " +
          (awaitingConfirm
            ? "border-[oklch(0.65_0.17_155)]/50 bg-[oklch(0.65_0.17_155)]/[0.08] ring-2 ring-[oklch(0.65_0.17_155)]/30 animate-fade-in"
            : "border-border bg-card")
        }
      >

        <div
          className={
            "flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest " +
            (awaitingConfirm ? "text-[oklch(0.45_0.17_155)]" : "text-muted-foreground")
          }
        >
          {awaitingConfirm ? (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Créneau réservé — confirmez pour débloquer la suite
            </>
          ) : (
            "Saisie manuelle (mode admin)"
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {awaitingConfirm
            ? "Vérifiez la date et l'heure prérenseignées, puis validez. La suite du parcours se débloquera automatiquement le jour J."
            : "Réservé à l'équipe : renseignez un créneau de test pour débloquer la suite du parcours."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]">

          <div>
            <Label htmlFor="booking-date" className="text-xs">
              Date du rendez-vous
            </Label>
            <Input
              id="booking-date"
              ref={dateInputRef}
              type="date"
              min={todayISO()}
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="mt-1 h-11 min-h-11 rounded-xl"
              aria-required="true"
            />
          </div>
          <div>
            <Label htmlFor="booking-time" className="text-xs">
              Heure
            </Label>
            <Input
              id="booking-time"
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className="mt-1 h-11 min-h-11 rounded-xl"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={confirm}
              className="h-11 min-h-11 w-full rounded-xl sm:w-auto"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Confirmer le RDV
            </Button>
          </div>
        </div>
      </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-5">
          Votre réservation est détectée automatiquement dès que le créneau est
          confirmé dans l'agenda ci-dessus — aucune saisie manuelle n'est nécessaire.
        </p>
      )}
    </section>

  );
}
