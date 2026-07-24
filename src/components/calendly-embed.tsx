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
import { CALENDLY_URL } from "@/lib/config";
import { useBooking, formatBookingDate, getClientRef } from "@/lib/booking-store";
import { upsertBooking, cancelBooking } from "@/lib/bookings.functions";
import { createSharedDiagnostic } from "@/lib/share.functions";
import { useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import { addShareHistoryEntry } from "@/lib/share-history";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export type CalendlyEmbedProps = {
  url?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  bookedTitle?: string;
  bookedDescription?: string;
};

export function CalendlyEmbed({
  url,
  eyebrow,
  title,
  description,
  bookedTitle,
  bookedDescription,
}: CalendlyEmbedProps = {}) {
  const calendlyUrl = url ?? CALENDLY_URL;
  const { booking, setBooking, clearBooking } = useBooking();
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [manualDate, setManualDate] = useState(todayISO());
  const [manualTime, setManualTime] = useState("10:00");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<null | "timeout" | "error">(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [inviteeEmail, setInviteeEmail] = useState<string | undefined>();
  const [inviteeName, setInviteeName] = useState<string | undefined>();
  const upsertBookingFn = useServerFn(upsertBooking);
  const cancelBookingFn = useServerFn(cancelBooking);
  const createShareFn = useServerFn(createSharedDiagnostic);
  const { state } = useLucie();
  const metrics = useMetrics();
  const recommendation = useRecommendation();
  const [recapUrl, setRecapUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Detect failed iframe load (blocked by network, tracker blockers, or CSP)
  useEffect(() => {
    if (iframeLoaded || iframeError || booking) return;
    const t = window.setTimeout(() => {
      if (!iframeLoaded) setIframeError("timeout");
    }, 12000);
    return () => window.clearTimeout(t);
  }, [iframeLoaded, iframeError, iframeKey, booking]);

  function retryIframe() {
    setIframeLoaded(false);
    setIframeError(null);
    setIframeKey((k) => k + 1);
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
      const url = `${window.location.origin}/d/${token}`;
      setRecapUrl(url);
      addShareHistoryEntry({ url, token, companyName: state.companyName || "Récap RDV" });
      try {
        await navigator.clipboard.writeText(url);
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

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.origin === "string" && !e.origin.includes("calendly.com")) return;
      const data = e.data as
        | { event?: string; payload?: { event?: { start_time?: string } } }
        | undefined;
      if (!data || typeof data !== "object" || typeof data.event !== "string") return;
      if (!data.event.startsWith("calendly.")) return;

      if (data.event === "calendly.event_scheduled") {
        const start = data.payload?.event?.start_time;
        if (start) {
          const d = new Date(start);
          if (!Number.isNaN(d.getTime())) {
            setManualDate(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                d.getDate(),
              ).padStart(2, "0")}`,
            );
            setManualTime(
              `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
            );
          }
        }
        // Try to grab invitee name/email from Calendly payload for auto-registration.
        const invitee = (data as any).payload?.invitee as
          | { name?: string; email?: string }
          | undefined;
        if (invitee?.email) setInviteeEmail(invitee.email);
        if (invitee?.name) setInviteeName(invitee.name);
        setAwaitingConfirm(true);
        toast.success("Créneau réservé ! Confirmez la date pour débloquer la suite.");
        // Smart, non-intrusive scroll & focus for mobile:
        // - Wait a frame so the panel is mounted with its new styles.
        // - Only scroll if the panel isn't already comfortably visible.
        // - Focus the panel container (tabindex=-1) instead of the date input
        //   to avoid popping the on-screen keyboard on mobile.
        // - Respect prefers-reduced-motion.
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            const panel = confirmPanelRef.current;
            if (!panel) return;
            const rect = panel.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const isMobile = window.matchMedia("(max-width: 767px)").matches;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const topVisible = rect.top >= 72 && rect.top <= vh * 0.75;
            const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
            if (!topVisible && !fullyVisible) {
              // Mobile: align near top with a small offset for sticky headers.
              // Desktop: keep it centered where it feels natural.
              if (isMobile) {
                const offset = 80; // sticky top bar allowance
                const target = window.scrollY + rect.top - offset;
                window.scrollTo({
                  top: Math.max(0, target),
                  behavior: reduce ? "auto" : "smooth",
                });
              } else {
                panel.scrollIntoView({
                  behavior: reduce ? "auto" : "smooth",
                  block: "center",
                });
              }
            }
            // Focus the panel (not the input) so screen readers announce it
            // and keyboard users land on it, without opening the mobile keyboard.
            panel.focus({ preventScroll: true });
          }, 120);
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function confirm() {
    if (!manualDate) {
      toast.error("Sélectionnez la date de votre rendez-vous.");
      dateInputRef.current?.focus();
      return;
    }
    const email = inviteeEmail ?? booking?.user?.email;
    const name = inviteeName ?? booking?.user?.name;
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
          },
        });
      } catch (e) {
        console.warn("[booking sync] failed", e);
      }
    }
    toast.success("Rendez-vous enregistré. La suite du parcours sera débloquée le jour J.");
  }

  if (booking && !rescheduling) {
    return (
      <section
        aria-labelledby="calendly-booked-title"
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
                id="calendly-booked-title"
                className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
              >
                {bookedTitle
                  ? bookedTitle
                  : `${formatBookingDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {bookedDescription ??
                  "La démonstration, les offres, l'installation et le questionnaire seront automatiquement débloqués le jour de votre rendez-vous."}
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
                  await cancelBookingFn({ data: { clientRef: getClientRef() } });
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
      aria-labelledby="calendly-title"
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
            id="calendly-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            {title ?? "Choisissez un créneau avec l'équipe Lucie"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description ??
              "Sélectionnez directement votre horaire ci-dessous. La démonstration, les offres, l'installation et le questionnaire de préparation resteront verrouillés jusqu'au jour de votre rendez-vous."}
          </p>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {!iframeLoaded && !iframeError && (
          <div
            className="absolute inset-0 z-10 grid animate-pulse place-items-center bg-card"
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <CalendarCheck2 className="h-8 w-8" />
              <span className="text-xs">Chargement du calendrier…</span>
            </div>
          </div>
        )}
        {iframeError ? (
          <div
            role="alert"
            className="flex min-h-[560px] flex-col items-center justify-center gap-4 bg-card p-6 text-center"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="max-w-md">
              <h3 className="text-base font-semibold text-foreground">
                Impossible de charger le calendrier
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {iframeError === "timeout"
                  ? "Le calendrier met trop de temps à répondre. Un bloqueur de scripts, une extension ou une connexion instable peuvent en être la cause."
                  : "Une erreur est survenue lors de l'ouverture du calendrier."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={retryIframe} className="min-h-11 rounded-xl">
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Réessayer
              </Button>
              <a
                href={CALENDLY_URL}
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
        ) : (
          <iframe
            key={iframeKey}
            src={CALENDLY_URL}
            title="Prise de rendez-vous Calendly avec l'équipe Lucie"
            onLoad={() => {
              setIframeLoaded(true);
              setIframeError(null);
            }}
            onError={() => setIframeError("error")}
            loading="lazy"
            className="block h-[720px] w-full min-h-[560px] sm:h-[680px] md:h-[720px] lg:h-[760px]"
            allow="camera; microphone; autoplay; fullscreen; payment"
            style={{ colorScheme: "light" }}
          />
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Le calendrier ne s'affiche pas ?{" "}
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
        >
          Ouvrir dans un nouvel onglet <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>

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
            "Vous avez déjà réservé ?"
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {awaitingConfirm
            ? "Vérifiez la date et l'heure prérenseignées, puis validez. La suite du parcours se débloquera automatiquement le jour J."
            : "Renseignez la date choisie pour débloquer automatiquement la suite du parcours le jour J."}
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
    </section>
  );
}