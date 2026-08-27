import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin_/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion administration — Lucie" },
      {
        name: "description",
        content: "Espace de connexion réservé à l'équipe Lucie Command Center.",
      },
      { property: "og:title", content: "Connexion administration — Lucie" },
      {
        property: "og:description",
        content: "Espace de connexion réservé à l'équipe Lucie Command Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user && !data.user.is_anonymous) {
        void navigate({ to: "/admin", replace: true });
      }
    });
  }, [navigate]);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? "Identifiants invalides." : "Connexion impossible.",
      );
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
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de définition du mot de passe envoyé.");
    } catch {
      toast.error("Envoi impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <PageHeader
        eyebrow="Interne"
        title="Connexion administration"
        description="Accès réservé. L'autorisation est vérifiée côté serveur après connexion."
      />
      <Card className="p-6">
        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Mot de passe</Label>
            <Input
              id="admin-password"
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
            Définir / réinitialiser mon mot de passe
          </button>
        </form>
      </Card>
    </div>
  );
}
