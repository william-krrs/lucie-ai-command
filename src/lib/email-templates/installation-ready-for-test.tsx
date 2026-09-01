import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { CONTACT_EMAIL } from "@/lib/config";

interface Props {
  name?: string;
  /** URL interne du parcours (jamais un lien de réservation direct). */
  ctaUrl?: string;
}

const DEFAULT_CTA = "https://diagnostic.lucieassistant.fr/rdv-test";

const Email = ({ name, ctaUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre Lucie est prête — réservez votre test et paramétrage</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section>
          <div style={eyebrow}>Installation · Prête</div>
          <Heading style={h1}>Votre Lucie est prête à être testée</Heading>
          <Text style={text}>{name ? `Bonjour ${name},` : "Bonjour,"}</Text>
          <Text style={text}>
            Bonne nouvelle : votre assistante a été paramétrée selon votre configuration.
            Il ne reste plus qu'à la tester ensemble et à ajuster les derniers détails.
          </Text>
          <Section style={card}>
            <Text style={cardLabel}>Prochaine étape</Text>
            <Text style={cardValue}>Réserver votre rendez-vous Test &amp; paramétrage</Text>
          </Section>
          <Button href={ctaUrl ?? DEFAULT_CTA} style={btn}>
            Réserver mon test
          </Button>
          <Text style={muted}>
            Connectez-vous avec votre compte client : votre rendez-vous sera automatiquement
            rattaché à votre dossier.
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
  subject: "Votre Lucie est prête à être testée",
  displayName: "Lucie prête pour le test",
  previewData: { name: "Jane", ctaUrl: DEFAULT_CTA },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "-apple-system, Segoe UI, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#7a5cff", fontWeight: 600 };
const h1 = { fontSize: "22px", lineHeight: "28px", color: "#0b0b1a", margin: "8px 0 16px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#1f2937", margin: "10px 0" };
const card = { border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px 18px", margin: "16px 0", background: "#faf9ff" };
const cardLabel = { fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#6b7280", margin: 0 };
const cardValue = { fontSize: "16px", fontWeight: 600, color: "#0b0b1a", margin: "4px 0 0" };
const btn = { background: "#0b0b1a", color: "#ffffff", padding: "12px 18px", borderRadius: "12px", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-block", margin: "8px 0 12px" };
const hr = { borderColor: "#eee", margin: "24px 0" };
const muted = { fontSize: "12px", color: "#6b7280" };
