import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";

/**
 * The phone's back camera, reading the QR code on a guest's Luma ticket. It
 * calls `onScan` with the first code it reads, then stops. The scanner is
 * loaded only when it's opened.
 */
export default function TicketScanner({ onScan, onCancel }: { onScan: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: QrScanner | null = null;
    let done = false;
    (async () => {
      const { default: Scanner } = await import("qr-scanner");
      if (done || !video.current) return;
      scanner = new Scanner(
        video.current,
        (result) => {
          if (done) return;
          done = true;
          scanner?.stop();
          onScan(result.data);
        },
        { preferredCamera: "environment", returnDetailedScanResult: true, maxScansPerSecond: 10 },
      );
      try {
        await scanner.start();
      } catch {
        if (!done) setError("The camera didn't start. Allow camera access for this site, or search by name.");
      }
    })();
    return () => {
      done = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="mt-4 space-y-3 rounded-md border border-border bg-card p-4" data-testid="panel-ticket-scanner">
      <p className="text-sm text-muted-foreground">Point the camera at the QR code on the guest's Luma ticket.</p>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-md bg-black">
          <video ref={video} muted playsInline className="h-full w-full object-cover" />
          {/* Where to hold the code: the middle, where it's read. */}
          <div className="pointer-events-none absolute inset-[16%] rounded-lg border-4 border-primary/80" />
        </div>
      )}
      <Button variant="outline" className="min-h-11 w-full" onClick={onCancel} data-testid="button-cancel-scan">
        Cancel
      </Button>
    </div>
  );
}
