import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

// Anon client mimicking direct browser access with the publishable key.
const anon = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
        h.delete("Authorization");
      }
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    },
  },
});

// A row is "blocked" when the anon client either gets a permission error
// or an empty result set (RLS filters silently). Any leaked row fails.
const PROTECTED_TABLES = [
  "bookings",
  "preparation_submissions",
  "shared_diagnostics",
] as const;

describe("RLS blocks direct anon access to sensitive tables", () => {
  for (const table of PROTECTED_TABLES) {
    it(`SELECT on ${table} returns no rows or a permission error`, async () => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      if (error) {
        expect(error.code === "42501" || /permission denied|not authorized|policy/i.test(error.message)).toBe(true);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it(`INSERT on ${table} is rejected`, async () => {
      const { error } = await anon.from(table).insert({}).select();
      expect(error).not.toBeNull();
    });

    it(`UPDATE on ${table} is rejected or affects no rows`, async () => {
      const { data, error } = await anon
        .from(table)
        .update({ updated_at: new Date().toISOString() } as never)
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select();
      if (!error) expect(data ?? []).toHaveLength(0);
    });

    it(`DELETE on ${table} is rejected or affects no rows`, async () => {
      const { data, error } = await anon
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select();
      if (!error) expect(data ?? []).toHaveLength(0);
    });
  }
});