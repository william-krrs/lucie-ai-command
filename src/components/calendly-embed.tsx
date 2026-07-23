import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, CheckCircle2, RotateCcw } from "lucide-react";
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

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { event?: string } | undefined;
      if (!data || typeof data !== "object") return;
      if (data.event === "calendly.event_scheduled") {
        setAwaitingConfirm(true);
        toast.success("Rendez-vous détecté — confirmez la date pour débloquer la suite.");
        setTimeout(() => dateInputRef.current?.focus(), 200);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function confirm() {
    if (!manualDate) {
      toast.error("Sélectionnez la date de votre rendez-vous.");
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
        className="rounded-3xl border border-[oklch(0.65_0.17_155)]/40 bg-[oklch(0.65_0.17_155)]/[0.06] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[oklch(0.65_0.17_155)]/15 text-[oklch(0.45_0.17_155)]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setRescheduling(true);
                setManualDate(booking.date);
                setManualTime(booking.time ?? "10:00");
                toast.info("Choisissez un nouveau créneau ci-dessous.");
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Reprogrammer
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl text-destructive hover:text-destructive"
              onClick={() => {
                clearBooking();
                setRescheduling(false);
                toast.info("Rendez-vous annulé. Les pages suivantes sont à nouveau verrouillées.");
              }}
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
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
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

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <iframe
          src={CALENDLY_URL}
          title="Prise de rendez-vous Calendly"
          className="h-[680px] w-full"
          loading="lazy"
          frameBorder={0}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {awaitingConfirm ? "Confirmez votre rendez-vous" : "Vous avez déjà réservé ?"}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Renseignez la date choisie pour débloquer automatiquement la suite du
          parcours le jour J.
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
              className="mt-1 h-11 rounded-xl"
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
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={confirm} className="h-11 w-full rounded-xl sm:w-auto">
              Confirmer le RDV
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}