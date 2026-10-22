import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  OVERRIDE_PAGES,
  adminAttachBooking,
  adminCrmAddNote,
  adminCrmGet,
  adminCrmList,
  adminCrmSaveClient,
  adminListOrphanBookings,
  adminMarkDemoDone,
  adminMarkPaidManual,
  adminSetOverrides,
  type CrmBooking,
  type OverridePage,
} from "@/lib/admin-crm.functions";

const LIST_KEY = ["admin-crm-list"] as const;
const ORPHANS_KEY = ["admin-crm-orphans"] as const;

const PAGE_LABEL: Record<OverridePage, string> = {
  demonstration: "Démonstration",
  offers: "Offres",
  configuration: "Configuration",
  installation: "Installation",
  setup_test: "RDV Test",
};

const TYPE_LABEL: Record<string, string> = { r1_discovery: "R1", r2_demo: "R2", setup_test: "Setup" };

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

function BookingLine({ b }: { b: CrmBooking | null }) {
  if (!b) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      <Badge variant="secondary" className="mr-1">{TYPE_LABEL[b.type] ?? b.type}</Badge>
      {fmt(b.meetingAt)} · {b.status}
    </span>
  );
}

function errMsg(e: unknown) {
  const m = e instanceof Error ? e.message : "Action impossible.";
  return m === "Forbidden" ? "Accès refusé." : m;
}

export function AdminCrm() {
  const qc = useQueryClient();
  const list = useServerFn(adminCrmList);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const clients = useQuery({ queryKey: LIST_KEY, queryFn: () => list() });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return (clients.data ?? []).filter((c) => {
      if (!term) return true;
      return (
        [c.name, c.email, c.company].some((v) => v?.toLowerCase().includes(term)) ||
        (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    });
  }, [clients.data, q]);

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Prospects & clients</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: LIST_KEY })}>
              Recharger
            </Button>
            <Button size="sm" onClick={() => setCreating((v) => !v)}>
              {creating ? "Fermer" : "Nouvelle fiche"}
            </Button>
          </div>
        </div>
        {creating ? (
          <ClientForm
            onSaved={(key) => {
              setCreating(false);
              setSelected(key);
              void qc.invalidateQueries({ queryKey: LIST_KEY });
            }}
          />
        ) : null}
        <Input
          placeholder="Rechercher par nom, email ou téléphone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3"
          aria-label="Rechercher un client"
        />
        {clients.isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : clients.error ? (
          <p className="text-sm text-destructive">{errMsg(clients.error)}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun résultat.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {filtered.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => setSelected(c.key)}
                  className={`grid w-full gap-1 py-3 text-left text-sm sm:grid-cols-[1.4fr_1fr_1.2fr_auto] sm:items-center sm:gap-3 ${selected === c.key ? "bg-accent/30" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name ?? c.email ?? "Visiteur sans nom"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.company, c.trade].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="truncate">{c.email ?? "—"}</div>
                    <div className="text-muted-foreground">{c.phone ?? "—"}</div>
                  </div>
                  <div className="text-xs"><BookingLine b={c.lastBooking} /></div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={c.paymentStatus === "paid" ? "default" : "secondary"}>{c.paymentStatus}</Badge>
                    <Badge variant="outline">{c.stage}</Badge>
                    {!c.isAccount && c.userId ? <Badge variant="outline">sans compte</Badge> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected ? <ClientDetail key={selected} clientKey={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function ClientForm({
  onSaved,
  initial,
  userId,
}: {
  onSaved: (key: string) => void;
  initial?: Partial<Record<"name" | "company" | "email" | "phone" | "trade", string | null>>;
  userId?: string;
}) {
  const save = useServerFn(adminCrmSaveClient);
  const [f, setF] = useState({
    name: initial?.name ?? "",
    company: initial?.company ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    trade: initial?.trade ?? "",
  });
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await save({ data: { ...f, ...(userId ? { userId } : {}) } });
          toast.success("Fiche enregistrée.");
          onSaved(r.key);
        } catch (err) {
          toast.error(errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {field("name", "Nom *")}
      {field("company", "Entreprise")}
      {field("email", "Email", "email")}
      {field("phone", "Téléphone", "tel")}
      {field("trade", "Métier")}
      <div className="flex items-end">
        <Button type="submit" disabled={busy || !f.name.trim()} className="w-full">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function ClientDetail({ clientKey, onClose }: { clientKey: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(adminCrmGet);
  const setOv = useServerFn(adminSetOverrides);
  const markDemo = useServerFn(adminMarkDemoDone);
  const markPaid = useServerFn(adminMarkPaidManual);
  const addNote = useServerFn(adminCrmAddNote);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const detailKey = ["admin-crm-detail", clientKey];
  const detail = useQuery({ queryKey: detailKey, queryFn: () => get({ data: { key: clientKey } }) });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: detailKey }),
        qc.invalidateQueries({ queryKey: LIST_KEY }),
      ]);
      toast.success(ok);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (detail.isLoading) return <Card className="p-5 text-sm text-muted-foreground">Chargement de la fiche…</Card>;
  if (!detail.data) return <Card className="p-5 text-sm">Fiche introuvable.</Card>;
  const { row, bookings, diagnostic, notes, history } = detail.data;
  const uid = row.userId;

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{row.name ?? row.email ?? "Visiteur sans nom"}</h3>
          <p className="text-xs text-muted-foreground">
            {[row.company, row.trade, row.email, row.phone].filter(Boolean).join(" · ") || "Aucune coordonnée"}
          </p>
          {uid ? <p className="font-mono text-[10px] text-muted-foreground">{uid}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Annuler" : "Modifier"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Fermer</Button>
        </div>
      </div>

      {editing ? (
        <ClientForm
          initial={row}
          userId={uid ?? undefined}
          onSaved={() => {
            setEditing(false);
            void qc.invalidateQueries({ queryKey: detailKey });
            void qc.invalidateQueries({ queryKey: LIST_KEY });
          }}
        />
      ) : null}

      <section className="grid gap-2 text-sm sm:grid-cols-2">
        <div>Étape : <strong>{row.stage}</strong></div>
        <div>Paiement : <Badge variant="secondary">{row.paymentStatus}</Badge> {row.paidPlan ?? ""}</div>
        <div>Démo faite : {row.demoCompletedAt ? fmt(row.demoCompletedAt) : "non"}</div>
        <div>Installation : {row.installationStatus}</div>
      </section>

      {uid ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Déblocages manuels</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {OVERRIDE_PAGES.map((p) => {
              const on = row.overrides.includes(p);
              return (
                <div key={p} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <span>{PAGE_LABEL[p]}</span>
                  <Button
                    size="sm"
                    variant={on ? "default" : "outline"}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => setOv({ data: { targetUserId: uid, pages: [p], unlocked: !on } }),
                        on ? `${PAGE_LABEL[p]} re-verrouillé` : `${PAGE_LABEL[p]} débloqué`,
                      )
                    }
                  >
                    {on ? "Débloqué — re-verrouiller" : "Débloquer"}
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(() => setOv({ data: { targetUserId: uid, pages: [...OVERRIDE_PAGES], unlocked: true } }), "Tout est débloqué")}>
              Tout débloquer
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => setOv({ data: { targetUserId: uid, pages: [...OVERRIDE_PAGES], unlocked: false } }), "Tout est re-verrouillé")}>
              Tout re-verrouiller
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => markDemo({ data: { targetUserId: uid, done: !row.demoCompletedAt } }), row.demoCompletedAt ? "Démo remise à « non faite »" : "Démo marquée comme faite")}>
              {row.demoCompletedAt ? "Annuler « démo faite »" : "Marquer la démo comme faite"}
            </Button>
            {row.paymentStatus !== "paid" ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  const plan = window.prompt("Marquer payé HORS Stripe. Formule ? (essential, pro, premium)", row.paidPlan ?? "pro");
                  if (!plan) return;
                  if (!["essential", "pro", "premium"].includes(plan)) return toast.error("Formule inconnue.");
                  if (!window.confirm(`Confirmer : ${row.name ?? row.email ?? "ce client"} a payé ${plan} hors Stripe ?`)) return;
                  void run(() => markPaid({ data: { targetUserId: uid, plan: plan as "pro", confirm: "PAYE" } }), "Marqué payé hors Stripe");
                }}
              >
                Marquer payé hors Stripe
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Les déblocages s'appliquent au prochain chargement de page du prospect.
          </p>
        </section>
      ) : (
        <p className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
          Fiche manuelle non reliée à une session : les déblocages seront possibles quand le prospect aura une session sur le site (il apparaîtra alors dans la liste ; rattachez-lui son RDV).
        </p>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Rendez-vous</h4>
        {bookings.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun RDV.</p>
        ) : (
          <ul className="space-y-1 text-xs">{bookings.map((b) => <li key={b.id}><BookingLine b={b} /></li>)}</ul>
        )}
        {uid ? <OrphanAttach targetUserId={uid} onDone={() => void qc.invalidateQueries({ queryKey: detailKey })} /> : null}
      </section>

      {diagnostic ? (
        <section>
          <h4 className="mb-2 text-sm font-semibold">Diagnostic</h4>
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {Object.entries(diagnostic)
              .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-border/40 py-1">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Notes privées</h4>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Visible par vous seul" />
        <Button
          size="sm"
          className="mt-2"
          disabled={busy || !note.trim()}
          onClick={() => void run(async () => { await addNote({ data: { key: clientKey, body: note } }); setNote(""); }, "Note ajoutée")}
        >
          Ajouter la note
        </Button>
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border/50 p-2 text-sm">
              <div className="text-[11px] text-muted-foreground">{fmt(n.createdAt)}</div>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {history.length ? (
        <section>
          <h4 className="mb-2 text-sm font-semibold">Historique admin</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {history.map((h, i) => <li key={i}>{fmt(h.createdAt)} — {h.action}</li>)}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}

function OrphanAttach({ targetUserId, onDone }: { targetUserId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listOrphans = useServerFn(adminListOrphanBookings);
  const attach = useServerFn(adminAttachBooking);
  const orphans = useQuery({ queryKey: ORPHANS_KEY, queryFn: () => listOrphans(), enabled: open });
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
        Rattacher un RDV orphelin
      </Button>
    );
  }
  return (
    <div className="mt-2 rounded-md border border-border/60 p-2">
      {orphans.isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : (orphans.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun RDV orphelin.</p>
      ) : (
        <ul className="space-y-1">
          {orphans.data!.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span><BookingLine b={b} /> — {b.name ?? ""} {b.email}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!window.confirm(`Rattacher le RDV de ${b.email} à ce client ?`)) return;
                  try {
                    await attach({ data: { bookingId: b.id, targetUserId } });
                    toast.success("RDV rattaché.");
                    await qc.invalidateQueries({ queryKey: ORPHANS_KEY });
                    await qc.invalidateQueries({ queryKey: LIST_KEY });
                    onDone();
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                }}
              >
                Rattacher
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen(false)}>Fermer</Button>
    </div>
  );
}
