import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAccount } from "@/lib/auth-account";
import { useLucie, useMetrics, useRecommendation } from "@/lib/lucie-store";
import {
  getDiagnosticSnapshot,
  saveDiagnosticSnapshot,
} from "@/lib/diagnostic-snapshot.functions";

/**
 * Persistance serveur du diagnostic pour un compte client authentifié.
 *
 * Règle V1 (1 compte = 1 parcours) :
 * - le localStorage reste un cache UX, la source durable est la table
 *   `diagnostic_snapshots`, indexée par le user_id du bearer token ;
 * - à la connexion : si l'état local est encore vierge, on restaure le
 *   serveur ; sinon l'état local (plus récent, saisi par le client) est
 *   poussé vers le serveur ;
 * - ensuite chaque modification est sauvegardée avec un debounce.
 *
 * Aucune écriture n'a lieu pour un visiteur ou une session anonyme.
 */
export function DiagnosticSync() {
  const { status, userId } = useAccount();
  const { state, replace, isPristine } = useLucie();
  const metrics = useMetrics();
  const recommendation = useRecommendation();

  const load = useServerFn(getDiagnosticSnapshot);
  const save = useServerFn(saveDiagnosticSnapshot);

  const syncedFor = useRef<string | null>(null);
  const ready = useRef(false);
  const latest = useRef({ state, metrics, recommendation });
  latest.current = { state, metrics, recommendation };

  // 1. Réconciliation à la connexion (et à chaque changement de compte).
  useEffect(() => {
    if (status !== "account" || !userId) {
      if (status === "none" || status === "anonymous") {
        syncedFor.current = null;
        ready.current = false;
      }
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;

    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await load({});
        if (cancelled) return;
        if (snapshot?.diagnostic && isPristine) {
          replace(snapshot.diagnostic as Record<string, never>);
        } else {
          await save({
            data: {
              diagnostic: latest.current.state,
              metrics: latest.current.metrics,
              recommendation: latest.current.recommendation,
            },
          });
        }
      } catch (error) {
        console.error("[diagnostic-sync] réconciliation", error);
      } finally {
        if (!cancelled) ready.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, isPristine, load, save, replace]);

  // 2. Sauvegarde debouncée des modifications ultérieures.
  useEffect(() => {
    if (status !== "account" || !ready.current) return;
    const timer = window.setTimeout(() => {
      void save({
        data: {
          diagnostic: latest.current.state,
          metrics: latest.current.metrics,
          recommendation: latest.current.recommendation,
        },
      }).catch((error) => console.error("[diagnostic-sync] sauvegarde", error));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state, status, save]);

  return null;
}
