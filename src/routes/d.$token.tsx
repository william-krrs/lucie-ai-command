import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, Download, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeCard } from "@/components/qr-code";
import { getSharedDiagnostic, type DiagnosticSnapshot } from "@/lib/share.functions";
import { PLAN_LABELS, PRIORITY_LABELS, TIER_LABELS } from "@/lib/recommendation";

export const Route = createFileRoute("/d/$token")({
  head: () => ({
    meta: [
      { title: "Diagnostic partagé — Lucie" },
      { name: "description", content: "Consultez le diagnostic Lucie partagé et téléchargez-le en PDF." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params }) => {
    const res = await getSharedDiagnostic({ data: { token: params.token } });
    if (!res.found) throw notFound();
    return res;
  },
  errorComponent: () => <StateScreen title="Lien invalide" body="Ce lien ne peut pas être ouvert." />,
  notFoundComponent: () => (
    <StateScreen
      title="Diagnostic introuvable"
      body="Ce lien a expiré ou n'existe plus. Demandez un nouveau lien de partage."
    />
  ),
  component: SharedDiagnosticPage,
});

function fmtEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}

function SharedDiagnosticPage() {
  const data = Route.useLoaderData();
  const [shareUrl, setShareUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  if (!data.found) return null;
  const snap = data.snapshot;

  const handleExport = async () => {
    if (!ref.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const iw = pw - margin * 2;
      const ih = (canvas.height * iw) / canvas.width;
      let left = ih;
      let pos = margin;
      pdf.addImage(img, "PNG", margin, pos, iw, ih);
      left -= ph - margin * 2;
      while (left > 0) {
        pos = margin - (ih - left);
        pdf.addPage();
        pdf.addImage(img, "PNG", margin, pos, iw, ih);
        left -= ph - margin * 2;
      }
      const name = (snap.companyName || "prospect")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      pdf.save(`diagnostic-lucie-${name}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const expires = new Date(data.expiresAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Diagnostic Lucie partagé
          </div>
          <Button onClick={handleExport} disabled={exporting} className="rounded-xl">
            {exporting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Génération…
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-4 w-4" /> Télécharger en PDF
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Lien privé — accessible jusqu'au {expires}.
        </div>

        <div ref={ref} className="space-y-6 rounded-3xl bg-background p-6 sm:p-8">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
              Diagnostic Lucie
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {snap.companyName || "Entreprise"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {snap.activity || "Secteur non renseigné"}
              {snap.city ? ` · ${snap.city}` : ""}
              {snap.employees ? ` · ${snap.employees} collaborateurs` : ""}
            </p>
          </div>

          <ScoreBlock snap={snap} />

          {snap.booking && <BookingBlock booking={snap.booking} />}

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Appels reçus / mois" value={snap.metrics.monthlyReceived.toLocaleString("fr-FR")} />
            <Kpi label="Appels manqués / mois" value={snap.metrics.monthlyMissed.toLocaleString("fr-FR")} />
            <Kpi label="CA potentiel perdu / mois" value={fmtEUR(snap.metrics.monthlyLostRevenue)} />
            <Kpi label="Opportunités récupérables" value={snap.metrics.recoverableOpportunities.toLocaleString("fr-FR")} />
            <Kpi label="Temps équipe économisé" value={`${snap.metrics.timeSavedHours} h`} />
            <Kpi label="ROI mensuel estimé" value={fmtEUR(snap.recommendation.estimatedMonthlyRoi)} emphasize />
          </div>

          {snap.recommendation.justifications.length > 0 && (
            <ListBlock title="Pourquoi cette recommandation ?" items={snap.recommendation.justifications} />
          )}
          {snap.recommendation.concerns.length > 0 && (
            <ListBlock title="Points de vigilance" items={snap.recommendation.concerns} muted />
          )}

          <p className="text-[11px] text-muted-foreground">
            Diagnostic généré par Lucie Assistant — lucieassistant.fr · Estimation prudente
            fondée sur les données déclarées.
          </p>
        </div>

        {shareUrl && (
          <QrCodeCard
            url={shareUrl}
            label={`QR code du diagnostic de ${snap.companyName || "Lucie"}`}
            companyName={snap.companyName || "diagnostic"}
          />
        )}
      </main>
    </div>
  );
}

function ScoreBlock({ snap }: { snap: DiagnosticSnapshot }) {
  const { recommendation: r } = snap;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Compatibilité Lucie
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {TIER_LABELS[r.tier]} · {PRIORITY_LABELS[r.priority]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Score</div>
          <div className="text-3xl font-semibold tabular-nums text-foreground">
            {r.score}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, r.score)}%` }} />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-background p-3 text-sm text-foreground/85">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          <strong>Formule recommandée : {r.plan ? PLAN_LABELS[r.plan] : "Aucune"}.</strong>{" "}
          {r.planReason}
        </span>
      </div>
    </div>
  );
}

function Kpi({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 min-w-0">
      <div className="kpi-label truncate">{label}</div>
      <div className={`mt-2 kpi-value-md break-words ${emphasize ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function ListBlock({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li
            key={it}
            className={`text-sm ${muted ? "text-muted-foreground" : "text-foreground/85"}`}
          >
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingBlock({
  booking,
}: {
  booking: NonNullable<DiagnosticSnapshot["booking"]>;
}) {
  const dateLabel = (() => {
    const d = new Date(`${booking.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return booking.date;
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  })();
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-primary">
        <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        Rendez-vous confirmé
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">
        {dateLabel}
        {booking.time ? ` · ${booking.time}` : ""}
      </div>
      {booking.inviteeName && (
        <div className="mt-1 text-sm text-muted-foreground">
          Avec {booking.inviteeName}
        </div>
      )}
    </div>
  );
}

function StateScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-6">
      <div className="max-w-md rounded-3xl border border-border bg-background p-8 text-center shadow-[var(--shadow-card)]">
        <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}