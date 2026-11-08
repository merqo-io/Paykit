"use client";

import { Printer } from "lucide-react";
import { Button } from "@merqo/ui/primitives";

export function PrintBookingButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      Print
    </Button>
  );
}
