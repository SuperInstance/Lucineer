"use client";

import { useEffect, useState } from "react";
import { useAds } from "./AdProvider";
import { Button } from "@/components/ui/button";

export function AdConsent() {
  const { hasConsent, setConsent } = useAds();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("lucineer_ad_consent");
    if (stored !== null) setDismissed(true);
  }, []);

  if (dismissed || hasConsent) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-card border-t border-border">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          Lucineer is free to use. We show optional ads to support the platform.
          You can use BYOC mode or a Premium account to go ad-free. By
          accepting, you allow non-personalised ads.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setConsent(false);
              setDismissed(true);
            }}
          >
            No ads
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setConsent(true);
              setDismissed(true);
            }}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
