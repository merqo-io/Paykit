"use client";

import { useRef, useState, type RefObject } from "react";
import {
  Journey,
  JourneyStep,
  PhoneFrame,
  PressButton,
  useScrollPlay,
} from "@merqo/ui";

import { BankScreen, PayScreen, VendorScreen } from "./pay-screen";
import { CONTAINER } from "./rhythm";

// Taller than the shared "small" phone so the button fits under the status.
const PHONE = "h-[310px]";

/**
 * One step's play head. Scroll plays the step and rewinds it; a tap plays it
 * too, so the demo stays operable by touch and under reduced motion (where
 * the hook already reports every step complete).
 */
function useStepPlay(ref: RefObject<HTMLElement | null>) {
  const scrolled = useScrollPlay(ref, 1) >= 1;
  const [tapped, setTapped] = useState(false);
  return { played: scrolled || tapped, play: () => setTapped(true) };
}

function StepOneStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played } = useStepPlay(ref);
  return (
    <div ref={ref} className="flex flex-wrap justify-center gap-4">
      <PhoneFrame label="Customer's pay page" size="small" className={PHONE}>
        <PayScreen state="waiting" compact />
      </PhoneFrame>
      <PhoneFrame label="Customer's bank app" size="small" className={PHONE}>
        <BankScreen sent={played} />
      </PhoneFrame>
    </div>
  );
}

function StepTwoStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played, play } = useStepPlay(ref);
  return (
    <div ref={ref} className="flex flex-wrap justify-center gap-4">
      <PhoneFrame label="Customer's phone" size="small" className={PHONE}>
        <PayScreen
          state={played ? "paid" : "waiting"}
          compact
          action={
            played ? undefined : (
              <PressButton onClick={play} className="h-11 text-sm">
                I&apos;ve paid
              </PressButton>
            )
          }
        />
      </PhoneFrame>
      <PhoneFrame label="Vendor's screen" size="small" className={PHONE}>
        <VendorScreen state={played ? "paid" : "empty"} />
      </PhoneFrame>
    </div>
  );
}

function StepThreeStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played, play } = useStepPlay(ref);
  return (
    <div ref={ref} className="flex flex-wrap justify-center gap-4">
      <PhoneFrame label="Customer's phone" size="small" className={PHONE}>
        <PayScreen state={played ? "confirmed" : "paid"} compact />
      </PhoneFrame>
      <PhoneFrame label="Vendor's screen" size="small" className={PHONE}>
        <VendorScreen
          state={played ? "confirmed" : "paid"}
          action={
            played ? undefined : (
              <PressButton onClick={play} className="h-11 text-sm">
                Confirm payment
              </PressButton>
            )
          }
        />
      </PhoneFrame>
    </div>
  );
}

export function PaymentJourney() {
  return (
    <div className="border-t">
      <div className={CONTAINER}>
        <Journey
          id="how"
          title="One payment, three steps."
          className="max-w-none px-0"
        >
          <JourneyStep
            label="Step 1"
            heading="The customer scans and pays."
            say="Your PayNow QR opens in their own bank app. The money goes straight to your account."
            stage={<StepOneStage />}
          />
          <JourneyStep
            label="Step 2"
            heading="They tap I've paid."
            say="The order moves to Paid and you see it. Nothing is settled yet."
            stage={<StepTwoStage />}
          />
          <JourneyStep
            label="Step 3"
            heading="You check your bank and confirm."
            say="Once you see the money land, you confirm. The customer's screen updates."
            stage={<StepThreeStage />}
          />
        </Journey>
      </div>
    </div>
  );
}
