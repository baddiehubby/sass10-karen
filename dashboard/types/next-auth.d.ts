import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      onboardingCompleted?: boolean;
      companionName?: string;
      personality?: string;
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    onboardingCompleted?: boolean;
    companionName?: string;
    personality?: string;
    isAdmin?: boolean;
  }
}
