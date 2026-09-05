import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { MobileConnectClient } from "@/app/mobile/connect/mobile-connect-client";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connect Buddie for Android",
  description: "Securely connect the Buddie Android companion.",
};

type MobileConnectPageProps = {
  searchParams?: {
    code_challenge?: string;
    state?: string;
    device_key?: string;
  };
};

export default async function MobileConnectPage({ searchParams }: MobileConnectPageProps) {
  const callbackPath = `/mobile/connect?${new URLSearchParams({
    code_challenge: searchParams?.code_challenge || "",
    state: searchParams?.state || "",
    device_key: searchParams?.device_key || "",
  }).toString()}`;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  return (
    <MobileConnectClient
      codeChallenge={searchParams?.code_challenge || ""}
      state={searchParams?.state || ""}
      devicePublicKey={searchParams?.device_key || ""}
    />
  );
}
