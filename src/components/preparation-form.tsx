import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Send,
  Loader2,
  Mail,
  Database,
  RotateCcw,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { submitPreparation } from "@/lib/preparation.functions";
import { useRecommendation } from "@/lib/lucie-store";
import {
  PLAN_LABELS as REC_PLAN_LABELS,
  PRIORITY_EMOJI,
  PRIORITY_LABELS,
  TIER_LABELS,
} from "@/lib/recommendation";

const CONTACT_EMAIL = "contact@lucieassistant.fr";
const STORAGE_KEY = "lucie:preparation";

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
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    emailStatus: "sent" | "skipped" | "failed";
  } | null>(null);
  const [resumed, setResumed] = useState<{
    at: string;
    submissionId?: string;
  } | null>(null);
  const hydrated = useRef(false);
  const submit = useServerFn(submitPreparation);
  const rec = useRecommendation();

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
      };
      // Only prefill when it matches the current plan (or when no plan filter applies).
      if (plan && saved.plan && saved.plan !== plan) return;
      const next: FormState = { ...EMPTY };
      let hasValue = false;
      (Object.keys(EMPTY) as (keyof FormState)[]).forEach((k) => {
        const v = saved[k];
        if (typeof v === "string" && v.length > 0) {
          (next[k] as string) = v;
          hasValue = true;
        }
      });
      if (!hasValue) return;
      setForm(next);
      setResumed({ at: saved.sentAt ?? "", submissionId: saved.submissionId });
    } catch {
      /* ignore malformed storage */
    }
  }, [plan]);

  // Persist every change so a full-page reload keeps the prospect's answers.
  useEffect(() => {
    if (!hydrated.current || submitted) return;
    const anyValue = Object.values(form).some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    try {
      if (anyValue) {
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
      }
    } catch {
      /* ignore */
    }
  }, [form, plan, submitted]);

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setForm(EMPTY);
    setResumed(null);
    toast.success("Formulaire réinitialisé.");
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
      toast.success("Questionnaire enregistré — l'équipe Lucie prend le relais.");
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
                Questionnaire de configuration — 5 minutes
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
          onReset={() => {
            setSubmitted(false);
            setConfirmation(null);
          }}
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        {resumed && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <History
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-foreground">
                  Reprise automatique de votre questionnaire
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {resumed.submissionId
                    ? "Vous aviez déjà envoyé un premier questionnaire. Ajustez vos réponses et renvoyez si besoin."
                    : "Vos réponses précédentes ont été rechargées. Continuez là où vous vous étiez arrêté."}
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
              onClick={handleReset}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Repartir de zéro
            </Button>
          </div>
        )}

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
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-900 dark:text-amber-200"
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
            En cliquant « Envoyer », votre questionnaire est enregistré et
            transmis à l'équipe Lucie (<strong>{CONTACT_EMAIL}</strong>).
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
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {submitting ? "Envoi en cours…" : "Envoyer à l'équipe Lucie"}
            </Button>
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
  onReset,
}: {
  confirmation: { id: string; emailStatus: "sent" | "skipped" | "failed" };
  planLabel: string;
  plan?: "essential" | "pro" | "premium";
  onReset: () => void;
}) {
  const reference = confirmation.id.slice(0, 8).toUpperCase();
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
          Questionnaire enregistré ✅
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
          <div>
            <div className="text-sm font-semibold text-foreground">
              {confirmation.emailStatus === "sent"
                ? "Récap envoyé par email"
                : "Récap transmis à l'équipe"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {confirmation.emailStatus === "sent"
                ? `Une copie du récapitulatif a été envoyée à ${CONTACT_EMAIL}.`
                : `Notre équipe consulte le récap directement. Pour toute question : ${CONTACT_EMAIL}.`}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild className="h-11 rounded-xl">
          <Link to="/suivi" search={{ plan }}>
            Voir la timeline d'exploitation
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onReset}
        >
          Envoyer un autre questionnaire
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