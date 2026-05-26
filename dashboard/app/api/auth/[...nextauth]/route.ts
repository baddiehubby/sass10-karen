import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuthUrlDebug, pinNextAuthUrl } from "@/lib/site-url";

pinNextAuthUrl();
logAuthUrlDebug("route");

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
