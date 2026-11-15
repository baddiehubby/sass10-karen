import { ImmersiveHomepage } from "@/components/immersive-homepage";
import SachaPanditPage from "@/app/sachapandit/page";
import { getTenantFromRequest } from "@/lib/tenant-request";

/** Uses headers()/cookies() via getTenantFromRequest — must not statically prerender. */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const tenant = getTenantFromRequest();
  if (tenant === "sachapandit") {
    return <SachaPanditPage />;
  }
  return <ImmersiveHomepage />;
}
