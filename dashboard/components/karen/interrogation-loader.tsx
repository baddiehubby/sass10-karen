"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { LoadingScreen } from "@/components/karen/loading-screen";
import { VipTrustGate } from "@/components/karen/vip-trust-gate";
import { WakeKarenGate } from "@/components/karen/wake-karen-gate";
import { KarenChatShell } from "@/app/karen/karen-chat-shell";
import { PLANNER_FAILED_TASK_QUERY } from "@/lib/karen/planner";
import {
  markVipTrustWelcomeComplete,
  readVipTrustState,
} from "@/lib/karen/vip-trust";

type InterrogationLoaderProps = {
  initialIsPremium?: boolean;
  initialChatCount?: number;
  isSignedIn?: boolean;
};

/**
 * Audio unlock → VIP Trust gold welcome (first visit) → roast stage.
 * First open: soft VipTrustGate only (no aggressive ENTER THE ROAST).
 * `?failedTask=` skips soft onboarding and goes straight into the fight.
 */
function InterrogationLoaderInner({
  initialIsPremium = false,
  initialChatCount = 0,
  isSignedIn = false,
}: InterrogationLoaderProps) {
  const searchParams = useSearchParams();
  const fromFailedTask = Boolean(
    searchParams.get(PLANNER_FAILED_TASK_QUERY)?.trim(),
  );
  const [needsVipWelcome] = useState(() => {
    if (fromFailedTask) return false;
    return !readVipTrustState().welcomeComplete;
  });
  const [audioReady, setAudioReady] = useState(false);
  const [trustReady, setTrustReady] = useState(() => {
    if (fromFailedTask) return true;
    return readVipTrustState().welcomeComplete;
  });
  const [ready, setReady] = useState(false);
  const onComplete = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (fromFailedTask) {
      setTrustReady(true);
      return;
    }
    if (readVipTrustState().welcomeComplete) setTrustReady(true);
  }, [fromFailedTask]);

  // First visit — luxurious VIP Trust gate unlocks audio itself (no aggressive wake).
  if (needsVipWelcome && !trustReady) {
    return (
      <VipTrustGate
        onEnter={() => {
          markVipTrustWelcomeComplete();
          setAudioReady(true);
          setTrustReady(true);
          setReady(true);
        }}
      />
    );
  }

  if (!audioReady) {
    return (
      <WakeKarenGate
        onReady={() => {
          setAudioReady(true);
          if (fromFailedTask) {
            setTrustReady(true);
            setReady(true);
          }
        }}
      />
    );
  }

  if (!trustReady && !fromFailedTask) {
    return (
      <VipTrustGate
        onEnter={() => {
          markVipTrustWelcomeComplete();
          setTrustReady(true);
          setReady(true);
        }}
      />
    );
  }

  if (!ready) {
    return <LoadingScreen onComplete={onComplete} />;
  }

  return (
    <KarenChatShell
      initialIsPremium={initialIsPremium}
      initialChatCount={initialChatCount}
      isSignedIn={isSignedIn}
    />
  );
}

export function InterrogationLoader(props: InterrogationLoaderProps) {
  return (
    <Suspense
      fallback={
        <div className="karen-vh flex w-full items-center justify-center bg-black text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <InterrogationLoaderInner {...props} />
    </Suspense>
  );
}
