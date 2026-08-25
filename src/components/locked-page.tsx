import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, CalendarCheck2, ArrowRight, CalendarPlus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking, formatBookingDate } from "@/lib/booking-store";

function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;
  const diff = Math.max(0, target - now);
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days} j ${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  return `${seconds} s`;
}

export function LockedPage({
  title,
  description,
  step,
  meetingAt,
  unlockAt,
  unlockNote,
}: {
  title: string;
  description?: string;
  /** Nom de l'étape verrouillée, affiché dans le message (ex: "Démonstration"). */
  step?: string;
  /** meeting_at (ISO) du RDV confirmé : affiché comme date du rendez-vous. */
  meetingAt?: string | null;
  /** Instant exact de déverrouillage (ISO) : base du compte à rebours. */
  unlockAt?: string | null;
  /** Note affichée sous le compte à rebours. */
  unlockNote?: string;
}) {
  const { booking, isPendingMeeting } = useBooking();
  const countdown = useCountdown(unlockAt ?? meetingAt ?? null);

  const meetingLabel = (() => {
    if (meetingAt) {
      const d = new Date(meetingAt);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d);
      }
    }
    if (booking) {
      return `${formatBookingDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`;
    }
    return null;
  })();

  const hasMeeting = Boolean(meetingAt) || (isPendingMeeting && !!booking);

  return (
    <section
      role="region"
      aria-labelledby="locked-title"
      aria-live="polite"
      className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)] sm:p-12"
    >
      <span
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-foreground/70"
        aria-hidden="true"
      >
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      {step && (
        <div className="mt-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Étape verrouillée · {step}
        </div>
      )}
      <h1
        id="locked-title"
        className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ??
          (isPendingMeeting
            ? "Cette page se débloquera automatiquement le jour de votre rendez-vous avec l'équipe Lucie."
            : "Réservez d'abord un créneau avec l'équipe Lucie pour débloquer cette étape.")}
      </p>

      {isPendingMeeting && booking ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-primary/30 bg-primary/[0.05] p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-primary">
              <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              Rendez-vous confirmé
            </div>
            {daysLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {daysLabel}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {formatBookingDate(booking.date)}
            {booking.time ? ` · ${booking.time}` : ""}
          </div>
          {countdown && (
            <div className="mt-2 font-mono text-sm tabular-nums text-foreground">
              Dans {countdown}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {unlockNote ??
              (step
                ? `Revenez ce jour-là pour débloquer "${step}" et poursuivre le parcours.`
                : "Revenez ce jour-là pour débloquer la suite du parcours.")}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-left">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Aucun rendez-vous détecté
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Réservez un créneau dans l’agenda depuis la page Recommandation pour
            débloquer automatiquement la suite.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild className="min-h-11 rounded-xl">
          <Link
            to="/recommandation"
            hash="rdv"
            aria-label={
              isPendingMeeting
                ? "Revoir mon rendez-vous sur la page Recommandation"
                : "Ouvrir l’agenda pour réserver un rendez-vous"
            }
          >
            <CalendarCheck2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {isPendingMeeting ? "Reprogrammer mon rendez-vous" : "Réserver un créneau dans l’agenda"}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link to="/diagnostic">Revenir au diagnostic</Link>
        </Button>
      </div>
    </section>
  );
}