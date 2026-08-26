import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { StepNav } from "@/components/step-nav";
import { BookingEmbed } from "@/components/booking-embed";
import { LockedPage } from "@/components/locked-page";
import { useJourneyAccess } from "@/lib/journey-access";
import { BOOKING_URL_SETUP } from "@/lib/config";

export const Route = createFileRoute("/rdv-test")({
  head: () => ({
    meta: [
      { title: "RDV Test & paramétrage — Lucie" },
      {
        name: "description",
        content:
          "Réservez le rendez-vous de test et de paramétrage de Lucie après l'installation.",
      },
      { property: "og:title", content: "RDV Test & paramétrage — Lucie" },
      {
        property: "og:description",
        content: "Validez la configuration finale de votre assistante Lucie.",
      },
      {
        property: "og:url",
        content: "https://lucie-ai-command.lovable.app/rdv-test",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://lucie-ai-command.lovable.app/rdv-test",
      },
    ],
  }),
  component: RdvTest,
});

function RdvTest() {
  const { canBookSetupTest } = useJourneyAccess();
  if (!canBookSetupTest) {
    return (
      <LockedPage
        title="RDV Test & paramétrage verrouillé"
        step="RDV Test & paramétrage"
        description="Ce rendez-vous se débloque dès que votre installation est prête pour la phase de test."
        waitingFor="step"
        waitingTitle="Installation en cours"
        waitingText="Dès que votre installation passe au statut « prête pour le test », le calendrier de mise en service s'ouvre automatiquement ici."
        backTo="/installation"
        backLabel="Suivre mon installation"
      />

    );
  }
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Étape 10 · Test & paramétrage"
        title="Réservez votre RDV de mise en service"
        description="Une session dédiée avec l'équipe Lucie pour tester votre assistante en conditions réelles, valider les scénarios et finaliser le paramétrage."
      />
      <BookingEmbed
        bookingType="setup_test"
        url={BOOKING_URL_SETUP}
        eyebrow="RDV Test & paramétrage"
        title="Choisissez un créneau pour la mise en service"
        description="Ce rendez-vous a lieu après l'installation. Nous testons ensemble le comportement de Lucie, ajustons les réponses et validons les scénarios critiques."
        bookedTitle="RDV Test & paramétrage confirmé"
        bookedDescription="Nous nous retrouverons ce jour-là pour valider ensemble la mise en service de votre assistante."
      />
      <StepNav current="/rdv-test" />
    </div>
  );
}