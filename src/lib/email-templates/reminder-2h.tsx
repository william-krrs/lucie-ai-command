import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  meetingDateLabel: string;
  meetingTime?: string;
  calendarUrl?: string;
}

const Email = ({ name, meetingDateLabel, meetingTime, calendarUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ça commence dans 2h — RDV Lucie {meetingTime ?? ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <div style={eyebrow}>Rappel · Dans 2 heures</div>
          <Heading style={h1}>À tout à l'heure {name ? name : ""} 👋</Heading>
          <Text style={text}>
            Petit rappel : nous nous retrouvons <strong>aujourd'hui{meetingTime ? ` à ${meetingTime}` : ""}</strong>
            {" "}pour votre rendez-vous Lucie.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Rendez-vous</Text>
            <Text style={cardValue}>{meetingDateLabel}{meetingTime ? ` · ${meetingTime}` : ""}</Text>
          </Section>
          <Text style={text}>
            Rejoignez la visio depuis l'invitation Calendly reçue lors de votre réservation.
            Prévoyez un environnement calme et un casque pour un son optimal.
          </Text>
          {calendarUrl && (
            <Button href={calendarUrl} style={btn}>Ouvrir l'invitation</Button>
          )}
          <Hr style={hr} />
          <Text style={muted}>
            Un imprévu ? Répondez à cet email ou écrivez à contact@lucieassistant.fr — nous replanifierons rapidement.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Props) => `Dans 2h : votre RDV Lucie${d.meetingTime ? ` (${d.meetingTime})` : ""}`,
  displayName: "Rappel 2h avant le RDV",
  previewData: { name: "Jane", meetingDateLabel: "aujourd'hui", meetingTime: "10:00" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#e11d48", fontWeight: 600 };
const h1 = { fontSize: "22px", lineHeight: "28px", color: "#0b0b1a", margin: "8px 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "10px 0" };
const card = { border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px 18px", margin: "16px 0", background: "#fff5f7" };
const cardLabel = { fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#6b7280", margin: 0 };
const cardValue = { fontSize: "16px", fontWeight: 600, color: "#0b0b1a", margin: "4px 0 0" };
const btn = { background: "#0b0b1a", color: "#ffffff", padding: "12px 18px", borderRadius: "12px", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-block", marginTop: "8px" };
const hr = { borderColor: "#eee", margin: "24px 0" };
const muted = { fontSize: "12px", color: "#6b7280" };