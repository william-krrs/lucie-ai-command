import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CloudDownload, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  formatBookingDate,
  getClientRef,
  useBooking,
  type Booking,
} from "@/lib/booking-store";
import {
  getBookingByRef,
  upsertBooking,
  type ServerBooking,
} from "@/lib/bookings.functions";

/**
 * Réconcilie la progression locale (localStorage) avec la progression
 * serveur (table bookings) au chargement de l'app.
 *
 * Stratégie :
 *  - Aucun côté : rien à faire.
 *  - Local uniquement : on pousse le local vers le serveur.
 *  - Serveur uniquement : on adopte le serveur en local.
 *  - Les deux identiques (même date + heure + statut) : rien à faire.
 *  - Les deux divergent :
 *      • Un côté est annulé : on adopte l'état non annulé le plus récent
 *        automatiquement (comportement attendu quand le prospect a annulé
 *        depuis l’agenda de réservation).
 *      • Sinon on ouvre une boîte de dialogue de résolution manuelle.
 */
export function BookingSync() {
  const { booking, setBooking, clearBooking } = useBooking();
  const getServer = useServerFn(getBookingByRef);
  const upsert = useServerFn(upsertBooking);

  const [conflict, setConflict] = useState<{
    local: Booking;
    server: ServerBooking;
  } | null>(null);
  const [applying, setApplying] = useState<"local" | "server" | null>(null);

  // Un seul check par montage — la source de vérité reste ensuite locale
  // (upsertBooking pousse toute nouvelle modification).
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    let syncing = false;

    const syncBooking = async () => {
      if (cancelled || checkedRef.current || syncing) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const clientRef = getClientRef();
      if (!clientRef) return;
      syncing = true;
      checkedRef.current = true;

      try {
        const { booking: server } = await getServer({ data: { clientRef } });
        if (cancelled) return;

        // Aucun serveur : pousser le local si présent.
        if (!server) {
          if (booking && booking.status !== "cancelled" && booking.user?.email) {
            await pushLocal(booking);
          }
          return;
        }

        // Aucun local : adopter le serveur (sauf s'il est annulé).
        if (!booking) {
          if (server.status !== "cancelled") adoptServer(server);
          return;
        }

        // Comparaison.
        const same =
          booking.date === server.meetingDate &&
          (booking.time ?? null) === (server.meetingTime ?? null) &&
          (booking.status === "cancelled") === (server.status === "cancelled");
        if (same) return;

        const localCancelled = booking.status === "cancelled";
        const serverCancelled = server.status === "cancelled";

        // Un seul côté annulé → on prend l'autre automatiquement.
        if (localCancelled && !serverCancelled) {
          const localTime = Date.parse(booking.updatedAt);
          const serverTime = Date.parse(server.updatedAt);
          if (Number.isFinite(serverTime) && serverTime >= localTime) {
            adoptServer(server);
            toast.info("Un RDV actif a été retrouvé sur le serveur — restauré.");
          }
          return;
        }
        if (serverCancelled && !localCancelled) {
          const localTime = Date.parse(booking.updatedAt);
          const serverTime = Date.parse(server.updatedAt);
          if (Number.isFinite(localTime) && localTime >= serverTime) {
            await pushLocal(booking);
          } else {
            clearBooking();
            toast.info("Le RDV a été annulé côté serveur — synchronisé.");
          }
          return;
        }

        // Deux dates/horaires différents non annulés → résolution manuelle.
        setConflict({ local: booking, server });
      } catch (e) {
        console.warn("[booking-sync] check failed", e);
      } finally {
        syncing = false;
      }
    };

    void syncBooking();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void syncBooking();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function adoptServer(server: ServerBooking) {
    setBooking({
      date: server.meetingDate,
      time: server.meetingTime ?? undefined,
      inviteeName: server.name ?? undefined,
      user: server.email
        ? { name: server.name ?? undefined, email: server.email }
        : undefined,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      status: server.status === "cancelled" ? "cancelled" : undefined,
    });
  }

  async function pushLocal(local: Booking) {
    const email = local.user?.email;
    if (!email) return;
    const meetingAt = new Date(`${local.date}T${local.time ?? "10:00"}:00`).toISOString();
    await upsert({
      data: {
        clientRef: getClientRef(),
        email,
        name: local.user?.name,
        meetingDate: local.date,
        meetingTime: local.time,
        meetingAt,
      },
    });
  }

  async function resolve(choice: "local" | "server") {
    if (!conflict) return;
    setApplying(choice);
    try {
      if (choice === "local") {
        await pushLocal(conflict.local);
        toast.success("Version locale conservée et resynchronisée.");
      } else {
        adoptServer(conflict.server);
        toast.success("Version serveur adoptée sur cet appareil.");
      }
      setConflict(null);
    } catch (e) {
      console.error("[booking-sync] resolve failed", e);
      toast.error("La synchronisation a échoué. Réessayez.");
    } finally {
      setApplying(null);
    }
  }

  if (!conflict) return null;

  const localLabel = `${formatBookingDate(conflict.local.date)}${
    conflict.local.time ? ` · ${conflict.local.time}` : ""
  }`;
  const serverLabel = `${formatBookingDate(conflict.server.meetingDate)}${
    conflict.server.meetingTime ? ` · ${conflict.server.meetingTime}` : ""
  }`;

  return (
    <Dialog open onOpenChange={(o) => !o && !applying && setConflict(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Conflit de rendez-vous détecté</DialogTitle>
          <DialogDescription>
            Cet appareil et notre serveur n'ont pas la même information sur votre
            rendez-vous. Choisissez la version à conserver.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={HardDrive}
            label="Cet appareil"
            date={localLabel}
            meta={`Modifié ${new Date(conflict.local.updatedAt).toLocaleString("fr-FR")}`}
            onClick={() => resolve("local")}
            disabled={!!applying}
            loading={applying === "local"}
          />
          <ChoiceCard
            icon={CloudDownload}
            label="Serveur"
            date={serverLabel}
            meta={`Modifié ${new Date(conflict.server.updatedAt).toLocaleString("fr-FR")}`}
            onClick={() => resolve("server")}
            disabled={!!applying}
            loading={applying === "server"}
            recommended
          />
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Astuce : le serveur est mis à jour par l’agenda de réservation et par vos autres
          appareils. Choisissez « Serveur » sauf si vous venez de modifier le
          RDV sur cet appareil sans connexion.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceCard({
  icon: Icon,
  label,
  date,
  meta,
  onClick,
  disabled,
  loading,
  recommended,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  date: string;
  meta: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60 " +
        (recommended
          ? "border-primary/40 bg-primary/[0.04] hover:bg-primary/[0.08]"
          : "border-border bg-card hover:bg-muted/50")
      }
    >
      <div className="flex w-full items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
        {recommended ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary">
            Recommandé
          </span>
        ) : null}
      </div>
      <div className="text-sm font-semibold text-foreground">{date}</div>
      <div className="text-xs text-muted-foreground">{meta}</div>
      <div className="mt-auto pt-2">
        <Button
          asChild={false}
          variant={recommended ? "default" : "outline"}
          size="sm"
          className="pointer-events-none rounded-lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Synchronisation…
            </>
          ) : (
            "Conserver cette version"
          )}
        </Button>
      </div>
    </button>
  );
}