import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mode admin (CRM + déblocages manuels).
 *
 * Sécurité :
 * - identité = bearer vérifié (requireSupabaseAuth) ;
 * - autorisation = public.has_role(uid,'admin') via le client de l'utilisateur,
 *   AVANT de charger le client service-role ; sinon 403 ;
 * - toutes les entrées validées par zod ;
 * - chaque écriture est journalisée dans admin_audit_log.
 * - payment_status n'est jamais modifié, sauf par l'action explicite
 *   adminMarkPaidManual (confirmation obligatoire).
 */

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) {
    if (error) console.error("[admin-crm] has_role", error);
    setResponseStatus(403);
    throw new Error("Forbidden");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function audit(
  adminId: string,
  action: string,
  targetUserId: string | null,
  payload: Record<string, unknown>,
) {
  const db = await admin();
  const { error } = await db
    .from("admin_audit_log")
    .insert({ admin_id: adminId, action, target_user_id: targetUserId, payload });
  if (error) console.error("[admin-crm] audit", error);
}

export const OVERRIDE_PAGES = [
  "demonstration",
  "offers",
  "configuration",
  "installation",
  "setup_test",
] as const;
export type OverridePage = (typeof OVERRIDE_PAGES)[number];

export type CrmBooking = {
  id: string;
  type: string;
  status: string;
  meetingAt: string | null;
  email: string;
  name: string | null;
};

export type CrmRow = {
  key: string;
  userId: string | null;
  manualId: string | null;
  isAccount: boolean;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  lastBooking: CrmBooking | null;
  paymentStatus: string;
  paidPlan: string | null;
  demoCompletedAt: string | null;
  installationStatus: string;
  configurationSubmitted: boolean;
  stage: string;
  overrides: OverridePage[];
  updatedAt: string | null;
};

export type CrmDetail = {
  row: CrmRow;
  bookings: CrmBooking[];
  diagnostic: Record<string, unknown> | null;
  notes: { id: string; body: string; createdAt: string }[];
  history: { action: string; payload: unknown; createdAt: string }[];
};

const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function stageOf(r: Pick<CrmRow, "paymentStatus" | "configurationSubmitted" | "installationStatus" | "demoCompletedAt" | "lastBooking">) {
  if (r.installationStatus === "live") return "En service";
  if (r.installationStatus === "ready_for_test") return "Prêt pour le test";
  if (r.installationStatus === "in_progress") return "Installation en cours";
  if (r.configurationSubmitted) return "Configuration reçue";
  if (r.paymentStatus === "paid") return "Payé";
  if (r.demoCompletedAt) return "Démo faite";
  if (r.lastBooking) return "RDV pris";
  return "Diagnostic";
}

function toBooking(b: any): CrmBooking {
  return {
    id: b.id,
    type: b.booking_type,
    status: b.status_norm,
    meetingAt: b.meeting_at ?? null,
    email: b.email,
    name: b.name ?? null,
  };
}

async function loadRows(): Promise<{ rows: CrmRow[]; bookings: any[]; snapshots: any[] }> {
  const db = await admin();
  const users: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Lecture des comptes impossible.");
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }

  const [statesR, bookingsR, prepsR, manualR, ovR, snapR] = await Promise.all([
    db.from("journey_state").select("user_id, demo_completed_at, payment_status, paid_plan, installation_status, updated_at"),
    db
      .from("bookings")
      .select("id, user_id, booking_type, status_norm, meeting_at, email, name, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    db.from("preparation_submissions").select("user_id, contact_name, contact_email, company_name, company_phone, created_at").order("created_at", { ascending: false }),
    db.from("admin_clients").select("*").order("created_at", { ascending: false }),
    db.from("journey_overrides").select("user_id, page, unlocked"),
    db.from("diagnostic_snapshots").select("user_id, diagnostic, updated_at").order("updated_at", { ascending: false }),
  ]);

  const states = (statesR.data ?? []) as any[];
  const bookings = (bookingsR.data ?? []) as any[];
  const preps = (prepsR.data ?? []) as any[];
  const manual = (manualR.data ?? []) as any[];
  const ovs = (ovR.data ?? []) as any[];
  const snapshots = (snapR.data ?? []) as any[];

  const relevant = new Set<string>();
  for (const x of [...states, ...bookings, ...preps, ...manual, ...ovs, ...snapshots]) {
    if (x.user_id) relevant.add(x.user_id);
  }

  const rows: CrmRow[] = [];
  for (const u of users) {
    const isAccount = u.is_anonymous !== true && !!u.email;
    if (!isAccount && !relevant.has(u.id)) continue;
    const st = states.find((x) => x.user_id === u.id);
    const mine = bookings.filter((x) => x.user_id === u.id);
    const prep = preps.find((x) => x.user_id === u.id);
    const m = manual.find((x) => x.user_id === u.id);
    const snap = snapshots.find((x) => x.user_id === u.id)?.diagnostic ?? null;
    const base = {
      paymentStatus: st?.payment_status ?? "unpaid",
      configurationSubmitted: !!prep,
      installationStatus: st?.installation_status ?? "not_started",
      demoCompletedAt: st?.demo_completed_at ?? null,
      lastBooking: mine[0] ? toBooking(mine[0]) : null,
    };
    rows.push({
      key: `u:${u.id}`,
      userId: u.id,
      manualId: m?.id ?? null,
      isAccount,
      name: s(m?.name) ?? s(prep?.contact_name) ?? s(mine[0]?.name) ?? s(snap?.partnerName),
      company: s(m?.company) ?? s(prep?.company_name) ?? s(snap?.companyName),
      email: s(m?.email) ?? (isAccount ? u.email : null) ?? s(prep?.contact_email) ?? s(mine[0]?.email),
      phone: s(m?.phone) ?? s(prep?.company_phone) ?? s(mine.find((b) => b.phone)?.phone),
      trade: s(m?.trade) ?? s(snap?.activity),
      paidPlan: st?.paid_plan ?? null,
      ...base,
      stage: stageOf(base),
      overrides: ovs.filter((o) => o.user_id === u.id && o.unlocked).map((o) => o.page),
      updatedAt: st?.updated_at ?? mine[0]?.created_at ?? u.last_sign_in_at ?? u.created_at ?? null,
    });
  }

  for (const m of manual.filter((x) => !x.user_id)) {
    const mine = m.email
      ? bookings.filter((b) => (b.email ?? "").toLowerCase() === String(m.email).toLowerCase())
      : [];
    const base = {
      paymentStatus: "unpaid",
      configurationSubmitted: false,
      installationStatus: "not_started",
      demoCompletedAt: null,
      lastBooking: mine[0] ? toBooking(mine[0]) : null,
    };
    rows.push({
      key: `m:${m.id}`,
      userId: null,
      manualId: m.id,
      isAccount: false,
      name: m.name,
      company: m.company,
      email: m.email,
      phone: m.phone,
      trade: m.trade,
      paidPlan: null,
      ...base,
      stage: "Fiche manuelle",
      overrides: [],
      updatedAt: m.updated_at,
    });
  }

  rows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return { rows, bookings, snapshots };
}

const keySchema = z.string().regex(/^(u|m):[0-9a-f-]{36}$/i);
const uuid = z.string().uuid();

export const adminCrmList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmRow[]> => {
    await assertAdmin(context as unknown as Ctx);
    return (await loadRows()).rows;
  });

export const adminCrmGet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: keySchema }).parse(i))
  .handler(async ({ data, context }): Promise<CrmDetail | null> => {
    await assertAdmin(context as unknown as Ctx);
    const { rows, bookings, snapshots } = await loadRows();
    const row = rows.find((r) => r.key === data.key);
    if (!row) return null;
    const db = await admin();
    const mine = row.userId
      ? bookings.filter((b) => b.user_id === row.userId)
      : bookings.filter((b) => row.email && (b.email ?? "").toLowerCase() === row.email.toLowerCase());
    const [notesR, histR] = await Promise.all([
      db.from("client_notes").select("id, body, created_at").eq("client_key", data.key).order("created_at", { ascending: false }).limit(100),
      row.userId
        ? db.from("admin_audit_log").select("action, payload, created_at").eq("target_user_id", row.userId).order("created_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [] }),
    ]);
    return {
      row,
      bookings: mine.map(toBooking),
      diagnostic: row.userId ? snapshots.find((x) => x.user_id === row.userId)?.diagnostic ?? null : null,
      notes: ((notesR.data ?? []) as any[]).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at })),
      history: ((histR.data ?? []) as any[]).map((h) => ({ action: h.action, payload: h.payload, createdAt: h.created_at })),
    };
  });

const clientFields = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email().max(254).or(z.literal("")).optional().default(""),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/).optional().default(""),
  trade: z.string().trim().max(120).optional().default(""),
  userId: uuid.optional(),
});

export const adminCrmSaveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => clientFields.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const record = {
      name: data.name,
      company: data.company || null,
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone || null,
      trade: data.trade || null,
      created_by: ctx.userId,
    };
    let id: string;
    if (data.userId) {
      const { data: row, error } = await db
        .from("admin_clients")
        .upsert({ ...record, user_id: data.userId }, { onConflict: "user_id" })
        .select("id")
        .single();
      if (error) throw new Error("Enregistrement impossible.");
      id = row.id;
    } else {
      const { data: row, error } = await db.from("admin_clients").insert(record).select("id").single();
      if (error) throw new Error("Enregistrement impossible.");
      id = row.id;
    }
    await audit(ctx.userId, "client.save", data.userId ?? null, { manualId: id, ...record });
    return { key: data.userId ? `u:${data.userId}` : `m:${id}` };
  });

export const adminCrmAddNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: keySchema, body: z.string().trim().min(1).max(4000) }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const { error } = await db.from("client_notes").insert({ client_key: data.key, body: data.body, author_id: ctx.userId });
    if (error) throw new Error("Note non enregistrée.");
    const target = data.key.startsWith("u:") ? data.key.slice(2) : null;
    await audit(ctx.userId, "note.add", target, { key: data.key, length: data.body.length });
    return { ok: true };
  });

export const adminSetOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ targetUserId: uuid, pages: z.array(z.enum(OVERRIDE_PAGES)).min(1).max(5), unlocked: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const at = new Date().toISOString();
    const { error } = await db.from("journey_overrides").upsert(
      data.pages.map((page) => ({ user_id: data.targetUserId, page, unlocked: data.unlocked, by_admin: ctx.userId, at })),
      { onConflict: "user_id,page" },
    );
    if (error) {
      console.error("[admin-crm] overrides", error);
      throw new Error("Déblocage impossible.");
    }
    await audit(ctx.userId, data.unlocked ? "journey.unlock" : "journey.lock", data.targetUserId, { pages: data.pages });
    return { ok: true };
  });

async function upsertJourney(db: any, userId: string, patch: Record<string, unknown>) {
  const { data: existing } = await db.from("journey_state").select("id").eq("user_id", userId).maybeSingle();
  const res = existing
    ? await db.from("journey_state").update(patch).eq("id", existing.id)
    : await db.from("journey_state").insert({ user_id: userId, ...patch });
  if (res.error) {
    console.error("[admin-crm] journey write", res.error);
    throw new Error("Écriture du parcours impossible.");
  }
}

export const adminMarkDemoDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ targetUserId: uuid, done: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    await upsertJourney(db, data.targetUserId, { demo_completed_at: data.done ? new Date().toISOString() : null });
    await audit(ctx.userId, data.done ? "demo.done" : "demo.undone", data.targetUserId, {});
    return { ok: true };
  });

export const adminMarkPaidManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ targetUserId: uuid, plan: z.enum(["essential", "pro", "premium"]), confirm: z.literal("PAYE") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const { data: st } = await db.from("journey_state").select("payment_status").eq("user_id", data.targetUserId).maybeSingle();
    if (st?.payment_status === "paid") throw new Error("Ce client est déjà marqué payé.");
    await upsertJourney(db, data.targetUserId, {
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_plan: data.plan,
      stripe_session_id: "manual_admin",
    });
    await audit(ctx.userId, "payment.manual", data.targetUserId, { plan: data.plan });
    return { ok: true };
  });

export const adminListOrphanBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmBooking[]> => {
    await assertAdmin(context as unknown as Ctx);
    const db = await admin();
    const { data, error } = await db
      .from("bookings")
      .select("id, booking_type, status_norm, meeting_at, email, name")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Lecture des RDV impossible.");
    return ((data ?? []) as any[]).map(toBooking);
  });

export const adminAttachBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bookingId: uuid, targetUserId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertAdmin(ctx);
    const db = await admin();
    const { data: updated, error } = await db
      .from("bookings")
      .update({ user_id: data.targetUserId })
      .eq("id", data.bookingId)
      .is("user_id", null)
      .select("id");
    if (error) throw new Error("Rattachement impossible.");
    if (!updated || updated.length === 0) throw new Error("Ce RDV est déjà rattaché à un client.");
    await audit(ctx.userId, "booking.attach", data.targetUserId, { bookingId: data.bookingId });
    return { ok: true };
  });
