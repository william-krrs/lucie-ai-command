import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_AFTER_LOGIN,
  forgetNext,
  recallNext,
  rememberNext,
  sanitizeNext,
  useAccount,
} from "@/lib/auth-account";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/connexion")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Créer mon compte ou me connecter — Lucie" },
      {
        name: "description",
        content:
          "Accédez à votre parcours Lucie : création de compte avec confirmation par email, connexion et récupération de mot de passe.",
      },
      { property: "og:title", content: "Mon compte — Lucie Command Center" },
      {
        property: "og:description",
        content: "Créez votre compte Lucie pour suivre votre parcours personnalisé.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConnexionPage,
});

function ConnexionPage() {
  const { next: rawNext } = Route.useSearch();
  const navigate = useNavigate();
  const { status } = useAccount();

  const next = useMemo(
    () => sanitizeNext(rawNext) ?? recallNext() ?? DEFAULT_AFTER_LOGIN,
    [rawNext],
  );

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // La destination survit à l'aller-retour par email (autre onglet / autre app).
  useEffect(() => {
    rememberNext(sanitizeNext(rawNext));
  }, [rawNext]);

  // Le lien de confirmation revient avec les jetons dans le hash : le client
  // Supabase les consomme seul (detectSessionInUrl), puis émet SIGNED_IN.
  useEffect(() => {
    if (status !== "account") return;
    forgetNext();
    void navigate({ to: next, replace: true });
  }, [navigate, next, status]);

  // Erreur renvoyée par Supabase dans le hash (lien expiré, déjà utilisé…).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const description = params.get("error_description");
    if (description) {
      toast.error(decodeURIComponent(description));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const redirectTo = () =>
    `${window.location.origin}/connexion?next=${encodeURIComponent(next)}`;

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      // Confirmation d'email obligatoire : aucune session n'est ouverte ici.
      if (data.session) {
        toast.success("Compte créé.");
      } else {
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création de compte impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // La redirection est prise en charge par l'effet ci-dessus (SIGNED_IN).
    } catch (error) {
      const message =
        error instanceof Error && /email not confirmed/i.test(error.message)
          ? "Votre adresse n'est pas encore confirmée : ouvrez le lien reçu par email."
          : "Identifiants invalides.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) {
      toast.error("Renseignez d'abord votre adresse email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/mot-de-passe`,
      });
      if (error) throw error;
      toast.success("Email de réinitialisation envoyé.");
    } catch {
      toast.error("Envoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      toast.success("Nouvel email de confirmation envoyé.");
    } catch {
      toast.error("Renvoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6">
        <PageHeader
          eyebrow="Mon compte"
          title="Confirmez votre adresse email"
          description="Votre compte est créé mais pas encore actif."
        />
        <Card className="space-y-4 p-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-medium">Un email vient de partir vers {email}</span>
          </div>
          <p>
            Ouvrez le lien de confirmation : vous serez ramené automatiquement à
            l'étape que vous vouliez atteindre. Votre diagnostic déjà rempli sur ce
            navigateur est conservé.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void handleResend()}
          >
            Renvoyer l'email de confirmation
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <PageHeader
        eyebrow="Mon compte"
        title="Accédez à votre parcours"
        description="Votre parcours (rendez-vous, paiement, configuration, installation) est rattaché à votre compte. Le diagnostic reste accessible sans compte."
      />
      <Card className="p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Se connecter</TabsTrigger>
            <TabsTrigger value="signup">Créer mon compte</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Mot de passe</Label>
                <Input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Se connecter
              </Button>
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={busy}
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
              >
                Mot de passe oublié
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Mot de passe</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Créer mon compte
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Un email de confirmation vous sera envoyé : votre compte est activé
                après avoir cliqué sur le lien.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
