import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAccount } from "@/lib/auth-account";
import {
  useLucie,
  useMetrics,
  useRecommendation,
  readLocalDiagnosticUpdatedAt,
  writeLocalDiagnosticUpdatedAt,
} from "@/lib/lucie-store";
import {
  getDiagnosticSnapshot,
  saveDiagnosticSnapshot,
} from "@/lib/diagnostic-snapshot.functions";

/**
 * Persistance serveur du diagnostic pour un compte client authentifié.
 *
 * Règle V1 (1 compte = 1 parcours), arbitrage sûr à la reconnexion :
 * - aucun snapshot serveur → le local peut initialiser le serveur ;
 * - un snapshot serveur existe → il est AUTORITAIRE, sauf preuve explicite
 *   que le local est plus récent (`lucie:diagnostic:v1:updatedAt` strictement
 *   postérieur à `updated_at` serveur) ;
 * - un vieux cache local (horodatage absent ou antérieur) ne peut jamais
 *   écraser silencieusement des données serveur plus récentes.
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

        const pushLocal = async () => {
          const res = await save({
            data: {
              diagnostic: latest.current.state,
              metrics: latest.current.metrics,
              recommendation: latest.current.recommendation,
            },
          });
          writeLocalDiagnosticUpdatedAt(res.updatedAt);
        };

        if (!snapshot) {
          // Aucun snapshot serveur : le local peut initialiser le serveur.
          if (!isPristine) await pushLocal();
          return;
        }

        const localAt = readLocalDiagnosticUpdatedAt();
        const localIsProvablyNewer =
          !isPristine &&
          !!localAt &&
          new Date(localAt).getTime() > new Date(snapshot.updatedAt).getTime();

        if (localIsProvablyNewer) {
          await pushLocal();
        } else {
          // Serveur autoritaire.
          replace(snapshot.diagnostic as Record<string, never>);
          writeLocalDiagnosticUpdatedAt(snapshot.updatedAt);
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
      })
        .then((res) => writeLocalDiagnosticUpdatedAt(res.updatedAt))
        .catch((error) => console.error("[diagnostic-sync] sauvegarde", error));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [state, status, save]);

  return null;
}

