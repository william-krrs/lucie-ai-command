import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getClientRef } from "@/lib/booking-store";
import { JOURNEY_QUERY_KEY } from "@/lib/journey-access";
import {
  adminCleanupTestBookings,
  adminGetOverview,
  adminListBookings,
  adminPrepareBeforeStripe,
  adminResetJourney,
  adminSetInstallationStatus,
  type AdminInstallationStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Test Center — Lucie" },
      {
        name: "description",
        content:
          "Console interne de préparation et de réinitialisation des états de test du parcours Lucie.",
      },
      { property: "og:title", content: "Admin Test Center — Lucie" },
      {
        property: "og:description",
        content: "Console interne réservée à l'équipe Lucie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const INSTALL_STATUSES: AdminInstallationStatus[] = [
  "not_started",
  "in_progress",
  "ready_for_test",
  "live",
];

const ADMIN_QUERY_KEY = ["admin-overview"] as const;
const ADMIN_BOOKINGS_KEY = ["admin-bookings"] as const;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs break-all sm:text-sm">{value ?? "—"}</span>
    </div>
  );
}

function AdminPage() {
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [clientRef, setClientRef] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setClientRef(getClientRef());
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setAuthed(!!session),
    );
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchOverview = useServerFn(adminGetOverview);
  const fetchBookings = useServerFn(adminListBookings);
  const prepare = useServerFn(adminPrepareBeforeStripe);
  const reset = useServerFn(adminResetJourney);
  const setInstall = useServerFn(adminSetInstallationStatus);
  const cleanup = useServerFn(adminCleanupTestBookings);

  const overview = useQuery({
    queryKey: ADMIN_QUERY_KEY,
    queryFn: () => fetchOverview(),
    enabled: authed,
  });
  const isAdmin = overview.data?.isAdmin === true;

  const bookings = useQuery({
    queryKey: ADMIN_BOOKINGS_KEY,
    queryFn: () => fetchBookings(),
    enabled: authed && isAdmin,
  });

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ADMIN_BOOKINGS_KEY }),
      queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY }),
    ]);
  }

  async function run(id: string, fn: () => Promise<unknown>, okMessage: string) {
    setBusy(id);
    try {
      await fn();
      await refreshAll();
      toast.success(okMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action impossible.";
      toast.error(message === "Forbidden" ? "Accès refusé." : message);
    } finally {
      setBusy(null);
    }
  }

  if (!authed || overview.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Interne" title="Admin Test Center" description="Chargement…" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Interne"
          title="Accès refusé"
          description="Ce compte ne possède pas le rôle administrateur. L'autorisation est vérifiée côté serveur."
        />
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm space-y-3">
          <p className="text-muted-foreground">Identifiant de la session actuelle :</p>
          <code className="block break-all font-mono text-xs">{overview.data?.userId ?? "inconnu"}</code>
          <Button variant="outline" onClick={() => void navigate({ to: "/admin/login" })}>
            Se connecter avec un compte administrateur
          </Button>
        </div>
      </div>
    );
  }



  const state = overview.data?.journeyState ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Interne · réservé admin"
        title="Admin Test Center"
        description="Préparez ou réinitialisez les états de test du parcours. Aucune action ne peut valider un paiement : Stripe reste la seule autorité via son webhook."
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void refreshAll()}>
          Recharger l'état
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Identité</h2>
          <Row label="user_id" value={overview.data?.userId} />
          <Row label="email" value={overview.data?.email ?? "—"} />
          <Row label="client_ref (local)" value={clientRef || "—"} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">journey_state</h2>
          {state ? (
            <>
              <Row label="demo_completed_at" value={state.demoCompletedAt ?? "—"} />
              <Row
                label="payment_status"
                value={<Badge variant="secondary">{state.paymentStatus}</Badge>}
              />
              <Row label="paid_at" value={state.paidAt ?? "—"} />
              <Row label="paid_plan" value={state.paidPlan ?? "—"} />
              <Row label="stripe_session_id" value={state.stripeSessionId ?? "—"} />
              <Row
                label="installation_status"
                value={<Badge variant="secondary">{state.installationStatus}</Badge>}
              />
              <Row label="updated_at" value={state.updatedAt ?? "—"} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune ligne journey_state pour ce compte.
            </p>
          )}
          <Row
            label="configuration soumise"
            value={overview.data?.configurationSubmitted ? "oui" : "non"}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold">Actions de test</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ces actions ne portent que sur votre propre compte et n'écrivent jamais un paiement payé.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy !== null}
            onClick={() =>
              void run("prepare", () => prepare(), "Tunnel préparé avant Stripe (unpaid).")
            }
          >
            Préparer avant Stripe
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Remettre ce compte au début du parcours ?")) return;
              void run("reset", () => reset(), "Parcours réinitialisé.");
            }}
          >
            Remettre au début
          </Button>
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Supprimer vos rendez-vous et corrélations de test ?")) return;
              void run(
                "cleanup",
                () => cleanup(),
                "Rendez-vous et corrélations de test supprimés.",
              );
            }}
          >
            Nettoyer bookings / corrélations
          </Button>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">installation_status</h3>
          <div className="flex flex-wrap gap-2">
            {INSTALL_STATUSES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={state?.installationStatus === status ? "default" : "outline"}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    `install-${status}`,
                    () => setInstall({ data: { status } }),
                    `installation_status = ${status}`,
                  )
                }
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Derniers rendez-vous (R2 / setup test)</h2>
        {bookings.data && bookings.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">meeting_at (UTC)</th>
                  <th className="py-2 pr-4">Heure locale</th>
                  <th className="py-2 pr-4">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {bookings.data.map((b) => (
                  <tr key={b.id} className="border-t border-border/50">
                    <td className="py-2 pr-4">{b.bookingType}</td>
                    <td className="py-2 pr-4">{b.statusNorm}</td>
                    <td className="py-2 pr-4 font-mono">{b.meetingAt ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {b.meetingTime ?? "—"} ({b.timezone})
                    </td>
                    <td className="py-2 pr-4 font-mono">{b.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun rendez-vous de test.</p>
        )}
      </Card>
    </div>
  );
}
