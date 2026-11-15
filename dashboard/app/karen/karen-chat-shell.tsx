"use client";

import dynamic from "next/dynamic";
import { KarenChatSkeleton } from "./karen-chat-skeleton";

const KarenChatClient = dynamic(
  () => import("./karen-chat-client").then((m) => ({ default: m.KarenChatClient })),
  {
    ssr: false,
    loading: () => <KarenChatSkeleton />,
  },
);

type KarenChatShellProps = {
  initialIsPremium?: boolean;
  initialChatCount?: number;
  isSignedIn?: boolean;
};

/** Client boundary: dark skeleton until the chat bundle hydrates. */
export function KarenChatShell({
  initialIsPremium = false,
  initialChatCount = 0,
  isSignedIn = false,
}: KarenChatShellProps) {
  return (
    <KarenChatClient
      initialIsPremium={initialIsPremium}
      initialChatCount={initialChatCount}
      isSignedIn={isSignedIn}
    />
  );
}
