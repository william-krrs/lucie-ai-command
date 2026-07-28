import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import {
  getSharedDiagnostic,
  sendSharedDiagnosticEmail,
  type DiagnosticSnapshot,
} from "@/lib/share.functions";
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
  const [exporting, setExporting] = useState(false);
  const [email, setEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sendState, setSendState] = useState<
    | { status: "idle" }
    | { status: "sending"; attempts: number; startedAt: number }
    | { status: "sent"; to: string; messageId?: string; attempts: number; at: number }
    | { status: "error"; message: string; attempts: number; at: number }
  >({ status: "idle" });
  const sendEmail = useServerFn(sendSharedDiagnosticEmail);

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  if (!data.found) return null;
  const snap = data.snapshot;
  const token = Route.useParams().token;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;
      let y = margin;

      const BRAND: Record<string, [number, number, number]> = {
        ink: [20, 20, 30],
        primary: [109, 40, 217],
        accent: [225, 29, 116],
        body: [55, 55, 70],
        muted: [130, 130, 145],
        line: [220, 215, 235],
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
      // jsPDF's Helvetica core font mishandles U+00A0 / U+202F (used by
      // Intl.NumberFormat fr-FR as thousands and currency separators) when
      // combined with align:"right". Normalize to ASCII spaces so numbers
      // like "5 144 €" no longer render as "5 / 1 4 4  €".
      const sanitize = (t: string) =>
        (t || "").replace(/[\u00A0\u202F\u2007]/g, " ");
      const writeText = (
        text: string,
        opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {},
      ) => {
        const size = opts.size ?? 10;
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...(opts.color ?? BRAND.body));
        const lines = doc.splitTextToSize(sanitize(text) || "—", pageW - margin * 2) as string[];
        for (const line of lines) {
          ensureSpace(size + 4);
          doc.text(line, margin, y);
          y += size + 4;
        }
        y += opts.gap ?? 6;
      };

      // Header band
      doc.setFillColor(...BRAND.ink);
      doc.rect(0, 0, pageW, 120, "F");
      doc.setFillColor(...BRAND.primary);
      doc.rect(0, 116, pageW, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DIAGNOSTIC LUCIE", margin, 46);
      doc.setFontSize(22);
      doc.text(snap.companyName || "Entreprise", margin, 78);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(210, 200, 240);
      doc.text(
        [snap.activity, snap.city, snap.employees ? `${snap.employees} collaborateurs` : null]
          .filter(Boolean)
          .join(" · "),
        margin,
        98,
      );
      y = 150;

      // Score block
      const r = snap.recommendation;
      const tierKey = r.tier as keyof typeof TIER_LABELS;
      const priorityKey = r.priority as keyof typeof PRIORITY_LABELS;
      const planKey = r.plan as keyof typeof PLAN_LABELS | null | undefined;
      writeText("Score de compatibilité Lucie", { size: 9, bold: true, color: BRAND.muted, gap: 2 });
      writeText(
        `${r.score} / 100 · ${TIER_LABELS[tierKey] ?? tierKey} · Priorité ${PRIORITY_LABELS[priorityKey] ?? priorityKey}`,
        { size: 16, bold: true, color: BRAND.ink, gap: 10 },
      );
      writeText(
        `Formule recommandée : ${planKey ? PLAN_LABELS[planKey] ?? planKey : "Aucune"}. ${r.planReason}`,
        { size: 10, color: BRAND.body, gap: 12 },
      );

      // KPIs
      writeText("Indicateurs clés", { size: 9, bold: true, color: BRAND.muted, gap: 2 });
      const kpis: [string, string][] = [
        ["Appels reçus / mois", snap.metrics.monthlyReceived.toLocaleString("fr-FR")],
        ["Appels manqués / mois", snap.metrics.monthlyMissed.toLocaleString("fr-FR")],
        ["CA potentiel perdu / mois", fmtEUR(snap.metrics.monthlyLostRevenue)],
        ["Opportunités récupérables", snap.metrics.recoverableOpportunities.toLocaleString("fr-FR")],
        ["Temps équipe économisé", `${snap.metrics.timeSavedHours} h`],
        ["ROI mensuel estimé", fmtEUR(r.estimatedMonthlyRoi)],
      ];
      for (const [k, v] of kpis) {
        ensureSpace(20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.muted);
        doc.text(sanitize(k), margin, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...BRAND.ink);
        doc.text(sanitize(v), pageW - margin, y, { align: "right" });
        y += 16;
        doc.setDrawColor(...BRAND.line);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 6;
      }
      y += 8;

      if (r.justifications.length) {
        writeText("Pourquoi cette recommandation ?", {
          size: 12,
          bold: true,
          color: BRAND.ink,
          gap: 4,
        });
        for (const j of r.justifications) writeText(`• ${j}`, { size: 10 });
        y += 4;
      }
      if (r.concerns.length) {
        writeText("Points de vigilance", {
          size: 12,
          bold: true,
          color: BRAND.ink,
          gap: 4,
        });
        for (const c of r.concerns) writeText(`• ${c}`, { size: 10, color: BRAND.muted });
      }

      if (snap.booking) {
        y += 10;
        writeText("Rendez-vous confirmé", {
          size: 12,
          bold: true,
          color: BRAND.primary,
          gap: 2,
        });
        writeText(
          `${snap.booking.date}${snap.booking.time ? " · " + snap.booking.time : ""}${
            snap.booking.inviteeName ? " · " + snap.booking.inviteeName : ""
          }`,
          { size: 10 },
        );
      }

      // Footer on every page
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(...BRAND.line);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.primary);
        doc.text("LUCIE ASSISTANT", margin, pageH - 20);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...BRAND.muted);
        doc.text(
          "Estimation prudente fondée sur les données déclarées.",
          margin + 90,
          pageH - 20,
        );
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND.ink);
        doc.text(`${i} / ${total}`, pageW - margin, pageH - 20, { align: "right" });
      }

      const name = (snap.companyName || "prospect")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      doc.save(`diagnostic-lucie-${name || "prospect"}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const resendEmail = async (targetEmail?: string) => {
    const trimmed = (targetEmail ?? email).trim();
    const prevAttempts = sendState.status === "idle" ? 0 : sendState.attempts;
    const attempts = prevAttempts + 1;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSendState({
        status: "error",
        message: "Adresse email invalide.",
        attempts,
        at: Date.now(),
      });
      return;
    }
    if (!shareUrl) return;
    setSendState({ status: "sending", attempts, startedAt: Date.now() });
    try {
      const res = await sendEmail({
        data: {
          token,
          email: trimmed,
          shareUrl,
          senderName: senderName.trim() || null,
        },
      });
      setSendState({
        status: "sent",
        to: trimmed,
        messageId: res.messageId,
        attempts,
        at: Date.now(),
      });
    } catch (err) {
      setSendState({
        status: "error",
        message: err instanceof Error ? err.message : "Envoi impossible.",
        attempts,
        at: Date.now(),
      });
    }
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    void resendEmail();
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

        <div className="space-y-6 rounded-3xl bg-background p-6 sm:p-8">
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

        <form
          onSubmit={handleSendEmail}
          className="mt-6 rounded-3xl border border-border bg-background p-6 sm:p-8"
          aria-labelledby="share-email-title"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="share-email-title"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Envoyer ce diagnostic par email
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Envoyez le lien privé à un associé, un décideur ou en test à
                vous-même. Le lien reste valable jusqu'au {expires}.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                De la part de (facultatif)
              </span>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value.slice(0, 120))}
                placeholder="Votre nom"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                disabled={sendState.status === "sending"}
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">
                Email du destinataire
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 200))}
                placeholder="prenom@entreprise.fr"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                disabled={sendState.status === "sending"}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={sendState.status === "sending" || !shareUrl}
              className="rounded-xl"
            >
              {sendState.status === "sending" ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> Envoi…
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" aria-hidden="true" /> Envoyer le lien
                </>
              )}
            </Button>
            {sendState.status === "sent" && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Envoyé à {sendState.to}
              </span>
            )}
            {sendState.status === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-medium">L'envoi n'a pas pu aboutir</p>
                    <p className="mt-0.5 text-destructive/90">{sendState.message}</p>
                    <button
                      type="button"
                      onClick={() => void resendEmail()}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                    >
                      <Send className="h-3 w-3" aria-hidden="true" />
                      Renvoyer l'e-mail
                    </button>
                  </div>
                </div>
              </div>
            )}
            {sendState.status !== "idle" && (
              <div
                role="status"
                aria-live="polite"
                className={
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium " +
                  (sendState.status === "sent"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : sendState.status === "sending"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-600"
                      : "border-destructive/40 bg-destructive/10 text-destructive")
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (sendState.status === "sent"
                      ? "bg-primary"
                      : sendState.status === "sending"
                        ? "animate-pulse bg-amber-500"
                        : "bg-destructive")
                  }
                />
                {sendState.status === "sending"
                  ? `En attente d'envoi… (tentative ${sendState.attempts})`
                  : sendState.status === "sent"
                    ? `Envoyé · ${new Date(sendState.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}${sendState.attempts > 1 ? ` · ${sendState.attempts} tentatives` : ""}`
                    : `Erreur · ${new Date(sendState.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${sendState.attempts} tentative${sendState.attempts > 1 ? "s" : ""}`}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Astuce : entrez votre propre email pour recevoir un envoi test avant
            de le transférer à votre associé.
          </p>
        </form>
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
          <div className="kpi-value-xl text-foreground">
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