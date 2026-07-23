import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CALENDLY_URL } from "@/lib/config";
import { useBooking, formatBookingDate } from "@/lib/booking-store";
import { toast } from "sonner";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function CalendlyEmbed() {
  const { booking, setBooking, clearBooking } = useBooking();
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [manualDate, setManualDate] = useState(todayISO());
  const [manualTime, setManualTime] = useState("10:00");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

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
        setAwaitingConfirm(true);
        toast.success("Créneau réservé ! Confirmez la date pour débloquer la suite.");
        setTimeout(() => {
          confirmPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          dateInputRef.current?.focus();
        }, 200);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function confirm() {
    if (!manualDate) {
      toast.error("Sélectionnez la date de votre rendez-vous.");
      dateInputRef.current?.focus();
      return;
    }
    setBooking({
      date: manualDate,
      time: manualTime || undefined,
      createdAt: new Date().toISOString(),
    });
    setAwaitingConfirm(false);
    setRescheduling(false);
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
                {formatBookingDate(booking.date)}
                {booking.time ? ` · ${booking.time}` : ""}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                La démonstration, les offres, l'installation et le questionnaire seront
                automatiquement débloqués le jour de votre rendez-vous.
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
              onClick={() => {
                clearBooking();
                setRescheduling(false);
                toast.info("Rendez-vous annulé. Les pages suivantes sont à nouveau verrouillées.");
              }}
              aria-label="Annuler mon rendez-vous"
            >
              Annuler le RDV
            </Button>
          </div>
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
            Étape suivante · Réservez votre rendez-vous
          </div>
          <h2
            id="calendly-title"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            Choisissez un créneau avec l'équipe Lucie
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sélectionnez directement votre horaire ci-dessous. La démonstration, les
            offres, l'installation et le questionnaire de préparation resteront
            verrouillés jusqu'au jour de votre rendez-vous.
          </p>
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {!iframeLoaded && (
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
        <iframe
          src={CALENDLY_URL}
          title="Prise de rendez-vous Calendly avec l'équipe Lucie"
          onLoad={() => setIframeLoaded(true)}
          loading="lazy"
          className="block h-[720px] w-full min-h-[560px] sm:h-[680px] md:h-[720px] lg:h-[760px]"
          allow="camera; microphone; autoplay; fullscreen; payment"
          style={{ colorScheme: "light" }}
        />
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
        role={awaitingConfirm ? "status" : undefined}
        aria-live={awaitingConfirm ? "polite" : undefined}
        className={
          "mt-6 rounded-2xl border p-4 transition-colors duration-300 sm:p-5 " +
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