import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { PreparationForm } from "@/components/preparation-form";

const searchSchema = z.object({
  plan: z.enum(["essential", "pro", "premium"]).optional(),
});

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

export const Route = createFileRoute("/preparation")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Préparation de votre assistante IA | Lucie" },
      {
        name: "description",
        content:
          "Formulaire de configuration après paiement : renseignez vos informations pour lancer l'installation de Lucie sous 72h.",
      },
      { property: "og:title", content: "Préparation de votre assistante IA | Lucie" },
      {
        property: "og:description",
        content: "Renseignez votre entreprise et vos préférences pour accélérer le lancement.",
      },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/preparation" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://lucie-ai-command.lovable.app/preparation" }],
  }),
  component: Preparation,
});

function Preparation() {
  const { plan } = Route.useSearch();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const planLabel = plan ? PLAN_LABELS[plan] : "Non précisée";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredMissing.length > 0) {
      toast.error("Merci de compléter tous les champs obligatoires.");
      return;
    }
    const subject = `Préparation Lucie — ${form.companyName} (${planLabel})`;
    const body = buildBody();
    try {
      localStorage.setItem("lucie:preparation", JSON.stringify({ ...form, plan, sentAt: new Date().toISOString() }));
    } catch {
      /* ignore */
    }
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSubmitted(true);
    toast.success("Votre client mail s'ouvre avec le récapitulatif pré-rempli.");
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
      <PageHeader
        eyebrow={`Formule ${planLabel}`}
        title="Préparation de votre assistante IA"
        description="Un formulaire unique pour tout centraliser. Une fois validé, votre assistante sera prête pour une phase de test sous 72 h ouvrées."
      />

      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 text-sm sm:p-6">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Félicitations pour l'activation de votre assistant(e) IA
            </p>
            <p className="text-muted-foreground">
              Temps estimé : 5 minutes. En cas d'urgence : <a href="tel:+33637055980" className="underline">+33 6 37 05 59 80</a>.
              Vos réponses restent sur votre appareil ; l'envoi se fait via votre messagerie.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        <Section n="1" title="Informations générales">
          <Grid>
            <Field label="Votre nom et prénom" required>
              <Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} required maxLength={120} />
            </Field>
            <Field label="Votre email" required>
              <Input type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Nom de l'entreprise" hint="Nom exact à prononcer par l'IA." required>
              <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} required maxLength={150} />
            </Field>
            <Field label="Interlocuteur principal" hint="Nom et prénom du référent." required>
              <Input value={form.interlocutor} onChange={(e) => update("interlocutor", e.target.value)} required maxLength={120} />
            </Field>
            <Field label="Numéro de téléphone de l'entreprise" hint="Numéro appelé par vos clients." required>
              <Input type="tel" value={form.companyPhone} onChange={(e) => update("companyPhone", e.target.value)} required maxLength={40} />
            </Field>
            <Field label="Site internet" hint="URL du site (optionnel).">
              <Input type="url" placeholder="https://" value={form.website} onChange={(e) => update("website", e.target.value)} maxLength={300} />
            </Field>
            <Field label="Volume d'appels estimé" hint="Ex : 20 appels/jour, 300/mois." required>
              <Input value={form.callVolume} onChange={(e) => update("callVolume", e.target.value)} required maxLength={120} />
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
              <Textarea rows={3} value={form.greeting} onChange={(e) => update("greeting", e.target.value)} required maxLength={500} />
            </Field>
            <Field label="Localisation souhaitée" hint={`Ex : "Paris (12, 17, 19, 20)"`} required>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Ton de l'IA" required full>
              <RadioGroup
                value={form.tone}
                onValueChange={(v) => update("tone", v as FormState["tone"])}
                className="grid gap-2 sm:grid-cols-3"
              >
                {[
                  { v: "formel", l: "Très formel (vouvoiement strict)" },
                  { v: "chaleureux", l: "Pro chaleureux (vouvoiement, ton dynamique)" },
                  { v: "decontracte", l: "Décontracté (tutoiement)" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm hover:bg-accent"
                  >
                    <RadioGroupItem value={o.v} id={`tone-${o.v}`} className="mt-0.5" />
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
            <Textarea rows={4} value={form.services} onChange={(e) => update("services", e.target.value)} required maxLength={1500} />
          </Field>
        </Section>

        <Section n="4" title="Gestion des appels et urgences">
          <Grid>
            <Field label="Numéro de transfert d'urgence" hint="Numéro vers lequel basculer en cas d'urgence absolue." required>
              <Input type="tel" value={form.emergencyNumber} onChange={(e) => update("emergencyNumber", e.target.value)} required maxLength={40} />
            </Field>
            <Field label="Horaires d'ouverture" hint="Lundi au vendredi, samedi ? Précisez les créneaux." required>
              <Input value={form.openingHours} onChange={(e) => update("openingHours", e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Critères d'urgence" hint="Ex : Inondation, plus de chauffage en hiver." full>
              <Textarea rows={3} value={form.emergencyCriteria} onChange={(e) => update("emergencyCriteria", e.target.value)} maxLength={800} />
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
              <Input type="url" placeholder="https://" value={form.rdvLink} onChange={(e) => update("rdvLink", e.target.value)} required maxLength={300} />
            </Field>
            <Field
              label="Informations obligatoires à collecter"
              hint="Ex : Nom, numéro de rappel, adresse du chantier, description du problème."
              required
              full
            >
              <Textarea rows={3} value={form.requiredInfo} onChange={(e) => update("requiredInfo", e.target.value)} required maxLength={800} />
            </Field>
          </Grid>
        </Section>

        <Section n="6" title="Accès technique (optionnel)">
          <Field
            label="Outils à intégrer"
            hint="Logiciel métier, CRM, agenda Google… Précisez si vous souhaitez une intégration."
            full
          >
            <Textarea rows={3} value={form.techAccess} onChange={(e) => update("techAccess", e.target.value)} maxLength={800} />
          </Field>
        </Section>

        <Section n="7" title="Informations supplémentaires (optionnel)">
          <Field label="Demande particulière" full>
            <Textarea rows={3} value={form.extra} onChange={(e) => update("extra", e.target.value)} maxLength={800} />
          </Field>
        </Section>

        {requiredMissing.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-900 dark:text-amber-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {requiredMissing.length} champ{requiredMissing.length > 1 ? "s" : ""} obligatoire{requiredMissing.length > 1 ? "s" : ""} restant.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            En cliquant « Envoyer », votre messagerie s'ouvre avec le récapitulatif pré-rempli vers <strong>{CONTACT_EMAIL}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleCopy} className="h-11 rounded-xl">
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copier le récapitulatif
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl bg-primary px-6 text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Envoyer à l'équipe Lucie
            </Button>
          </div>
        </div>
      </form>

      {submitted && (
        <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-6 w-6 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Formulaire envoyé</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Nous revenons vers vous sous 72 h ouvrées pour planifier la phase de test.
                  Vous pouvez suivre l'avancement depuis la page dédiée.
                </p>
              </div>
            </div>
            <Button asChild className="h-11 rounded-xl">
              <Link to="/suivi" search={{ plan }}>
                Suivre l'installation
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
          {n}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
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