import { useEffect, useState } from "react";
import { ChevronDown, Plus, Save, Trash2, UserCircle2, Check, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ACTIVE_PROSPECT_KEY,
  PROSPECTS_KEY,
  deleteProspect,
  getActiveProspectId,
  listProspects,
  loadProspect,
  renameProspect,
  saveCurrentAsProspect,
  startNewProspect,
  type Prospect,
} from "@/lib/prospect-store";

export function ProspectSwitcher({ className }: { className?: string }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    setProspects(listProspects());
    setActiveId(getActiveProspectId());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === PROSPECTS_KEY || e.key === ACTIVE_PROSPECT_KEY) {
        setProspects(listProspects());
        setActiveId(getActiveProspectId());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const active = prospects.find((p) => p.id === activeId) ?? null;

  function handleSave() {
    const p = saveCurrentAsProspect();
    setProspects(listProspects());
    setActiveId(p.id);
    toast.success(`Prospect « ${p.label} » enregistré.`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm shadow-[var(--shadow-card)] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label="Sélectionner une simulation commerciale"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Simulation active
            </span>
            <span className="block max-w-[10rem] truncate text-sm font-medium text-foreground">
              {active?.label ?? "Aucune — nouvelle simulation"}
            </span>
          </span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> Mes prospects
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Chaque prospect garde son diagnostic, son RDV et sa configuration.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" className="h-9 rounded-lg" onClick={handleSave}>
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Enregistrer l'actuel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-lg"
              onClick={() => {
                setOpen(false);
                startNewProspect();
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Nouveau
            </Button>
          </div>
        </div>
        <ul className="max-h-[50vh] overflow-auto p-2" role="list">
          {prospects.length === 0 ? (
            <li className="rounded-lg px-3 py-6 text-center text-xs text-muted-foreground">
              Aucun prospect enregistré pour le moment.
              <br />
              Remplissez le diagnostic puis cliquez sur « Enregistrer l'actuel ».
            </li>
          ) : (
            prospects.map((p) => {
              const isActive = p.id === activeId;
              const isEditing = editingId === p.id;
              return (
                <li key={p.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-2",
                      isActive ? "bg-primary/10" : "hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setOpen(false);
                          return;
                        }
                        setOpen(false);
                        loadProspect(p.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-label={`Charger le prospect ${p.label}`}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-semibold",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground/70",
                        )}
                      >
                        {p.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renameProspect(p.id, draftName);
                                setProspects(listProspects());
                                setEditingId(null);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-xs"
                          />
                        ) : (
                          <span className="block truncate text-sm font-medium text-foreground">
                            {p.label}
                          </span>
                        )}
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[p.activity, p.city].filter(Boolean).join(" · ") || "Diagnostic vide"}
                        </span>
                      </span>
                    </button>
                    {isActive && (
                      <span className="text-[10px] font-medium uppercase tracking-widest text-primary">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(p.id);
                        setDraftName(p.label);
                      }}
                      className="rounded p-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      aria-label={`Renommer ${p.label}`}
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Supprimer le prospect « ${p.label} » ?`)) return;
                        deleteProspect(p.id);
                        setProspects(listProspects());
                        if (activeId === p.id) setActiveId(null);
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={`Supprimer ${p.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}