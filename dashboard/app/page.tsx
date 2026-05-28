import { ImmersiveHomepage } from "@/components/immersive-homepage";
import SachaPanditPage from "@/app/sachapandit/page";
import { getTenantFromRequest } from "@/lib/tenant-request";

export default function HomePage() {
  const tenant = getTenantFromRequest();
  if (tenant === "sachapandit") {
    return <SachaPanditPage />;
  }
  return <ImmersiveHomepage />;
}
