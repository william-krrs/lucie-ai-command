import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { CONTACT_EMAIL } from "@/lib/config";

interface Props {
  name?: string;
}

const Email = ({ name }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre assistante Lucie est désormais en ligne</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <div style={eyebrow}>Installation · Terminée</div>
          <Heading style={h1}>Lucie est en ligne ✅</Heading>
          <Text style={text}>{name ? `Bonjour ${name},` : "Bonjour,"}</Text>
          <Text style={text}>
            Votre installation est terminée : Lucie est désormais opérationnelle et répond
            à vos appels selon la configuration validée ensemble.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Statut</Text>
            <Text style={cardValue}>Assistante active — appels pris en charge</Text>
          </Section>
          <Text style={text}>
            Nous restons disponibles pour affiner ses réponses, ajouter des scénarios ou
            ajuster vos horaires à tout moment.
          </Text>
          <Hr style={hr} />
          <Text style={muted}>Une question ? Répondez à cet email ou écrivez à {CONTACT_EMAIL}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Lucie est en ligne ✅",
  displayName: "Lucie en ligne",
  previewData: { name: "Jane" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#7a5cff", fontWeight: 600 };
const h1 = { fontSize: "22px", lineHeight: "28px", color: "#0b0b1a", margin: "8px 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "10px 0" };
const card = { border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px 18px", margin: "16px 0", background: "#faf9ff" };
const cardLabel = { fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#6b7280", margin: 0 };
const cardValue = { fontSize: "16px", fontWeight: 600, color: "#0b0b1a", margin: "4px 0 0" };
const hr = { borderColor: "#eee", margin: "24px 0" };
const muted = { fontSize: "12px", color: "#6b7280" };
