import { ImmersiveHomepage } from "@/components/immersive-homepage";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenantByHost } from "@/lib/tenant";

export default function HomePage() {
  const host = headers().get("host");
  if (resolveTenantByHost(host) === "sachapandit") {
    redirect("/sachapandit");
  }
  return <ImmersiveHomepage />;
}
