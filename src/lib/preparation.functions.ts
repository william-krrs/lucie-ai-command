import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const submissionSchema = z.object({
  plan: z.string().max(50).optional().nullable(),
  compatibilityScore: z.number().int().min(0).max(100).optional().nullable(),
  compatibilityTier: z.enum(["excellent", "compatible", "limited", "refuse"]).optional().nullable(),
  recommendedPlan: z.enum(["essential", "pro", "premium"]).optional().nullable(),
  priority: z.enum(["high", "medium", "low"]).optional().nullable(),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(200),
  companyName: z.string().trim().min(1).max(200),
  companyPhone: z.string().trim().min(1).max(60),
  website: z.string().max(400).optional().nullable(),
  callVolume: z.string().trim().min(1).max(200),
  interlocutor: z.string().trim().min(1).max(200),
  greeting: z.string().trim().min(1).max(1000),
  location: z.string().trim().min(1).max(300),
  tone: z.string().trim().min(1).max(50),
  services: z.string().trim().min(1).max(2000),
  emergencyNumber: z.string().trim().min(1).max(60),
  emergencyCriteria: z.string().max(1500).optional().nullable(),
  openingHours: z.string().trim().min(1).max(300),
  rdvLink: z.string().trim().min(1).max(400),
  requiredInfo: z.string().trim().min(1).max(1500),
  techAccess: z.string().max(1500).optional().nullable(),
  extra: z.string().max(1500).optional().nullable(),
  summary: z.string().min(1).max(20000),
});

export type PreparationSubmissionInput = z.infer<typeof submissionSchema>;

export const submitPreparation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submissionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("preparation_submissions")
      .insert({
        plan: data.plan ?? null,
        compatibility_score: data.compatibilityScore ?? null,
        compatibility_tier: data.compatibilityTier ?? null,
        recommended_plan: data.recommendedPlan ?? null,
        priority: data.priority ?? null,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        company_name: data.companyName,
        company_phone: data.companyPhone,
        website: data.website ?? null,
        call_volume: data.callVolume,
        interlocutor: data.interlocutor,
        greeting: data.greeting,
        location: data.location,
        tone: data.tone,
        services: data.services,
        emergency_number: data.emergencyNumber,
        emergency_criteria: data.emergencyCriteria ?? null,
        opening_hours: data.openingHours,
        rdv_link: data.rdvLink,
        required_info: data.requiredInfo,
        tech_access: data.techAccess ?? null,
        extra: data.extra ?? null,
        summary: data.summary,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[submitPreparation] insert failed", error);
      throw new Error("Impossible d'enregistrer votre questionnaire. Réessayez.");
    }

    // Email dispatch is wired once the sender domain is configured.
    const emailStatus: "sent" | "skipped" | "failed" = "skipped";
    await supabaseAdmin
      .from("preparation_submissions")
      .update({ email_status: emailStatus })
      .eq("id", row.id);

    return { id: row.id as string, emailStatus };
  });