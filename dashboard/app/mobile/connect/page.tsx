import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { MobileConnectClient } from "@/app/mobile/connect/mobile-connect-client";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connect Buddie",
  description: "Securely connect the Buddie mobile companion.",
};

type MobileConnectPageProps = {
  searchParams?: {
    code_challenge?: string;
    state?: string;
    device_key?: string;
    platform?: string;
    device_name?: string;
    app_version?: string;
  };
};

export default async function MobileConnectPage({ searchParams }: MobileConnectPageProps) {
  const callbackPath = `/mobile/connect?${new URLSearchParams({
    code_challenge: searchParams?.code_challenge || "",
    state: searchParams?.state || "",
    device_key: searchParams?.device_key || "",
    platform: searchParams?.platform || "",
    device_name: searchParams?.device_name || "",
    app_version: searchParams?.app_version || "",
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
      platform={searchParams?.platform === "android" || searchParams?.platform === "ios" ? searchParams.platform : undefined}
      deviceName={searchParams?.device_name?.trim().slice(0, 64) || undefined}
      appVersion={searchParams?.app_version?.trim().slice(0, 32) || undefined}
    />
  );
}
