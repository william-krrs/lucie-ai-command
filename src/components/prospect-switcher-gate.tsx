import { REQUIRE_ACCOUNT } from "@/lib/config";
import { useAccount } from "@/lib/auth-account";
import { ProspectSwitcher } from "@/components/prospect-switcher";

/**
 * Règle V1 « 1 compte authentifié = 1 parcours client » :
 * les Simulations commerciales (multi-prospects locaux) ne s'affichent que
 * dans le contexte commercial (visiteur sans compte / session anonyme
 * héritée / admin). Un client connecté ne voit que son compte
 * (`AccountMenu`) et ne peut jamais créer ni sélectionner un prospect.
 *
 * Le store local (`prospect-store`) n'est ni supprimé ni purgé : c'est un
 * retrait d'affichage uniquement.
 */
export function ProspectSwitcherGate() {
  const { status } = useAccount();

  // Pendant le chargement on évite un flash du sélecteur pour un client
  // connecté : le gate reste vide jusqu'à statut connu.
  if (status === "loading") return null;
  if (REQUIRE_ACCOUNT && status === "account") return null;

  return <ProspectSwitcher />;
}
