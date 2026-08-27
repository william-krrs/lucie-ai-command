import { Link, useRouterState } from "@tanstack/react-router";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REQUIRE_ACCOUNT } from "@/lib/config";
import { loginHref, useAccount } from "@/lib/auth-account";
import { useSignOut } from "@/lib/use-sign-out";
import { cn } from "@/lib/utils";

/**
 * Identité du compte authentifié. Strictement distincte des Simulations
 * commerciales : aucune association n'est faite entre une simulation locale et
 * le compte connecté.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { status, email } = useAccount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = useSignOut();

  if (!REQUIRE_ACCOUNT || status === "loading") return null;

  if (status !== "account") {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn("rounded-xl", compact && "h-9 px-2.5")}
      >
        <Link to={loginHref(pathname)} aria-label="Créer mon compte ou me connecter">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {!compact && <span className="ml-1.5">Mon compte</span>}
        </Link>
      </Button>
    );
  }

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl px-2.5"
        onClick={() => void signOut()}
        aria-label={`Se déconnecter de ${email ?? "mon compte"}`}
        title={email ?? undefined}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <div className="m-4 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        Compte client
      </div>
      <div className="mt-1 truncate text-xs font-medium text-foreground" title={email ?? ""}>
        {email}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full rounded-xl"
        onClick={() => void signOut()}
      >
        <LogOut className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Se déconnecter
      </Button>
    </div>
  );
}
