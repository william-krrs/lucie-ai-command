import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Garde-fou : le domaine historique `lucieassistant.fr` ne doit plus apparaître
 * en clair dans le code (PDF, e-mails, pages). Tout doit passer par les
 * constantes centralisées de `src/lib/config.ts` (SITE_DOMAIN, CONTACT_EMAIL,
 * EMAIL_FROM, EMAIL_SENDER_DOMAIN…).
 *
 * Pour ajouter une exception légitime (ex. slug Calendly propriétaire),
 * ajouter le chemin + motif dans ALLOWLIST ci-dessous avec un commentaire.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["src"];
const FORBIDDEN = /lucieassistant\.fr/gi;

// Chemins ignorés (config centrale, tests, fichiers générés).
const IGNORED_FILES = new Set<string>([
  "src/lib/config.ts", // source de vérité, autorisée
]);

// Motifs autorisés par fichier (regex appliqué à la ligne).
const ALLOWLIST: Array<{ file: string; pattern: RegExp; reason: string }> = [
  // Aucune exception : le domaine historique ne doit plus apparaître.
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?|mdx?|css|json|html)$/.test(p) ? [p] : [];
  });
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

function isAllowed(relPath: string, line: string): boolean {
  return ALLOWLIST.some(
    (rule) => rule.file === relPath && rule.pattern.test(line),
  );
}

describe("no legacy domain (lucieassistant.fr) in source", () => {
  const offenders: string[] = [];

  for (const abs of files) {
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    if (IGNORED_FILES.has(rel)) continue;
    const src = readFileSync(abs, "utf8");
    if (!FORBIDDEN.test(src)) continue;
    FORBIDDEN.lastIndex = 0;
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (!/lucieassistant\.fr/i.test(line)) return;
      // Le slug Calendly `contact-lucieassistant` (sans `.fr`) reste autorisé.
      if (isAllowed(rel, line)) return;
      offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
  }

  it("aucune occurrence du domaine historique hors config", () => {
    expect(
      offenders,
      `Utilisez SITE_DOMAIN / CONTACT_EMAIL / EMAIL_FROM depuis @/lib/config :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/**
 * Garde-fou ciblé : les modules qui composent des PDF ou envoient des e-mails
 * ne doivent jamais contenir d'adresse @lucieassistant.fr en dur, même dans un
 * commentaire — l'historique montre que ces zones sont copiées/collées.
 */
describe("PDF & email modules use only centralised identity", () => {
  // Liste explicite des modules connus (garde-fou même si l'auto-détection
  // échoue à cause d'un renommage de dépendance).
  const CRITICAL = [
    "src/lib/share.functions.ts",
    "src/lib/preparation-email.functions.ts",
    "src/lib/email-templates/send-email.ts",
    "src/lib/email-templates/registry.ts",
    "src/lib/email-templates/reminder-2h.tsx",
    "src/lib/email-templates/reminder-24h.tsx",
    "src/components/preparation-form.tsx",
    "src/routes/d.$token.tsx",
    "src/routes/merci.tsx",
    "src/routes/recommandation.tsx",
    "src/routes/demo.tsx",
  ];

  for (const rel of CRITICAL) {
    it(`${rel} ne contient plus de lucieassistant.fr`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const hits = src.match(/lucieassistant\.fr/gi) ?? [];
      expect(hits, `Remplacer par les constantes @/lib/config`).toEqual([]);
    });
  }
});

/**
 * Auto-détection : tout module qui importe jsPDF, @react-email ou l'API
 * d'envoi (`sendLovableEmail`) doit être couvert par le garde-fou, sans
 * exception. Cela garantit que 100 % des documents générés (PDF) et envoyés
 * (e-mails) passent par la config centralisée.
 */
describe("all PDF/email producers are domain-clean", () => {
  const SIGNAL =
    /(from\s+["']jspdf["']|from\s+["']@react-email\/|from\s+["']@lovable\.dev\/email-js["']|sendLovableEmail\s*\(|new\s+jsPDF\s*\()/;

  const producers = files
    .map((abs) => ({ abs, rel: relative(ROOT, abs).replace(/\\/g, "/") }))
    .filter(({ rel }) => !IGNORED_FILES.has(rel))
    .filter(({ abs }) => SIGNAL.test(readFileSync(abs, "utf8")));

  it("au moins un producteur PDF/e-mail détecté (sanity)", () => {
    expect(producers.length).toBeGreaterThan(0);
  });

  for (const { abs, rel } of producers) {
    it(`${rel} n'utilise pas le domaine historique`, () => {
      const src = readFileSync(abs, "utf8");
      const hits = src.match(/lucieassistant\.fr/gi) ?? [];
      expect(
        hits,
        `Ce module génère un PDF ou envoie un e-mail : passez par SITE_DOMAIN / CONTACT_EMAIL / EMAIL_FROM depuis @/lib/config.`,
      ).toEqual([]);
    });
  }
});
