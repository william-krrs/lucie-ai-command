import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  useMatches,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LucieProvider } from "@/lib/lucie-store";
import { BookingProvider } from "@/lib/booking-store";
import { JourneyAccessProvider } from "@/lib/journey-access";
import { AppShell } from "@/components/app-shell";
import { AnonAuthBootstrap } from "@/components/anon-auth-bootstrap";

if (typeof window !== "undefined") {
  const reloadOnChunkError = (message: string) => {
    if (
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Importing a module script failed/i.test(message) ||
      /ChunkLoadError/i.test(message)
    ) {
      const key = "__lucie_chunk_reload__";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  };
  window.addEventListener("error", (e) => reloadOnChunkError(e.message || ""));
  window.addEventListener("unhandledrejection", (e) =>
    reloadOnChunkError(String((e.reason && (e.reason.message || e.reason)) || ""))
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Accueil — Lucie" },
      {
        name: "description",
        content:
          "L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires.",
      },
      { name: "author", content: "Spark Media Marketing" },
      { property: "og:title", content: "Accueil — Lucie" },
      {
        property: "og:description",
        content: "L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lucie Command Center" },
      { property: "og:url", content: "https://lucie-ai-command.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Accueil — Lucie" },
      { name: "twitter:description", content: "L'assistante IA qui répond à vos appels, qualifie vos prospects et vous aide à générer plus de chiffre d'affaires." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ba208f51-9fc4-40c3-ace2-04d15fed8b37/id-preview-1c17b07a--cfb4238d-d6e6-492e-a4a0-9d09593f08d2.lovable.app-1784733743990.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ba208f51-9fc4-40c3-ace2-04d15fed8b37/id-preview-1c17b07a--cfb4238d-d6e6-492e-a4a0-9d09593f08d2.lovable.app-1784733743990.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Lucie",
          url: "https://lucie-ai-command.lovable.app",
          description:
            "Assistante IA vocale qui répond aux appels, qualifie les prospects et prend les rendez-vous.",
          publisher: { "@type": "Organization", name: "Spark Media Marketing" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const matches = useMatches();
  const isStandalone = matches.some(
    (m) => m.routeId?.startsWith("/d/") || m.routeId === "/demo",
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LucieProvider>
        <BookingProvider>
          <JourneyAccessProvider>
          <AnonAuthBootstrap />
          {isStandalone ? (
            <Outlet />
          ) : (
            <AppShell>
              <Outlet />
            </AppShell>
          )}
          </JourneyAccessProvider>
        </BookingProvider>
      </LucieProvider>
    </QueryClientProvider>
  );
}
