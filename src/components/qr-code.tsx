import { useEffect, useState } from "react";
import { Download, QrCode as QrIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrCodeCardProps {
  /** URL to encode in the QR code. */
  url: string;
  /** Accessible label describing the QR code. */
  label?: string;
  /** Optional company name to include in the filename when downloading. */
  companyName?: string;
}

export function QrCodeCard({
  url,
  label = "QR code du diagnostic partagé",
  companyName,
}: QrCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setDataUrl(null);

    import("qrcode")
      .then((qr) =>
        qr.toDataURL(url, {
          width: 320,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        })
      )
      .then((data) => {
        if (!cancelled) setDataUrl(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de générer le QR code"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const safeName = (companyName || "diagnostic")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-code-lucie-${safeName}.png`;
    a.click();
  };

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-start"
      aria-label={label}
    >
      <div className="grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code pointant vers ${url}`}
            className="h-full w-full object-contain"
          />
        ) : error ? (
          <span className="text-center text-[10px] text-muted-foreground">
            {error}
          </span>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <QrIcon className="h-4 w-4 text-primary" />
          Scannez pour ouvrir le diagnostic
        </div>
        <p className="text-xs text-muted-foreground">
          Utilisez l’appareil photo de votre téléphone ou une application QR
          pour accéder instantanément au lien partagé.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={handleDownload}
          disabled={!dataUrl}
          aria-label="Télécharger le QR code en PNG"
        >
          {dataUrl ? (
            <>
              <Download className="mr-1.5 h-4 w-4" /> Télécharger le QR code
            </>
          ) : (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Génération…
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
