import { Link } from "@tanstack/react-router";
import { Lock, CalendarCheck2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking, formatBookingDate } from "@/lib/booking-store";

export function LockedPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { booking, isPendingMeeting } = useBooking();

  return (
    <section
      aria-labelledby="locked-title"
      className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)] sm:p-12"
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-foreground/70">
        <Lock className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1
        id="locked-title"
        className="mt-5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ??
          "Cette page se débloquera automatiquement le jour de votre rendez-vous avec l'équipe Lucie."}
      </p>

      {isPendingMeeting && booking ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-primary/30 bg-primary/[0.05] p-4 text-left">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-primary">
            <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
            Rendez-vous confirmé
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {formatBookingDate(booking.date)}
            {booking.time ? ` · ${booking.time}` : ""}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Revenez ce jour-là pour choisir votre formule et finaliser le lancement.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Aucun rendez-vous détecté pour l'instant.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-xl">
          <Link to="/recommandation">
            {isPendingMeeting ? "Revoir mon rendez-vous" : "Prendre rendez-vous"}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/diagnostic">Revenir au diagnostic</Link>
        </Button>
      </div>
    </section>
  );
}