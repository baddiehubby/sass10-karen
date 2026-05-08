import type { Metadata } from "next";
import { LoginCard } from "@/components/login-card";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Buddie AI to manage your Buddy widget and emotional analytics dashboard.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() || "";
  return <LoginCard nextAuthUrl={nextAuthUrl} />;
}
