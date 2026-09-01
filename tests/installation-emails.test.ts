import { describe, it, expect, vi, beforeEach } from "vitest";

const sent: { template: string; to: string; data: any }[] = [];

vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: async (template: string, to: string, opts: any) => {
    sent.push({ template, to, data: opts.templateData });
    return { sent: true };
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "client@example.com", user_metadata: { full_name: "Jane" } } },
          error: null,
        }),
      },
    },
  },
}));

const { notifyInstallationStatusChange } = await import("@/lib/installation-emails.server");

beforeEach(() => {
  sent.length = 0;
});

describe("emails d'avancement d'installation", () => {
  it("not_started -> in_progress envoie 1 email", async () => {
    await notifyInstallationStatusChange("u1", "not_started", "in_progress");
    expect(sent.map((s) => s.template)).toEqual(["installation-in-progress"]);
  });

  it("in_progress -> in_progress n'envoie rien", async () => {
    await notifyInstallationStatusChange("u1", "in_progress", "in_progress");
    expect(sent).toHaveLength(0);
  });

  it("in_progress -> ready_for_test envoie 1 email avec le CTA /rdv-test", async () => {
    await notifyInstallationStatusChange("u1", "in_progress", "ready_for_test");
    expect(sent).toHaveLength(1);
    expect(sent[0].template).toBe("installation-ready-for-test");
    expect(sent[0].data.ctaUrl).toBe("https://diagnostic.lucieassistant.fr/rdv-test");
  });

  it("ready_for_test -> ready_for_test n'envoie rien", async () => {
    await notifyInstallationStatusChange("u1", "ready_for_test", "ready_for_test");
    expect(sent).toHaveLength(0);
  });

  it("ready_for_test -> live envoie 1 email", async () => {
    await notifyInstallationStatusChange("u1", "ready_for_test", "live");
    expect(sent.map((s) => s.template)).toEqual(["installation-live"]);
  });

  it("live -> live n'envoie rien", async () => {
    await notifyInstallationStatusChange("u1", "live", "live");
    expect(sent).toHaveLength(0);
  });

  it("retour à not_started n'envoie aucun email", async () => {
    await notifyInstallationStatusChange("u1", "live", "not_started");
    expect(sent).toHaveLength(0);
  });
});
