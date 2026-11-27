"use client";

import { useRef, useState, type RefObject } from "react";
import {
  Journey,
  JourneyStep,
  PhoneFrame,
  PressButton,
  usePrefersReducedMotion,
  useScrollPlay,
} from "@merqo/ui";

import { BankScreen, PayScreen, VendorScreen } from "./pay-screen";
import { CONTAINER } from "./rhythm";

// Sized to the played content so no phone sits mostly empty.
const PHONE = "h-[290px] w-full min-w-0 sm:w-[210px]";
const STAGE =
  "grid grid-cols-2 justify-items-center gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-4";

/**
 * One step's play head. Scroll plays the step and rewinds it. A tap plays it
 * as an override that lapses as soon as the scroll position moves to another
 * step, so scrolling back up still rewinds. Under reduced motion nothing
 * animates with scroll: the step waits in its first state and only a tap
 * plays it.
 */
function useStepPlay(ref: RefObject<HTMLElement | null>) {
  const reduced = usePrefersReducedMotion();
  const scrollStep = useScrollPlay(ref, 1);
  const [tappedAt, setTappedAt] = useState<number | null>(null);
  if (tappedAt !== null && !reduced && tappedAt !== scrollStep) {
    setTappedAt(null);
  }
  const scrolled = !reduced && scrollStep >= 1;
  return {
    played: scrolled || tappedAt !== null,
    play: () => setTappedAt(scrollStep),
  };
}

function StepOneStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played, play } = useStepPlay(ref);
  return (
    <div ref={ref} className={STAGE}>
      <PhoneFrame label="Customer's pay page" size="small" className={PHONE}>
        <PayScreen status="pending" compact />
      </PhoneFrame>
      <PhoneFrame label="Customer's bank app" size="small" className={PHONE}>
        <BankScreen
          sent={played}
          action={
            played ? undefined : (
              <PressButton onClick={play} className="h-11 text-sm">
                Pay S$7.80
              </PressButton>
            )
          }
        />
      </PhoneFrame>
    </div>
  );
}

function StepTwoStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played, play } = useStepPlay(ref);
  return (
    <div ref={ref} className={STAGE}>
      <PhoneFrame label="Customer's phone" size="small" className={PHONE}>
        <PayScreen
          status={played ? "claimed" : "pending"}
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
        <VendorScreen status={played ? "claimed" : "pending"} />
      </PhoneFrame>
    </div>
  );
}

function StepThreeStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { played, play } = useStepPlay(ref);
  return (
    <div ref={ref} className={STAGE}>
      <PhoneFrame label="Customer's phone" size="small" className={PHONE}>
        <PayScreen status="claimed" compact />
      </PhoneFrame>
      <PhoneFrame label="Vendor's screen" size="small" className={PHONE}>
        <VendorScreen
          status={played ? "confirmed" : "claimed"}
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
            say="The order moves to Marked paid and you see it. Nothing counts as received yet."
            stage={<StepTwoStage />}
          />
          <JourneyStep
            label="Step 3"
            heading="You check your bank and confirm."
            say="Once you see the money land, you confirm. Only then is the order Received."
            stage={<StepThreeStage />}
          />
        </Journey>
      </div>
    </div>
  );
}
