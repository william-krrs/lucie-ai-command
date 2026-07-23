import type { Booking } from "@/lib/booking-store";

type Row = Record<string, string | number | null | undefined>;

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  // BOM for Excel compatibility with accents.
  return "\uFEFF" + lines.join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PREPARATION_KEY = "lucie:preparation";

function readPreparation(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PREPARATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type CrmExportPayload = {
  booking: Booking | null;
  plan?: string | null;
};

function buildRow(payload: CrmExportPayload): Row {
  const prep = readPreparation() ?? {};
  const b = payload.booking;
  const now = new Date().toISOString();
  const get = (k: string) => (typeof prep[k] === "string" ? (prep[k] as string) : "");

  return {
    exported_at: now,
    plan: payload.plan ?? (typeof prep.plan === "string" ? (prep.plan as string) : ""),
    // Contact
    contact_name: get("contactName") || b?.user?.name || b?.inviteeName || "",
    contact_email: get("contactEmail") || b?.user?.email || "",
    company_name: get("companyName"),
    company_phone: get("companyPhone"),
    website: get("website"),
    // Booking
    rdv_date: b?.date ?? "",
    rdv_time: b?.time ?? "",
    rdv_status: b?.status ?? "",
    rdv_created_at: b?.createdAt ?? "",
    rdv_updated_at: b?.updatedAt ?? "",
    // Questionnaire
    call_volume: get("callVolume"),
    interlocutor: get("interlocutor"),
    greeting: get("greeting"),
    location: get("location"),
    tone: get("tone"),
    services: get("services"),
    emergency_number: get("emergencyNumber"),
    emergency_criteria: get("emergencyCriteria"),
    opening_hours: get("openingHours"),
    rdv_link: get("rdvLink"),
    required_info: get("requiredInfo"),
    tech_access: get("techAccess"),
    extra: get("extra"),
    prep_updated_at: typeof prep.updatedAt === "string" ? (prep.updatedAt as string) : "",
    submission_id: typeof prep.submissionId === "string" ? (prep.submissionId as string) : "",
  };
}

export function exportCrmCsv(payload: CrmExportPayload): { ok: boolean; empty: boolean } {
  const row = buildRow(payload);
  const hasContent = Object.entries(row).some(
    ([k, v]) => k !== "exported_at" && typeof v === "string" && v.trim().length > 0,
  );
  if (!hasContent) return { ok: false, empty: true };
  const csv = toCsv([row]);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = String(row.company_name || row.contact_email || "lucie")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "lucie";
  download(`lucie-crm-${slug}-${stamp}.csv`, csv);
  return { ok: true, empty: false };
}