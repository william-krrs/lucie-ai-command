import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCOUNT_AFTER_PAYMENT, REQUIRE_ACCOUNT } from "@/lib/config";
import { loginHref, useAccount } from "@/lib/auth-account";

/**
 * Mur de compte.
 *
 * Autorise le contenu uniquement pour un compte email authentifié.
 * - aucune session  → « compte requis »
 * - session anonyme → « compte requis » (héritage : jamais un client)
 * - compte email    → contenu
 */
export function AccountGate({
  children,
  step,
  title = "Créez votre compte pour continuer",
  description,
  afterPayment = false,
}: {
  children: ReactNode;
  step?: string;
  title?: string;
  description?: string;
  /** Étape post-paiement : compte requis quand ACCOUNT_AFTER_PAYMENT est actif. */
  afterPayment?: boolean;
}) {
  const { status } = useAccount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const next = `${pathname}${search ? (search.startsWith("?") ? search : `?${search}`) : ""}`;

  const enforced = REQUIRE_ACCOUNT || (afterPayment && ACCOUNT_AFTER_PAYMENT);
  if (!enforced) return <>{children}</>;
  if (status === "account") return <>{children}</>;

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Vérification de votre compte"
        className="mx-auto h-48 max-w-2xl animate-pulse rounded-3xl border border-border bg-card/60"
      />
    );
  }

  return (
    <section
      role="region"
      aria-labelledby="account-gate-title"
      className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)] sm:p-12"
    >
      <span
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </span>
      {step && (
        <div className="mt-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Compte requis · {step}
        </div>
      )}
      <h1
        id="account-gate-title"
        className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description ??
          (afterPayment
            ? "Votre paiement est enregistré. Créez maintenant votre compte pour suivre la configuration et l'installation de Lucie : votre paiement et votre diagnostic sont conservés."
            : "Votre parcours personnel (rendez-vous, paiement, configuration, installation) est rattaché à votre compte. Créez-le en une minute : votre diagnostic déjà rempli est conservé.")}
      </p>

      {status === "anonymous" && (
        <p className="mx-auto mt-4 max-w-md rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Créez votre compte depuis ce navigateur : il sera automatiquement
          rattaché à votre paiement.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild className="min-h-11 rounded-xl">
          <Link to={loginHref(next)}>
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Créer mon compte ou me connecter
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link to="/diagnostic">Revenir au diagnostic</Link>
        </Button>
      </div>
    </section>
  );
}
