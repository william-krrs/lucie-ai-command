import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AFTER_LOGIN, recallNext } from "@/lib/auth-account";

export const Route = createFileRoute("/mot-de-passe")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Définir mon mot de passe — Lucie" },
      {
        name: "description",
        content: "Définissez un nouveau mot de passe pour votre compte Lucie Command Center.",
      },
      { property: "og:title", content: "Définir mon mot de passe — Lucie" },
      {
        property: "og:description",
        content: "Choisissez un nouveau mot de passe pour accéder à votre parcours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MotDePassePage,
});

function MotDePassePage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Le lien de récupération ouvre une session temporaire (événement
  // PASSWORD_RECOVERY) : on attend qu'elle soit posée avant d'autoriser le form.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour.");
      await navigate({ to: recallNext() ?? DEFAULT_AFTER_LOGIN, replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <PageHeader
        eyebrow="Mon compte"
        title="Définir mon mot de passe"
        description="Ce lien est valable une seule fois. Choisissez un mot de passe d'au moins 8 caractères."
      />
      <Card className="p-6">
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Lien de récupération en cours de vérification. S'il a expiré,
            demandez-en un nouveau depuis la page de connexion.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Enregistrer
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
