import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { CONTACT_EMAIL } from "@/lib/config";

interface Props {
  name?: string;
}

const Email = ({ name }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nous avons bien reçu votre configuration — Lucie est en préparation</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <div style={eyebrow}>Installation · En cours</div>
          <Heading style={h1}>Installation de Lucie en cours</Heading>
          <Text style={text}>{name ? `Bonjour ${name},` : "Bonjour,"}</Text>
          <Text style={text}>
            Nous avons bien reçu votre configuration. Merci pour la précision de vos réponses :
            elles nous permettent de personnaliser Lucie au plus près de votre activité.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Étape en cours</Text>
            <Text style={cardValue}>Paramétrage et personnalisation de votre assistante</Text>
          </Section>
          <Text style={text}>
            Notre équipe prépare vos scénarios d'appel, votre accueil et vos règles de transfert.
            Vous n'avez rien à faire pour l'instant.
          </Text>
          <Text style={text}>
            Vous recevrez un email dès que votre Lucie sera prête à être testée.
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
  subject: "Installation de Lucie en cours",
  displayName: "Installation en cours",
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
