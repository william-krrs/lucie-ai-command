import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { CONTACT_EMAIL } from "@/lib/config";

interface Props {
  name?: string;
  meetingDateLabel: string;
  meetingTime?: string;
  calendarUrl?: string;
}

const Email = ({ name, meetingDateLabel, meetingTime, calendarUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre rendez-vous Lucie est demain — {meetingDateLabel}{meetingTime ? ` à ${meetingTime}` : ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <div style={eyebrow}>Rappel · J-1</div>
          <Heading style={h1}>Votre rendez-vous Lucie est demain</Heading>
          <Text style={text}>{name ? `Bonjour ${name},` : "Bonjour,"}</Text>
          <Text style={text}>
            Petit rappel amical : nous avons rendez-vous <strong>{meetingDateLabel}</strong>
            {meetingTime ? ` à ${meetingTime}` : ""} pour finaliser votre projet Lucie.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Rendez-vous</Text>
            <Text style={cardValue}>{meetingDateLabel}{meetingTime ? ` · ${meetingTime}` : ""}</Text>
          </Section>
          <Text style={text}>
            Préparez si possible : votre numéro professionnel, vos horaires d'ouverture,
            et une idée de vos scénarios prioritaires. Tout se fait en visio.
          </Text>
          {calendarUrl && (
            <Button href={calendarUrl} style={btn}>Voir / modifier le RDV</Button>
          )}
          <Hr style={hr} />
          <Text style={muted}>
            Une question ? Répondez à cet email ou écrivez à {CONTACT_EMAIL}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Rappel : votre RDV Lucie est demain (${d.meetingDateLabel})`,
  displayName: "Rappel 24h avant le RDV",
  previewData: { name: "Jane", meetingDateLabel: "vendredi 15 août 2026", meetingTime: "10:00" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#7a5cff", fontWeight: 600 };
const h1 = { fontSize: "22px", lineHeight: "28px", color: "#0b0b1a", margin: "8px 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "10px 0" };
const card = { border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px 18px", margin: "16px 0", background: "#faf9ff" };
const cardLabel = { fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#6b7280", margin: 0 };
const cardValue = { fontSize: "16px", fontWeight: 600, color: "#0b0b1a", margin: "4px 0 0" };
const btn = { background: "#0b0b1a", color: "#ffffff", padding: "12px 18px", borderRadius: "12px", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-block", marginTop: "8px" };
const hr = { borderColor: "#eee", margin: "24px 0" };
const muted = { fontSize: "12px", color: "#6b7280" };