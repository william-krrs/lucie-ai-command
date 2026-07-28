import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Send,
  Loader2,
  Mail,
  Database,
  RotateCcw,
  History,
  FileDown,
  CalendarCheck2,
  Save,
  CloudUpload,
  Eye,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { submitPreparation } from "@/lib/preparation.functions";
import { upsertBooking } from "@/lib/bookings.functions";
import { sendPreparationPdf } from "@/lib/preparation-email.functions";
import {
  listPreparationDrafts,
  savePreparationDraft,
  clearPreparationDrafts,
} from "@/lib/preparation-drafts.functions";
import { useRecommendation } from "@/lib/lucie-store";
import { useBooking, formatBookingDate, getClientRef, type Booking } from "@/lib/booking-store";
import { useUniqueModule, MODULE_IDS } from "@/lib/module-registry";
import {
  PLAN_LABELS as REC_PLAN_LABELS,
  PRIORITY_EMOJI,
  PRIORITY_LABELS,
  TIER_LABELS,
} from "@/lib/recommendation";
import { CONTACT_EMAIL as CONFIG_CONTACT_EMAIL } from "@/lib/config";

const CONTACT_EMAIL = CONFIG_CONTACT_EMAIL;
const STORAGE_KEY = "lucie:preparation";
const HISTORY_KEY = "lucie:preparation:history";
const HISTORY_LIMIT = 20;
// Espacement mini entre deux snapshots pour éviter de saturer l'historique
// pendant la frappe (une entrée toutes les ~15s max).
const HISTORY_MIN_INTERVAL_MS = 15_000;

type HistorySnapshot = {
  at: string;
  form: FormState;
  plan: string | null;
  filled: number;
  remote?: boolean;
};

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const PLAN_LABELS: Record<string, string> = {
  essential: "Lucie Essential",
  pro: "Lucie Pro",
  premium: "Lucie Premium",
};

type FormState = {
  contactName: string;
  contactEmail: string;
  companyName: string;
  companyPhone: string;
  website: string;
  callVolume: string;
  interlocutor: string;
  greeting: string;
  location: string;
  tone: "formel" | "chaleureux" | "decontracte" | "";
  services: string;
  emergencyNumber: string;
  emergencyCriteria: string;
  openingHours: string;
  rdvLink: string;
  requiredInfo: string;
  techAccess: string;
  extra: string;
};

const EMPTY: FormState = {
  contactName: "",
  contactEmail: "",
  companyName: "",
  companyPhone: "",
  website: "",
  callVolume: "",
  interlocutor: "",
  greeting: "",
  location: "",
  tone: "",
  services: "",
  emergencyNumber: "",
  emergencyCriteria: "",
  openingHours: "",
  rdvLink: "",
  requiredInfo: "",
  techAccess: "",
  extra: "",
};

export function PreparationForm({
  plan,
  intro = true,
}: {
  plan?: "essential" | "pro" | "premium";
  intro?: boolean;
}) {
  useUniqueModule(MODULE_IDS.preparationForm);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    emailStatus: "sent" | "skipped" | "failed";
  } | null>(null);
  const [resumed, setResumed] = useState<{
    at: string;
    submissionId?: string;
    restoredCount: number;
    sections: { label: string; filled: number; total: number }[];
    toast?: boolean;
  } | null>(null);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "pending" | "saved" | "error";
    at: string | null;
  }>({ status: "idle", at: null });
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<HistorySnapshot | null>(
    null,
  );
  const hydrated = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const submit = useServerFn(submitPreparation);
  const fetchRemoteDrafts = useServerFn(listPreparationDrafts);
  const pushRemoteDraft = useServerFn(savePreparationDraft);
  const clearRemoteDrafts = useServerFn(clearPreparationDrafts);
  const rec = useRecommendation();
  const { booking, updateBooking } = useBooking();

  // Regroupement des champs par section — utilisé pour l'aperçu de reprise.
  const SECTIONS: { label: string; keys: (keyof FormState)[] }[] = useMemo(
    () => [
      {
        label: "Informations générales",
        keys: [
          "contactName",
          "contactEmail",
          "companyName",
          "companyPhone",
          "website",
          "callVolume",
          "interlocutor",
        ],
      },
      { label: "Accueil vocal", keys: ["greeting", "location", "tone"] },
      { label: "Expertise et services", keys: ["services"] },
      {
        label: "Appels et urgences",
        keys: ["emergencyNumber", "emergencyCriteria", "openingHours"],
      },
      { label: "Prise de RDV", keys: ["rdvLink", "requiredInfo"] },
      { label: "Accès technique", keys: ["techAccess"] },
      { label: "Notes complémentaires", keys: ["extra"] },
    ],
    [],
  );

  // Auto-hydrate from localStorage if the prospect comes back later.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<FormState> & {
        plan?: string | null;
        sentAt?: string;
        submissionId?: string;
        updatedAt?: string;
      };
      // Only prefill when it matches the current plan (or when no plan filter applies).
      if (plan && saved.plan && saved.plan !== plan) return;
      const next: FormState = { ...EMPTY };
      let restoredCount = 0;
      (Object.keys(EMPTY) as (keyof FormState)[]).forEach((k) => {
        const v = saved[k];
        if (typeof v === "string" && v.length > 0) {
          (next[k] as string) = v;
          restoredCount += 1;
        }
      });
      if (restoredCount === 0) return;
      setForm(next);
      const sections = SECTIONS.map((s) => ({
        label: s.label,
        total: s.keys.length,
        filled: s.keys.filter((k) => String(next[k]).trim().length > 0).length,
      }));
      setResumed({
        at: saved.updatedAt ?? saved.sentAt ?? "",
        submissionId: saved.submissionId,
        restoredCount,
        sections,
      });
      if (saved.updatedAt) {
        setSaveState({ status: "saved", at: saved.updatedAt });
      }
      // Toast discret pour signaler la reprise après un refresh / reconnexion.
      toast.success(
        `Brouillon restauré · ${restoredCount} champ${restoredCount > 1 ? "s" : ""} récupéré${restoredCount > 1 ? "s" : ""}.`,
        { duration: 4000 },
      );
    } catch {
      /* ignore malformed storage */
    }
  }, [plan, SECTIONS]);

  // Historique des sauvegardes (horodaté) — hydraté au montage.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistorySnapshot[] | null;
        if (Array.isArray(parsed)) {
          const filtered = plan
            ? parsed.filter((s) => !s.plan || s.plan === plan)
            : parsed;
          setHistory(filtered.slice(0, HISTORY_LIMIT));
        }
      }
    } catch {
      /* ignore malformed history */
    }

    // Synchronisation cloud : on récupère les points de sauvegarde stockés côté
    // Supabase pour permettre la reprise depuis n'importe quel appareil.
    (async () => {
      try {
        const remote = await fetchRemoteDrafts();
        if (cancelled || !Array.isArray(remote)) return;
        setHistory((prev) => {
          const remoteSnaps: HistorySnapshot[] = remote
            .filter((r) => !plan || !r.plan || r.plan === plan)
            .map((r) => ({
              at: r.snapshotAt,
              form: { ...EMPTY, ...(r.form as Partial<FormState>) },
              plan: r.plan,
              filled: r.filled,
              remote: true,
            }));
          const seen = new Set<string>();
          const merged: HistorySnapshot[] = [];
          for (const s of [...remoteSnaps, ...prev]) {
            const key = s.at;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(s);
          }
          merged.sort((a, b) => (a.at < b.at ? 1 : -1));
          const capped = merged.slice(0, HISTORY_LIMIT);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
          } catch {
            /* ignore */
          }
          return capped;
        });
      } catch (err) {
        console.warn("[preparation] fetch remote drafts failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan]);

  // Sauvegarde incrémentale : à chaque frappe on planifie une écriture
  // localStorage debouncée (~600 ms). L'état d'enregistrement est exposé
  // dans une pastille visible en haut du formulaire pour rassurer le
  // prospect que ses réponses sont bien persistées avant tout rafraîchissement.
  useEffect(() => {
    if (!hydrated.current || submitted) return;
    const anyValue = Object.values(form).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    if (!anyValue) return;

    pendingRef.current = true;
    setSaveState((prev) => ({ status: "pending", at: prev.at }));

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const previous = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const at = new Date().toISOString();
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...previous,
            ...form,
            plan: plan ?? previous.plan ?? null,
            updatedAt: at,
          }),
        );
        pendingRef.current = false;
        setSaveState({ status: "saved", at });
        let pushSnapshot = false;
        // Historique : on empile un snapshot horodaté si le contenu a
        // changé et si le dernier point date d'au moins HISTORY_MIN_INTERVAL_MS.
        setHistory((prev) => {
          const filled = Object.values(form).filter(
            (v) => typeof v === "string" && v.trim().length > 0,
          ).length;
          const last = prev[0];
          if (last) {
            const sameContent =
              JSON.stringify(last.form) === JSON.stringify(form);
            if (sameContent) return prev;
            const dt = Date.parse(at) - Date.parse(last.at);
            if (Number.isFinite(dt) && dt < HISTORY_MIN_INTERVAL_MS) {
              // Remplace le dernier point (trop récent) plutôt que d'en ajouter un.
              const replaced = [
                { at, form: { ...form }, plan: plan ?? null, filled },
                ...prev.slice(1),
              ];
              try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(replaced));
              } catch {
                /* ignore */
              }
              pushSnapshot = true;
              return replaced;
            }
          }
          const next = [
            { at, form: { ...form }, plan: plan ?? null, filled },
            ...prev,
          ].slice(0, HISTORY_LIMIT);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          pushSnapshot = true;
          return next;
        });
        // Sync cloud : envoi fire-and-forget du snapshot pour la reprise multi-appareils.
        if (pushSnapshot) {
          const filled = Object.values(form).filter(
            (v) => typeof v === "string" && v.trim().length > 0,
          ).length;
          pushRemoteDraft({
            data: {
              plan: plan ?? null,
              form: { ...form } as Record<string, string>,
              filled,
              snapshotAt: at,
            },
          })
            .then((remote) => {
              // Marque le point comme synchronisé pour l'afficher côté UI.
              setHistory((prev) =>
                prev.map((s) => (s.at === remote.snapshotAt ? { ...s, remote: true } : s)),
              );
            })
            .catch((err) => {
              console.warn("[preparation] cloud sync failed", err);
            });
        }
      } catch {
        pendingRef.current = false;
        setSaveState({ status: "error", at: null });
      }
    }, 600);

    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [form, plan, submitted]);

  // Flush immédiat si la page se ferme pendant la fenêtre de debounce,
  // plus alerte native si une frappe très récente n'est pas encore persistée.
  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const previous = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...previous,
            ...form,
            plan: plan ?? previous.plan ?? null,
            updatedAt: new Date().toISOString(),
          }),
        );
        pendingRef.current = false;
      } catch {
        /* ignore */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [form, plan]);

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setForm(EMPTY);
    setResumed(null);
    setSaveState({ status: "idle", at: null });
    pendingRef.current = false;
    toast.success("Formulaire réinitialisé.");
  };

  const restoreSnapshot = (snapshot: HistorySnapshot) => {
    setForm({ ...EMPTY, ...snapshot.form });
    setResumed(null);
    setHistoryOpen(false);
    setConfirmRestore(null);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const previous = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...previous,
          ...snapshot.form,
          plan: plan ?? previous.plan ?? null,
          updatedAt: new Date().toISOString(),
          restoredFrom: snapshot.at,
        }),
      );
    } catch {
      /* ignore */
    }
    setSaveState({ status: "saved", at: new Date().toISOString() });
    toast.success(`Version du ${formatWhen(snapshot.at)} restaurée.`);
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    setHistory([]);
    clearRemoteDrafts({})
      .then(() => toast.success("Historique effacé (local + cloud)."))
      .catch((err) => {
        console.warn("[preparation] remote clear failed", err);
        toast.success("Historique local effacé (cloud non synchronisé).");
      });
  };

  const planLabel = plan ? PLAN_LABELS[plan] : "Non précisée";

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const requiredMissing = useMemo(() => {
    const req: (keyof FormState)[] = [
      "contactName",
      "contactEmail",
      "companyName",
      "companyPhone",
      "callVolume",
      "interlocutor",
      "greeting",
      "location",
      "tone",
      "services",
      "emergencyNumber",
      "openingHours",
      "rdvLink",
      "requiredInfo",
    ];
    return req.filter((k) => !String(form[k]).trim());
  }, [form]);

  // Complétion visible : combien de champs sont déjà remplis.
  const completion = useMemo(() => {
    const keys = Object.keys(EMPTY) as (keyof FormState)[];
    const filled = keys.filter((k) => String(form[k]).trim().length > 0).length;
    return { filled, total: keys.length };
  }, [form]);

  const buildBody = () => {
    const toneLabel = {
      formel: "Très formel (vouvoiement strict)",
      chaleureux: "Professionnel chaleureux (vouvoiement, ton dynamique)",
      decontracte: "Décontracté (tutoiement)",
      "": "Non précisé",
    }[form.tone];

    return [
      `Nouvelle préparation Lucie — Formule : ${planLabel}`,
      "",
      "== RDV ==",
      booking
        ? `${formatBookingDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`
        : "Aucun rendez-vous confirmé",
      "",
      "== 0. Diagnostic ==",
      `Score de compatibilité : ${rec.score}/100 (${TIER_LABELS[rec.tier]})`,
      `Formule recommandée : ${rec.plan ? REC_PLAN_LABELS[rec.plan] : "Aucune"}`,
      `Priorité commerciale : ${PRIORITY_EMOJI[rec.priority]} ${PRIORITY_LABELS[rec.priority]}`,
      "",
      "== 1. Informations générales ==",
      `Contact : ${form.contactName} <${form.contactEmail}>`,
      `Entreprise : ${form.companyName}`,
      `Téléphone entreprise : ${form.companyPhone}`,
      `Site internet : ${form.website || "—"}`,
      `Volume d'appels estimé : ${form.callVolume}`,
      `Interlocuteur principal : ${form.interlocutor}`,
      "",
      "== 2. Configuration de l'accueil vocal ==",
      `Phrase d'accroche : ${form.greeting}`,
      `Localisation souhaitée : ${form.location}`,
      `Ton de l'IA : ${toneLabel}`,
      "",
      "== 3. Expertise et services ==",
      form.services,
      "",
      "== 4. Gestion des appels et urgences ==",
      `Numéro de transfert d'urgence : ${form.emergencyNumber}`,
      `Critères d'urgence : ${form.emergencyCriteria || "—"}`,
      `Horaires d'ouverture : ${form.openingHours}`,
      "",
      "== 5. Prise de RDV et devis ==",
      `Lien de prise de RDV : ${form.rdvLink}`,
      `Informations obligatoires à collecter : ${form.requiredInfo}`,
      "",
      "== 6. Accès technique (optionnel) ==",
      form.techAccess || "—",
      "",
      "== 7. Informations supplémentaires ==",
      form.extra || "—",
    ].join("\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredMissing.length > 0) {
      toast.error("Merci de compléter tous les champs obligatoires.");
      return;
    }
    if (!reviewing) {
      setReviewing(true);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    const summary = buildBody();
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          plan: plan ?? null,
          compatibilityScore: rec.score,
          compatibilityTier: rec.tier,
          recommendedPlan: rec.plan,
          priority: rec.priority,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          companyName: form.companyName,
          companyPhone: form.companyPhone,
          website: form.website || null,
          callVolume: form.callVolume,
          interlocutor: form.interlocutor,
          greeting: form.greeting,
          location: form.location,
          tone: form.tone,
          services: form.services,
          emergencyNumber: form.emergencyNumber,
          emergencyCriteria: form.emergencyCriteria || null,
          openingHours: form.openingHours,
          rdvLink: form.rdvLink,
          requiredInfo: form.requiredInfo,
          techAccess: form.techAccess || null,
          extra: form.extra || null,
          summary,
        },
      });
      try {
        localStorage.setItem(
          "lucie:preparation",
          JSON.stringify({ ...form, plan, sentAt: new Date().toISOString(), submissionId: res.id }),
        );
      } catch {
        /* ignore */
      }
      setConfirmation(res);
      setSubmitted(true);
      // Attache le contact au RDV pour que le verrou reste cohérent après reload.
      if (booking) {
        updateBooking({
          user: { name: form.contactName, email: form.contactEmail },
        });
        // Ensure a server booking exists so 24h/2h reminders can fire.
        try {
          const meetingAt = new Date(
            `${booking.date}T${(booking.time || "10:00")}:00`,
          ).toISOString();
          await upsertBooking({
            data: {
              clientRef: getClientRef(),
              email: form.contactEmail,
              name: form.contactName,
              phone: form.companyPhone,
              meetingDate: booking.date,
              meetingTime: booking.time || undefined,
              meetingAt,
            },
          });
        } catch (e) {
          console.warn("[booking sync] failed", e);
        }
      }
      toast.success("Configuration enregistrée — l'équipe Lucie prend le relais.");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Envoi impossible. Réessayez ou écrivez-nous à contact@lucieassistant.fr.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildBody());
      toast.success("Récapitulatif copié dans le presse-papiers.");
    } catch {
      toast.error("Impossible de copier automatiquement.");
    }
  };

  return (
    <div className="space-y-8">
      {intro && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 text-sm sm:p-6">
          <div className="flex items-start gap-3">
            <ClipboardCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Configuration personnalisée — 5 minutes
              </p>
              <p className="text-muted-foreground">
                Renseignez vos informations pour que Lucie soit opérationnelle
                sous 72 h. En cas d'urgence :{" "}
                <a href="tel:+33637055980" className="underline">
                  +33 6 37 05 59 80
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {submitted && confirmation ? (
        <SubmittedConfirmation
          confirmation={confirmation}
          planLabel={planLabel}
          plan={plan}
          booking={booking}
          form={form}
          summary={buildBody()}
          diagnostic={{
            score: rec.score,
            tierLabel: TIER_LABELS[rec.tier],
            recommendedPlanLabel: rec.plan ? REC_PLAN_LABELS[rec.plan] : "—",
            priorityLabel: PRIORITY_LABELS[rec.priority],
            priorityEmoji: PRIORITY_EMOJI[rec.priority],
          }}
          onReset={() => {
            setSubmitted(false);
            setConfirmation(null);
          }}
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm"
        >
          <div className="flex items-center gap-2">
            {saveState.status === "pending" ? (
              <>
                <CloudUpload className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
                <span className="font-medium text-foreground">Enregistrement…</span>
              </>
            ) : saveState.status === "saved" && saveState.at ? (
              <>
                <Save className="h-4 w-4 text-success" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  Sauvegardé automatiquement
                </span>
                <span className="text-muted-foreground">· {formatWhen(saveState.at)}</span>
              </>
            ) : saveState.status === "error" ? (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                <span className="font-medium text-destructive">
                  Sauvegarde impossible sur ce navigateur
                </span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">
                  Vos réponses sont sauvegardées à chaque frappe
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 sm:w-64">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.round((completion.filled / completion.total) * 100)}%`,
                }}
              />
            </div>
            <span className="tabular-nums text-muted-foreground">
              {completion.filled}/{completion.total}
            </span>
          </div>
        </div>

        {/* Historique des sauvegardes (horodaté, restaurable). */}
        <div className="-mt-4 flex justify-end">
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                disabled={history.length === 0}
                aria-label="Voir l'historique des sauvegardes"
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                Historique
                <span className="tabular-nums">({history.length})</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" aria-hidden="true" />
                  Historique des sauvegardes
                </DialogTitle>
                <DialogDescription>
                  Chaque enregistrement automatique crée un point de restauration
                  horodaté. Sélectionnez une version pour la recharger dans le
                  formulaire — vos réponses actuelles seront remplacées.
                </DialogDescription>
              </DialogHeader>
              {history.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                  Aucun point de restauration pour l'instant.
                </p>
              ) : (
                <>
                  <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {history.map((snapshot, idx) => {
                      const total = Object.keys(EMPTY).length;
                      return (
                        <li
                          key={`${snapshot.at}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {formatWhen(snapshot.at)}
                              {idx === 0 && (
                                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Actuelle
                                </span>
                              )}
                              {snapshot.remote && (
                                <span
                                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success"
                                  title="Synchronisé sur tous vos appareils"
                                >
                                  <CloudUpload className="h-2.5 w-2.5" aria-hidden="true" />
                                  Cloud
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {snapshot.filled}/{total} champ
                              {snapshot.filled > 1 ? "s" : ""} rempli
                              {snapshot.filled > 1 ? "s" : ""}
                              {snapshot.form.contactName && (
                                <> · {snapshot.form.contactName}</>
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={idx === 0 ? "ghost" : "outline"}
                            className="h-8 shrink-0 rounded-lg text-xs"
                            onClick={() => setConfirmRestore(snapshot)}
                            disabled={idx === 0}
                            aria-haspopup="dialog"
                          >
                            <RotateCcw
                              className="mr-1.5 h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Restaurer
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearHistory}
                    >
                      Effacer l'historique
                    </Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <AlertDialog
          open={!!confirmRestore}
          onOpenChange={(open) => {
            if (!open) setConfirmRestore(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    Vous allez remplacer votre brouillon actuel par la version
                    du{" "}
                    <strong>{formatWhen(confirmRestore?.at ?? "")}</strong>.
                  </p>
                  <p className="text-destructive font-medium">
                    Cette action écrasera les réponses non sauvegardées et ne
                    peut pas être annulée.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmRestore(null)}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmRestore) restoreSnapshot(confirmRestore);
                }}
              >
                Confirmer la restauration
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {resumed && (
          <details
            open
            role="status"
            className="group rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 text-sm"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <History
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-foreground">
                    Reprise automatique · {resumed.restoredCount} champ
                    {resumed.restoredCount > 1 ? "s" : ""} restauré
                    {resumed.restoredCount > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {resumed.submissionId
                      ? "Vous aviez déjà envoyé une première configuration. Ajustez vos réponses et renvoyez si besoin."
                      : "Vos réponses précédentes ont été rechargées depuis le brouillon local. Continuez là où vous vous étiez arrêté."}
                    {resumed.at && (
                      <>
                        {" "}Dernière sauvegarde&nbsp;: {formatWhen(resumed.at)}.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 self-start rounded-lg text-xs sm:self-auto"
                onClick={(e) => {
                  e.preventDefault();
                  handleReset();
                }}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Repartir de zéro
              </Button>
            </summary>
            <div className="mt-4 grid gap-2 border-t border-primary/15 pt-4 sm:grid-cols-2">
              {resumed.sections.map((s) => {
                const pct = s.total === 0 ? 0 : Math.round((s.filled / s.total) * 100);
                const complete = s.filled === s.total;
                const empty = s.filled === 0;
                return (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {complete ? (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-success"
                          aria-hidden="true"
                        />
                      ) : empty ? (
                        <AlertCircle
                          className="h-3.5 w-3.5 text-muted-foreground/60"
                          aria-hidden="true"
                        />
                      ) : (
                        <CloudUpload
                          className="h-3.5 w-3.5 text-primary"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={
                          empty
                            ? "text-muted-foreground"
                            : "font-medium text-foreground"
                        }
                      >
                        {s.label}
                      </span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {s.filled}/{s.total}
                      <span className="ml-1 text-muted-foreground/60">· {pct}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {reviewing && (
          <ReviewPanel
            form={form}
            planLabel={planLabel}
            booking={booking}
            diagnostic={{
              score: rec.score,
              tierLabel: TIER_LABELS[rec.tier],
              recommendedPlanLabel: rec.plan ? REC_PLAN_LABELS[rec.plan] : "—",
              priorityLabel: PRIORITY_LABELS[rec.priority],
              priorityEmoji: PRIORITY_EMOJI[rec.priority],
            }}
            onEdit={() => {
              setReviewing(false);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            submitting={submitting}
          />
        )}

        <div className={reviewing ? "hidden" : "space-y-8"}>
        <Section n="1" title="Informations générales">
          <Grid>
            <Field label="Votre nom et prénom" required>
              <Input
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                required
                maxLength={120}
              />
            </Field>
            <Field label="Votre email" required>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <Field
              label="Nom de l'entreprise"
              hint="Nom exact à prononcer par l'IA."
              required
            >
              <Input
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
                maxLength={150}
              />
            </Field>
            <Field
              label="Interlocuteur principal"
              hint="Nom et prénom du référent."
              required
            >
              <Input
                value={form.interlocutor}
                onChange={(e) => update("interlocutor", e.target.value)}
                required
                maxLength={120}
              />
            </Field>
            <Field
              label="Numéro de téléphone de l'entreprise"
              hint="Numéro appelé par vos clients."
              required
            >
              <Input
                type="tel"
                value={form.companyPhone}
                onChange={(e) => update("companyPhone", e.target.value)}
                required
                maxLength={40}
              />
            </Field>
            <Field label="Site internet" hint="URL du site (optionnel).">
              <Input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                maxLength={300}
              />
            </Field>
            <Field
              label="Volume d'appels estimé"
              hint="Ex : 20 appels/jour, 300/mois."
              required
            >
              <Input
                value={form.callVolume}
                onChange={(e) => update("callVolume", e.target.value)}
                required
                maxLength={120}
              />
            </Field>
          </Grid>
        </Section>

        <Section n="2" title="Configuration de l'accueil vocal">
          <Grid>
            <Field
              label="Phrase d'accroche souhaitée"
              hint={`Ex : "Bonjour et bienvenue chez [Entreprise], je suis votre assistante virtuelle. Comment puis-je vous aider ?"`}
              required
              full
            >
              <Textarea
                rows={3}
                value={form.greeting}
                onChange={(e) => update("greeting", e.target.value)}
                required
                maxLength={500}
              />
            </Field>
            <Field
              label="Localisation souhaitée"
              hint={`Ex : "Paris (12, 17, 19, 20)"`}
              required
            >
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <Field label="Ton de l'IA" required full>
              <RadioGroup
                value={form.tone}
                onValueChange={(v) => update("tone", v as FormState["tone"])}
                className="grid gap-2 sm:grid-cols-3"
              >
                {[
                  { v: "formel", l: "Très formel (vouvoiement strict)" },
                  {
                    v: "chaleureux",
                    l: "Pro chaleureux (vouvoiement, ton dynamique)",
                  },
                  { v: "decontracte", l: "Décontracté (tutoiement)" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm hover:bg-accent"
                  >
                    <RadioGroupItem
                      value={o.v}
                      id={`tone-${o.v}`}
                      className="mt-0.5"
                    />
                    <span>{o.l}</span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
          </Grid>
        </Section>

        <Section n="3" title="Expertise et services">
          <Field
            label="Vos 3 à 5 services principaux"
            hint="Service 1 (Ex : Dépannage d'urgence), Service 2 (Ex : Installation pompes à chaleur), Service 3, etc."
            required
            full
          >
            <Textarea
              rows={4}
              value={form.services}
              onChange={(e) => update("services", e.target.value)}
              required
              maxLength={1500}
            />
          </Field>
        </Section>

        <Section n="4" title="Gestion des appels et urgences">
          <Grid>
            <Field
              label="Numéro de transfert d'urgence"
              hint="Numéro vers lequel basculer en cas d'urgence absolue."
              required
            >
              <Input
                type="tel"
                value={form.emergencyNumber}
                onChange={(e) => update("emergencyNumber", e.target.value)}
                required
                maxLength={40}
              />
            </Field>
            <Field
              label="Horaires d'ouverture"
              hint="Lundi au vendredi, samedi ? Précisez les créneaux."
              required
            >
              <Input
                value={form.openingHours}
                onChange={(e) => update("openingHours", e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <Field
              label="Critères d'urgence"
              hint="Ex : Inondation, plus de chauffage en hiver."
              full
            >
              <Textarea
                rows={3}
                value={form.emergencyCriteria}
                onChange={(e) => update("emergencyCriteria", e.target.value)}
                maxLength={800}
              />
            </Field>
          </Grid>
        </Section>

        <Section n="5" title="Prise de rendez-vous et devis">
          <Grid>
            <Field
              label="Lien de prise de RDV"
              hint="Calendly, Google Agenda, autre… (Si aucun, l'IA proposera de laisser un message.)"
              required
              full
            >
              <Input
                type="url"
                placeholder="https://"
                value={form.rdvLink}
                onChange={(e) => update("rdvLink", e.target.value)}
                required
                maxLength={300}
              />
            </Field>
            <Field
              label="Informations obligatoires à collecter"
              hint="Ex : Nom, numéro de rappel, adresse du chantier, description du problème."
              required
              full
            >
              <Textarea
                rows={3}
                value={form.requiredInfo}
                onChange={(e) => update("requiredInfo", e.target.value)}
                required
                maxLength={800}
              />
            </Field>
          </Grid>
        </Section>

        <Section n="6" title="Accès technique (optionnel)">
          <Field
            label="Outils à intégrer"
            hint="Logiciel métier, CRM, agenda Google… Précisez si vous souhaitez une intégration."
            full
          >
            <Textarea
              rows={3}
              value={form.techAccess}
              onChange={(e) => update("techAccess", e.target.value)}
              maxLength={800}
            />
          </Field>
        </Section>

        <Section n="7" title="Informations supplémentaires (optionnel)">
          <Field label="Demande particulière" full>
            <Textarea
              rows={3}
              value={form.extra}
              onChange={(e) => update("extra", e.target.value)}
              maxLength={800}
            />
          </Field>
        </Section>

        {requiredMissing.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              {requiredMissing.length} champ
              {requiredMissing.length > 1 ? "s" : ""} obligatoire
              {requiredMissing.length > 1 ? "s" : ""} restant.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            À l'étape suivante, votre configuration sera enregistrée puis envoyée
            <strong> automatiquement en PDF</strong> à{" "}
            <strong>{CONTACT_EMAIL}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-11 rounded-xl"
              disabled={submitting}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copier le récapitulatif
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-xl bg-primary px-6 text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
            >
              <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
              Vérifier puis envoyer le PDF
            </Button>
          </div>
        </div>
        </div>
      </form>
      )}
    </div>
  );
}

function SubmittedConfirmation({
  confirmation,
  planLabel,
  plan,
  booking,
  form,
  summary,
  diagnostic,
  onReset,
}: {
  confirmation: { id: string; emailStatus: "sent" | "skipped" | "failed" };
  planLabel: string;
  plan?: "essential" | "pro" | "premium";
  booking: Booking | null;
  form: FormState;
  summary: string;
  diagnostic: {
    score: number;
    tierLabel: string;
    recommendedPlanLabel: string;
    priorityLabel: string;
    priorityEmoji: string;
  };
  onReset: () => void;
}) {
  // Traductions FR des codes d'erreur d'envoi email
  const ERROR_LABELS: Record<string, string> = {
    invalid_email: "Adresse email invalide ou refusée.",
    recipient_suppressed:
      "Ce destinataire est bloqué (désinscription ou plainte antérieure).",
    domain_not_verified: "Domaine expéditeur non vérifié. Contactez l'admin.",
    emails_disabled: "L'envoi d'emails est actuellement désactivé.",
    rate_limited: "Trop d'envois : réessayez dans quelques instants.",
    unauthorized: "Clé API invalide côté serveur.",
    server_error: "Erreur temporaire du service d'envoi. Réessayez.",
    network_error: "Problème réseau lors de l'envoi. Vérifiez votre connexion.",
    unknown_error: "Erreur inconnue lors de l'envoi.",
  };
  const errorLabel = (code?: string, fallback?: string) =>
    (code && ERROR_LABELS[code]) || fallback || "Erreur inconnue.";

  const reference = confirmation.id.slice(0, 8).toUpperCase();
  const documentId = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `LUCIE-${y}${m}${day}-${reference}`;
  }, [reference]);
  const [exporting, setExporting] = useState(false);
  const [emailState, setEmailState] = useState<{
    status: "idle" | "sending" | "sent" | "error";
    message?: string;
    sentAt?: string;
    messageId?: string;
    mainSent?: boolean;
    mainErrorCode?: string;
    mainError?: string;
    prospectAttempted?: boolean;
    prospectSent?: boolean;
    prospectMessageId?: string;
    prospectErrorCode?: string;
    prospectError?: string;
    prospectSending?: boolean;
    mainSending?: boolean;
    retryCount?: number;
  }>({ status: "idle" });
  const emailPdf = useServerFn(sendPreparationPdf);
  const autoSentRef = useRef(false);
  const prospectEmail = (form.contactEmail || "").trim();
  const hasProspectEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospectEmail);
  const [sendCopyToProspect, setSendCopyToProspect] = useState(hasProspectEmail);

  // Personnalisation de l'email envoyé au prospect
  const defaultProspectSubject = "Votre récapitulatif Lucie";
  const defaultProspectMessage = `Bonjour ${form.contactName?.trim() || "{prénom}"},\n\nMerci pour votre confiance ! Vous trouverez ci-dessous le récapitulatif de votre configuration Lucie ainsi que le PDF détaillé.\n\nNotre équipe revient vers vous très vite pour lancer l'installation.\n\nÀ très vite,\nL'équipe Lucie`;
  const [prospectSubject, setProspectSubject] = useState<string>(defaultProspectSubject);
  const [prospectMessage, setProspectMessage] = useState<string>(defaultProspectMessage);
  const [prospectCustomOpen, setProspectCustomOpen] = useState(false);
  const [prospectPreviewOpen, setProspectPreviewOpen] = useState(false);
  const resetProspectTemplate = () => {
    setProspectSubject(defaultProspectSubject);
    setProspectMessage(defaultProspectMessage);
  };

  const handleExportPdf = async (
    opts: {
      download?: boolean;
      email?: boolean;
      sendToProspect?: boolean;
      mode?: "both" | "main" | "prospect";
    } = { download: true },
  ) => {
    const shouldDownload = opts.download ?? false;
    const shouldEmail = opts.email ?? false;
    const mode: "both" | "main" | "prospect" = opts.mode ?? "both";
    const shouldSendToProspect =
      shouldEmail && (opts.sendToProspect ?? sendCopyToProspect) && hasProspectEmail;

    // Validation client : refuser un email prospect invalide
    if (shouldEmail && mode === "prospect" && !hasProspectEmail) {
      setEmailState((s) => ({
        ...s,
        prospectSending: false,
        prospectSent: false,
        prospectErrorCode: "invalid_email",
        prospectError: "Adresse email du prospect invalide.",
      }));
      toast.error("Adresse email du prospect invalide.");
      return;
    }

    if (shouldDownload) setExporting(true);
    if (shouldEmail) {
      setEmailState((s) => {
        if (mode === "prospect") return { ...s, prospectSending: true };
        if (mode === "main") return { ...s, mainSending: true, status: "sending" };
        return { status: "sending", retryCount: (s.retryCount ?? 0) };
      });
    }
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;
      let y = margin;

      // Brand palette — Spark Media Marketing
      const BRAND = {
        primary: [80, 40, 180] as [number, number, number],
        primaryDark: [40, 20, 90] as [number, number, number],
        accent: [225, 29, 116] as [number, number, number],
        ink: [20, 20, 30] as [number, number, number],
        body: [55, 55, 70] as [number, number, number],
        muted: [130, 130, 145] as [number, number, number],
        surface: [245, 243, 255] as [number, number, number],
        line: [220, 215, 235] as [number, number, number],
      };

      // Load Spark Media logo as data URL (bundled asset)
      const logoUrl = (await import("@/assets/spark-media-logo.png")).default as string;
      let logoData: string | null = null;
      let logoRatio = 3; // width / height fallback
      try {
        const res = await fetch(logoUrl);
        const blob = await res.blob();
        logoData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        // Try to get natural ratio
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            if (img.width && img.height) logoRatio = img.width / img.height;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = logoData!;
        });
      } catch {
        logoData = null;
      }

      const ensureSpace = (needed: number) => {
        if (y + needed > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const writeParagraph = (
        text: string,
        opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {},
      ) => {
        const size = opts.size ?? 10;
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...(opts.color ?? BRAND.body));
        const lines = doc.splitTextToSize(text || "—", pageW - margin * 2);
        for (const line of lines as string[]) {
          ensureSpace(size + 4);
          doc.text(line, margin, y);
          y += size + 4;
        }
        y += opts.gap ?? 4;
      };

      // Info box: label + value pairs on a soft violet card
      const writeInfoRows = (rows: Array<[string, string]>) => {
        const padX = 14;
        const padY = 12;
        const rowH = 20;
        const boxH = padY * 2 + rows.length * rowH;
        ensureSpace(boxH + 8);
        doc.setFillColor(...BRAND.surface);
        doc.roundedRect(margin, y - 4, pageW - margin * 2, boxH, 8, 8, "F");
        // left accent bar
        doc.setFillColor(...BRAND.primary);
        doc.roundedRect(margin, y - 4, 3, boxH, 1.5, 1.5, "F");
        let ry = y - 4 + padY + 4;
        for (const [label, value] of rows) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...BRAND.muted);
          doc.text(label.toUpperCase(), margin + padX, ry);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          doc.setTextColor(...BRAND.ink);
          const val = value || "—";
          const maxW = pageW - margin * 2 - padX * 2 - 140;
          const truncated = doc.splitTextToSize(val, maxW)[0] as string;
          doc.text(truncated, margin + padX + 140, ry);
          ry += rowH;
        }
        y += boxH + 12;
      };

      const toc: { title: string; page: number }[] = [];

      const startSection = (title: string, index: number) => {
        // Always start each major section on a fresh page for clarity.
        if (y > margin + 10) {
          doc.addPage();
          y = margin;
        }
        toc.push({ title, page: doc.getCurrentPageInfo().pageNumber });
        // Elegant section header: number chip + title + accent underline
        const bannerY = y - 6;
        doc.setFillColor(...BRAND.primary);
        doc.roundedRect(margin, bannerY, 34, 34, 6, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(String(index).padStart(2, "0"), margin + 17, bannerY + 22, { align: "center" });

        doc.setTextColor(...BRAND.muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("SECTION", margin + 46, bannerY + 12);

        doc.setTextColor(...BRAND.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(title, margin + 46, bannerY + 28);

        y = bannerY + 44;
        // Accent underline
        doc.setDrawColor(...BRAND.accent);
        doc.setLineWidth(2);
        doc.line(margin, y, margin + 40, y);
        doc.setDrawColor(...BRAND.line);
        doc.setLineWidth(0.5);
        doc.line(margin + 44, y, pageW - margin, y);
        y += 22;
        doc.setTextColor(...BRAND.body);
      };

      // Start on page 1 with a placeholder — we'll insert the cover last.
      y = margin;

      // ---- Rendez-vous ----
      startSection("Rendez-vous", 1);
      writeInfoRows([
        [
          "Date",
          booking
            ? `${formatBookingDate(booking.date)}${booking.time ? " · " + booking.time : ""}`
            : "Aucun rendez-vous confirmé",
        ],
        ["Participant", booking?.user?.name ?? "—"],
        ["Email", booking?.user?.email ?? "—"],
        ["Statut", booking?.status ?? "à confirmer"],
      ]);

      // ---- Diagnostic ----
      startSection("Diagnostic", 2);
      // Big score highlight
      ensureSpace(70);
      doc.setFillColor(...BRAND.primaryDark);
      doc.roundedRect(margin, y - 4, pageW - margin * 2, 62, 10, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("SCORE DE COMPATIBILITÉ", margin + 18, y + 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.text(`${diagnostic.score}`, margin + 18, y + 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`/ 100`, margin + 18 + doc.getTextWidth(`${diagnostic.score}`) + 4, y + 42);
      doc.setTextColor(...BRAND.accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(diagnostic.tierLabel.toUpperCase(), pageW - margin - 18, y + 14, { align: "right" });
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Priorité : ${diagnostic.priorityLabel}`, pageW - margin - 18, y + 42, { align: "right" });
      y += 74;
      writeInfoRows([
        ["Formule recommandée", diagnostic.recommendedPlanLabel],
        ["Formule choisie", planLabel],
      ]);

      // ---- Contact ----
      startSection("Contact", 3);
      writeInfoRows([
        ["Nom", form.contactName],
        ["Email", form.contactEmail],
        ["Entreprise", form.companyName],
        ["Téléphone", form.companyPhone],
        ["Site web", form.website || "—"],
        ["Volume d'appels", form.callVolume],
      ]);

      // ---- Configuration complète ----
      startSection("Configuration complète", 4);
      const body = summary.split("\n").slice(2).join("\n");
      writeParagraph(body, { size: 9 });

      // ---- Cover + TOC (inserted at page 1) ----
      doc.insertPage(1);
      // Shift recorded section pages by 1 since we prepended the cover.
      for (const item of toc) item.page += 1;
      doc.setPage(1);

      // ---- Premium Cover ----
      // Dark hero band
      doc.setFillColor(...BRAND.ink);
      doc.rect(0, 0, pageW, 260, "F");
      // Violet gradient-like overlay stripes
      doc.setFillColor(...BRAND.primary);
      doc.rect(0, 240, pageW, 6, "F");
      doc.setFillColor(...BRAND.accent);
      doc.rect(0, 250, pageW, 2, "F");

      // Logo top-left
      if (logoData) {
        const logoH = 40;
        const logoW = logoH * logoRatio;
        try {
          doc.addImage(logoData, "PNG", margin, 36, logoW, logoH);
        } catch {
          /* ignore */
        }
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SPARK MEDIA MARKETING", margin, 60);
      }

      // Eyebrow
      doc.setTextColor(...BRAND.accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("RÉCAPITULATIF PREMIUM", margin, 120);

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.text("Lucie Command Center", margin, 155);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(200, 195, 220);
      doc.text("Diagnostic, formule et parcours d'installation", margin, 180);

      // Meta chips
      const chipY = 208;
      const drawChip = (label: string, x: number) => {
        const w = doc.getTextWidth(label) + 20;
        doc.setDrawColor(120, 100, 200);
        doc.setLineWidth(0.6);
        doc.setFillColor(45, 30, 90);
        doc.roundedRect(x, chipY - 12, w, 20, 10, 10, "FD");
        doc.setTextColor(220, 210, 245);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label, x + 10, chipY + 2);
        return x + w + 8;
      };
      let cx = margin;
      cx = drawChip(`#${reference}`, cx);
      cx = drawChip(planLabel.toUpperCase(), cx);
      drawChip(
        new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
        cx,
      );

      // Sommaire
      let ty = 320;
      doc.setTextColor(...BRAND.muted);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("TABLE DES MATIÈRES", margin, ty);
      ty += 8;
      doc.setDrawColor(...BRAND.accent);
      doc.setLineWidth(2);
      doc.line(margin, ty, margin + 32, ty);
      ty += 26;

      doc.setTextColor(...BRAND.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Sommaire", margin, ty);
      ty += 28;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      let sectionIdx = 0;
      for (const item of toc) {
        sectionIdx += 1;
        const label = item.title;
        const pageStr = `p. ${item.page}`;
        const numLabel = String(sectionIdx).padStart(2, "0");
        const fullLabel = `${numLabel}  ·  ${label}`;
        const labelW = doc.getTextWidth(fullLabel);
        const pageW2 = doc.getTextWidth(pageStr);
        const rowY = ty;
        // Number highlighted, then label
        doc.setTextColor(...BRAND.accent);
        doc.setFont("helvetica", "bold");
        doc.text(numLabel, margin, rowY);
        doc.setTextColor(...BRAND.ink);
        doc.setFont("helvetica", "normal");
        doc.text(`  ·  ${label}`, margin + doc.getTextWidth(numLabel), rowY);
        // Dotted leader
        doc.setTextColor(...BRAND.line);
        const dotStart = margin + labelW + 6;
        const dotEnd = pageW - margin - pageW2 - 6;
        if (dotEnd > dotStart) {
          const dots = ".".repeat(Math.max(0, Math.floor((dotEnd - dotStart) / 3)));
          doc.text(dots, dotStart, rowY);
        }
        // Page number
        doc.setTextColor(...BRAND.primary);
        doc.setFont("helvetica", "bold");
        doc.text(pageStr, pageW - margin - pageW2, rowY);
        doc.setFont("helvetica", "normal");
        // Clickable link across the whole row
        doc.link(margin, rowY - 12, pageW - margin * 2, 18, { pageNumber: item.page });
        ty += 26;
      }

      // Cover footer note
      doc.setDrawColor(...BRAND.line);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - margin - 40, pageW - margin, pageH - margin - 40);
      doc.setTextColor(...BRAND.muted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(
        "Document confidentiel — Cliquez sur une entrée du sommaire pour accéder à la section.",
        margin,
        pageH - margin - 22,
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.primary);
      doc.text("SPARK MEDIA MARKETING", pageW - margin, pageH - margin - 22, { align: "right" });

      // Footer with page numbers on all pages (including cover).
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i === 1) continue; // cover has its own footer treatment
        // Thin brand rule
        doc.setDrawColor(...BRAND.line);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.primary);
        doc.text("LUCIE COMMAND CENTER", margin, pageH - 20);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...BRAND.muted);
        doc.text("by Spark Media Marketing", margin + doc.getTextWidth("LUCIE COMMAND CENTER") + 6, pageH - 20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND.ink);
        doc.text(`${i} / ${pages}`, pageW - margin, pageH - 20, { align: "right" });
      }

      const filename = `lucie-recapitulatif-${(form.companyName || "parcours")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.pdf`;

      if (shouldDownload) {
        doc.save(filename);
        toast.success("PDF récapitulatif téléchargé.");
      }

      if (shouldEmail) {
        const arrayBuf = doc.output("arraybuffer");
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + 0x8000)) as unknown as number[],
          );
        }
        const pdfBase64 = btoa(binary);
        try {
          const res = await emailPdf({
            data: {
              submissionId: confirmation.id,
              filename,
              pdfBase64,
              contactName: form.contactName || null,
              contactEmail: form.contactEmail || null,
              companyName: form.companyName || null,
              companyPhone: form.companyPhone || null,
              planLabel,
              meetingLabel: booking
                ? `${formatBookingDate(booking.date)}${booking.time ? " · " + booking.time : ""}`
                : null,
              sendToProspect: shouldSendToProspect,
              mode,
              retryAttempt: (emailState.retryCount ?? 0) + (mode !== "both" ? 1 : 0),
              prospectSubject: shouldSendToProspect || mode === "prospect" ? prospectSubject.trim() || null : null,
              prospectMessage: shouldSendToProspect || mode === "prospect" ? prospectMessage : null,
            },
          });
          const r = res as {
            sent: boolean;
            mainSent?: boolean;
            messageId?: string;
            mainErrorCode?: string;
            mainError?: string;
            prospectAttempted?: boolean;
            prospectSent?: boolean;
            prospectMessageId?: string;
            prospectErrorCode?: string;
            prospectError?: string;
          };
          setEmailState((s) => {
            const mainAttempted = mode !== "prospect";
            const nextMainSent =
              mainAttempted ? r.mainSent : s.mainSent;
            const nextMainError = mainAttempted ? r.mainError : s.mainError;
            const nextMainErrorCode = mainAttempted ? r.mainErrorCode : s.mainErrorCode;
            const nextMessageId = mainAttempted && r.messageId ? r.messageId : s.messageId;

            const prospectAttempted =
              mode === "prospect" || (mode === "both" && shouldSendToProspect);
            const nextProspectSent = prospectAttempted ? r.prospectSent : s.prospectSent;
            const nextProspectMessageId =
              prospectAttempted && r.prospectMessageId ? r.prospectMessageId : s.prospectMessageId;
            const nextProspectError = prospectAttempted ? r.prospectError : s.prospectError;
            const nextProspectErrorCode = prospectAttempted
              ? r.prospectErrorCode
              : s.prospectErrorCode;

            const overallOk =
              (nextMainSent ?? true) === true &&
              (!prospectAttempted || nextProspectSent === true);

            return {
              status: nextMainSent === false ? "error" : overallOk ? "sent" : s.status === "sent" ? "sent" : "error",
              message: nextMainError,
              sentAt:
                mainAttempted && r.mainSent
                  ? new Date().toISOString()
                  : s.sentAt ?? (r.mainSent === undefined && r.prospectSent ? new Date().toISOString() : undefined),
              messageId: nextMessageId,
              mainSent: nextMainSent,
              mainError: nextMainError,
              mainErrorCode: nextMainErrorCode,
              prospectAttempted: prospectAttempted || s.prospectAttempted,
              prospectSent: nextProspectSent,
              prospectMessageId: nextProspectMessageId,
              prospectError: nextProspectError,
              prospectErrorCode: nextProspectErrorCode,
              mainSending: false,
              prospectSending: false,
              retryCount: (s.retryCount ?? 0) + (mode !== "both" ? 1 : 0),
            };
          });

          if (mode === "prospect") {
            if (r.prospectSent)
              toast.success(`Copie envoyée à ${prospectEmail}`, {
                description: `Document ${documentId}`,
              });
            else
              toast.error(
                `Copie non envoyée : ${errorLabel(r.prospectErrorCode, r.prospectError)}`,
              );
          } else if (mode === "main") {
            if (r.mainSent)
              toast.success(`Email envoyé à ${CONTACT_EMAIL}`, {
                description: `Document ${documentId}`,
              });
            else
              toast.error(`Envoi impossible : ${errorLabel(r.mainErrorCode, r.mainError)}`);
          } else {
            if (r.mainSent) {
              toast.success(
                r.prospectSent
                  ? `Email envoyé à ${CONTACT_EMAIL} + ${prospectEmail}`
                  : `Email envoyé à ${CONTACT_EMAIL}`,
                { description: `Document ${documentId}` },
              );
            } else {
              toast.error(`Envoi impossible : ${errorLabel(r.mainErrorCode, r.mainError)}`);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setEmailState((s) => ({
            ...s,
            status: mode === "prospect" ? s.status : "error",
            message,
            mainSending: false,
            prospectSending: false,
            ...(mode === "prospect"
              ? { prospectSent: false, prospectErrorCode: "network_error", prospectError: message }
              : { mainSent: false, mainErrorCode: "network_error", mainError: message }),
          }));
          toast.error(`Envoi impossible : ${message}`);
        }
      }
    } catch (err) {
      console.error(err);
      if (shouldDownload) toast.error("Export PDF impossible. Réessayez.");
      if (shouldEmail)
        setEmailState((s) => ({
          ...s,
          status: "error",
          message: "PDF non généré.",
          mainSending: false,
          prospectSending: false,
          mainErrorCode: "unknown_error",
          mainError: "PDF non généré.",
        }));
    } finally {
      if (shouldDownload) setExporting(false);
    }
  };

  // Envoi automatique du PDF récapitulatif à contact@lucieassistant.fr
  // dès l'ouverture de la confirmation, sans intervention supplémentaire.
  useEffect(() => {
    if (autoSentRef.current) return;
    autoSentRef.current = true;
    void handleExportPdf({ download: false, email: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-3xl border border-primary/30 bg-primary/[0.05] p-6 shadow-[var(--shadow-elevated)] sm:p-10"
    >
      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Configuration enregistrée ✅
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Merci ! Votre configuration <strong>{planLabel}</strong> est bien reçue.
          L'équipe Lucie planifie votre cadrage sous 24 h ouvrées et lance
          l'installation sous 72 h.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Référence : <span className="font-mono font-medium text-foreground">#{reference}</span>
        </p>
      </div>

      {/* Accusé de réception automatique */}
      <div
        role="status"
        aria-live="polite"
        className={`mt-6 rounded-2xl border p-4 sm:p-5 ${
          emailState.status === "sent"
            ? "border-[oklch(0.65_0.17_155)]/40 bg-[oklch(0.65_0.17_155)]/[0.08]"
            : emailState.status === "error"
              ? "border-destructive/40 bg-destructive/10"
              : "border-primary/30 bg-primary/[0.06]"
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              emailState.status === "sent"
                ? "bg-[oklch(0.65_0.17_155)]/20 text-[oklch(0.45_0.17_155)]"
                : emailState.status === "error"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary"
            }`}
          >
            {emailState.status === "sending" ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : emailState.status === "sent" ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : emailState.status === "error" ? (
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Mail className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Accusé de réception
            </div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {emailState.status === "sent"
                ? `✅ Email envoyé à ${CONTACT_EMAIL}`
                : emailState.status === "sending"
                  ? `Envoi de l'email en cours vers ${CONTACT_EMAIL}…`
                  : emailState.status === "error"
                    ? "Envoi impossible — réessayez ci-dessous"
                    : `Email en préparation vers ${CONTACT_EMAIL}`}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExportPdf({ download: true })}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {exporting ? "Génération…" : "Télécharger le PDF"}
              </button>
            </div>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Identifiant du document
                </dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <code className="truncate rounded-md bg-background/60 px-2 py-1 font-mono text-[11px] font-semibold text-foreground">
                    {documentId}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(documentId);
                      toast.success("Identifiant copié");
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    aria-label="Copier l'identifiant du document"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Horodatage
                </dt>
                <dd className="mt-0.5 font-mono text-[11px] text-foreground">
                  {emailState.sentAt
                    ? new Date(emailState.sentAt).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })
                    : emailState.status === "sending"
                      ? "—"
                      : "En attente"}
                </dd>
              </div>
              {emailState.messageId && (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    ID message (traçabilité)
                  </dt>
                  <dd className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {emailState.messageId}
                  </dd>
                </div>
              )}
            </dl>

            {/* Option : copie au prospect */}
            {hasProspectEmail && (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3">
                <label className="flex cursor-pointer items-start gap-3 text-xs">
                  <input
                    type="checkbox"
                    checked={sendCopyToProspect}
                    onChange={(e) => setSendCopyToProspect(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">
                      Envoyer aussi une copie au prospect
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Le PDF sera également envoyé à{" "}
                      <span className="font-mono text-foreground">{prospectEmail}</span>.
                    </span>
                  </span>
                </label>
                {sendCopyToProspect && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setProspectCustomOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 font-medium text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-expanded={prospectCustomOpen}
                      >
                        {prospectCustomOpen ? "Masquer" : "Personnaliser"} l'email au prospect
                      </button>
                      <button
                        type="button"
                        onClick={() => setProspectPreviewOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 font-medium text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        aria-expanded={prospectPreviewOpen}
                      >
                        {prospectPreviewOpen ? "Masquer" : "Aperçu"}
                      </button>
                      {(prospectSubject !== defaultProspectSubject ||
                        prospectMessage !== defaultProspectMessage) && (
                        <button
                          type="button"
                          onClick={resetProspectTemplate}
                          className="ml-auto text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                    {prospectCustomOpen && (
                      <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                            Sujet
                          </label>
                          <input
                            type="text"
                            value={prospectSubject}
                            onChange={(e) => setProspectSubject(e.target.value.slice(0, 200))}
                            maxLength={200}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            placeholder={defaultProspectSubject}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                            Message personnel (facultatif)
                          </label>
                          <textarea
                            value={prospectMessage}
                            onChange={(e) => setProspectMessage(e.target.value.slice(0, 5000))}
                            rows={6}
                            maxLength={5000}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            placeholder={defaultProspectMessage}
                          />
                          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                            <span>Le PDF et le récap sont ajoutés automatiquement sous ce message.</span>
                            <span>{prospectMessage.length}/5000</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {prospectPreviewOpen && (
                      <div className="overflow-hidden rounded-lg border border-border/60 bg-background/60">
                        <div className="border-b border-border/60 bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                          Aperçu
                        </div>
                        <div className="space-y-2 p-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">De</span>
                            <div className="font-mono text-foreground">Lucie &lt;{CONTACT_EMAIL}&gt;</div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">À</span>
                            <div className="font-mono text-foreground">{prospectEmail}</div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Sujet</span>
                            <div className="font-semibold text-foreground">
                              {prospectSubject.trim() || defaultProspectSubject}
                            </div>
                          </div>
                          <div className="rounded-md border border-border/50 bg-background p-3">
                            <div className="whitespace-pre-wrap text-foreground">
                              {prospectMessage.trim() || (
                                <span className="italic text-muted-foreground">
                                  (aucun message personnel — seul le récap et le PDF seront envoyés)
                                </span>
                              )}
                            </div>
                            <div className="mt-3 border-t border-dashed border-border/60 pt-2 text-[11px] text-muted-foreground">
                              📄 Récapitulatif + lien de téléchargement du PDF (ajoutés automatiquement)
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {sendCopyToProspect && emailState.prospectAttempted && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {emailState.prospectSending ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Envoi de la copie en cours…
                      </span>
                    ) : emailState.prospectSent ? (
                      <span className="inline-flex items-center gap-1 text-[oklch(0.55_0.17_155)]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Copie envoyée à {prospectEmail}
                      </span>
                    ) : emailState.prospectSent === false ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Copie non envoyée : {errorLabel(emailState.prospectErrorCode, emailState.prospectError)}
                      </span>
                    ) : null}
                    {!emailState.prospectSending && (
                      <button
                        type="button"
                        onClick={() =>
                          handleExportPdf({
                            download: false,
                            email: true,
                            sendToProspect: true,
                            mode: "prospect",
                          })
                        }
                        className="ml-auto text-[11px] font-semibold text-primary underline underline-offset-2 hover:no-underline disabled:opacity-50"
                        disabled={emailState.prospectErrorCode === "invalid_email"}
                      >
                        {emailState.prospectSent ? "Renvoyer la copie" : "Réessayer la copie prospect"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {emailState.mainSent === false && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-destructive">
                  <strong className="font-semibold">Envoi à {CONTACT_EMAIL} impossible :</strong>{" "}
                  {errorLabel(emailState.mainErrorCode, emailState.mainError)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleExportPdf({ download: false, email: true, mode: "main" })
                  }
                  disabled={emailState.mainSending}
                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-[11px] font-semibold text-destructive-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60 disabled:opacity-60"
                >
                  {emailState.mainSending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Renvoi…
                    </>
                  ) : (
                    "Réessayer l'envoi principal"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {booking && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[oklch(0.65_0.17_155)]/30 bg-[oklch(0.65_0.17_155)]/[0.06] p-4 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[oklch(0.65_0.17_155)]/15 text-[oklch(0.45_0.17_155)]">
            <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-widest text-[oklch(0.45_0.17_155)]">
              Rendez-vous confirmé
            </div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {formatBookingDate(booking.date)}
              {booking.time ? ` · ${booking.time}` : ""}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Score de compatibilité
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {diagnostic.score}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </div>
          <div className="text-xs text-muted-foreground">{diagnostic.tierLabel}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Formule recommandée
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {diagnostic.recommendedPlanLabel}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Priorité commerciale
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            <span aria-hidden="true">{diagnostic.priorityEmoji}</span>{" "}
            {diagnostic.priorityLabel}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Sauvegarde sécurisée</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Vos réponses sont chiffrées et stockées côté Lucie — reprises
              immédiatement par notre équipe de setup.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {emailState.status === "sent"
                ? "PDF envoyé par email"
                : emailState.status === "sending"
                  ? "Envoi du PDF en cours…"
                  : emailState.status === "error"
                    ? "Envoi du PDF impossible"
                    : "PDF prêt à envoyer"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground break-words">
              {emailState.status === "sent"
                ? `Le PDF récapitulatif vient d'être envoyé à ${CONTACT_EMAIL}.`
                : emailState.status === "sending"
                  ? `Génération et envoi du PDF vers ${CONTACT_EMAIL}…`
                  : emailState.status === "error"
                    ? `${emailState.message ?? "Erreur inconnue."} Vous pouvez réessayer ci-dessous.`
                    : `Le récapitulatif PDF sera transmis à ${CONTACT_EMAIL}.`}
            </p>
            {emailState.status === "error" && (
              <button
                type="button"
                onClick={() => handleExportPdf({ download: false, email: true })}
                className="mt-2 text-xs font-semibold text-primary underline underline-offset-2 hover:no-underline"
              >
                Renvoyer le PDF à {CONTACT_EMAIL}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => handleExportPdf({ download: true })}
          disabled={exporting}
          className="h-11 rounded-xl"
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {exporting ? "Génération…" : "Télécharger le récapitulatif PDF"}
        </Button>
        <Button asChild className="h-11 rounded-xl">
          <Link to="/installation">
            Voir la timeline d'installation
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onReset}
        >
          Envoyer une autre configuration
        </Button>
      </div>
    </section>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
          {n}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2 space-y-2" : "space-y-2"}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-primary">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function ReviewPanel({
  form,
  planLabel,
  booking,
  diagnostic,
  onEdit,
  submitting,
}: {
  form: FormState;
  planLabel: string;
  booking: Booking | null;
  diagnostic: {
    score: number;
    tierLabel: string;
    recommendedPlanLabel: string;
    priorityLabel: string;
    priorityEmoji: string;
  };
  onEdit: () => void;
  submitting: boolean;
}) {
  const toneLabel =
    form.tone === "formel"
      ? "Très formel (vouvoiement strict)"
      : form.tone === "chaleureux"
        ? "Professionnel chaleureux"
        : form.tone === "decontracte"
          ? "Décontracté (tutoiement)"
          : "—";

  const groups: {
    n: string;
    title: string;
    rows: [string, string][];
  }[] = [
    {
      n: "1",
      title: "Informations générales",
      rows: [
        ["Contact", `${form.contactName} · ${form.contactEmail}`],
        ["Entreprise", form.companyName],
        ["Téléphone", form.companyPhone],
        ["Site internet", form.website || "—"],
        ["Volume d'appels", form.callVolume],
        ["Interlocuteur", form.interlocutor],
      ],
    },
    {
      n: "2",
      title: "Accueil vocal",
      rows: [
        ["Phrase d'accroche", form.greeting],
        ["Localisation", form.location],
        ["Ton de l'IA", toneLabel],
      ],
    },
    { n: "3", title: "Expertise et services", rows: [["Services", form.services]] },
    {
      n: "4",
      title: "Appels et urgences",
      rows: [
        ["Numéro d'urgence", form.emergencyNumber],
        ["Critères d'urgence", form.emergencyCriteria || "—"],
        ["Horaires d'ouverture", form.openingHours],
      ],
    },
    {
      n: "5",
      title: "Prise de RDV",
      rows: [
        ["Lien RDV", form.rdvLink],
        ["Infos à collecter", form.requiredInfo],
      ],
    },
    { n: "6", title: "Accès technique", rows: [["Outils", form.techAccess || "—"]] },
    { n: "7", title: "Notes complémentaires", rows: [["Demande particulière", form.extra || "—"]] },
  ];

  return (
    <section
      aria-labelledby="review-title"
      className="rounded-3xl border border-primary/30 bg-primary/[0.04] p-6 shadow-[var(--shadow-elevated)] sm:p-8"
    >
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]"
          >
            <Eye className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-primary">
              Dernière étape · Vérification
            </div>
            <h2 id="review-title" className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Récapitulatif de vos réponses
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vérifiez que tout est correct avant l'envoi à l'équipe Lucie. Vous pouvez encore modifier vos réponses.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          disabled={submitting}
          className="h-10 shrink-0 rounded-xl"
        >
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
          Modifier mes réponses
        </Button>
      </header>

      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Formule</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{planLabel}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score diagnostic</div>
          <div className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {diagnostic.score}/100 · {diagnostic.tierLabel}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">RDV</div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {booking
              ? `${formatBookingDate(booking.date)}${booking.time ? ` · ${booking.time}` : ""}`
              : "Non confirmé"}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div
            key={g.n}
            className="rounded-2xl border border-border bg-card p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
              >
                {g.n}
              </span>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {g.title}
              </h3>
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(140px,180px)_1fr]">
              {g.rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="whitespace-pre-wrap text-sm text-foreground/90">
                    {v && v.trim().length > 0 ? v : <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-primary/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          disabled={submitting}
          className="h-11 rounded-xl"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Revenir à la configuration
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-xl bg-primary px-6 text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {submitting ? "Envoi en cours…" : `Confirmer et envoyer le PDF à ${CONTACT_EMAIL}`}
        </Button>
      </div>
    </section>
  );
}