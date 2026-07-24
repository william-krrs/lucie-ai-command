import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Global keyboard shortcuts for power users and screen-share demos.
 *
 * - "?" (or Shift+/) opens the help dialog.
 * - "g" then a letter jumps to a section (Gmail-style leader key):
 *     g h → /             g d → /diagnostic     g r → /roi
 *     g c → /recommandation g o → /offres        g q → /preparation
 *     g f → /faq          g m → /demo
 * - "s" focuses the first field of the current page (skip to content).
 * - "Esc" closes the dialog.
 *
 * Shortcuts are ignored while typing in inputs/textareas/selects or in
 * contenteditable regions, and while a modifier key is held (to avoid
 * clashing with browser and screen-reader chords).
 */

const NAV_MAP: Record<string, string> = {
  h: "/",
  d: "/diagnostic",
  r: "/roi",
  c: "/recommandation",
  o: "/offres",
  q: "/preparation",
  f: "/faq",
  m: "/demo",
};

const NAV_LABELS: { keys: string; label: string }[] = [
  { keys: "g h", label: "Accueil" },
  { keys: "g d", label: "Diagnostic" },
  { keys: "g r", label: "ROI" },
  { keys: "g c", label: "Recommandation" },
  { keys: "g o", label: "Offres" },
  { keys: "g q", label: "Questionnaire" },
  { keys: "g f", label: "FAQ" },
  { keys: "g m", label: "Mode Démo" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const role = el.getAttribute("role");
  return role === "combobox" || role === "searchbox" || role === "textbox";
}

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const leader = useRef(false);
  const leaderTimer = useRef<number | null>(null);

  const clearLeader = useCallback(() => {
    leader.current = false;
    if (leaderTimer.current) {
      window.clearTimeout(leaderTimer.current);
      leaderTimer.current = null;
    }
  }, []);

  const focusFirstControl = useCallback(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const target = main.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"], button:not([disabled]), a[href]',
    );
    (target ?? main).focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Help dialog
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Focus first control
      if (e.key === "s") {
        e.preventDefault();
        focusFirstControl();
        return;
      }

      // Leader sequence: g <letter>
      if (leader.current) {
        const dest = NAV_MAP[e.key.toLowerCase()];
        clearLeader();
        if (dest) {
          e.preventDefault();
          navigate({ to: dest });
        }
        return;
      }
      if (e.key === "g") {
        leader.current = true;
        leaderTimer.current = window.setTimeout(clearLeader, 1500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearLeader();
    };
  }, [navigate, clearLeader, focusFirstControl]);

  // Reset leader when route changes.
  useEffect(() => clearLeader(), [pathname, clearLeader]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raccourcis clavier</DialogTitle>
          <DialogDescription>
            Naviguez sans quitter le clavier. Ces raccourcis sont désactivés
            pendant la saisie dans un champ.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <ShortcutRow keys={["?"]} label="Afficher / masquer cette aide" />
          <ShortcutRow keys={["s"]} label="Aller au premier champ de la page" />
          <ShortcutRow keys={["Tab"]} label="Champ / lien suivant" />
          <ShortcutRow keys={["Shift", "Tab"]} label="Champ / lien précédent" />
          <ShortcutRow keys={["↑", "↓"]} label="Se déplacer dans la barre latérale" />
          <ShortcutRow keys={["Esc"]} label="Fermer une popin ou un menu" />
          <div className="pt-2">
            <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Navigation rapide
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {NAV_LABELS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{s.label}</span>
                  <Kbd>{s.keys}</Kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <Kbd>{k}</Kbd>
            {i < keys.length - 1 && <span className="text-muted-foreground">+</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]">
      {children}
    </kbd>
  );
}