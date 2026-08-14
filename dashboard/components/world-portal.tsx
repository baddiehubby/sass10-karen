"use client";

import Link from "next/link";

type WorldPortalProps = {
  href: string;
  label: string;
  hint: string;
};

export function WorldPortal({ href, label, hint }: WorldPortalProps) {
  return (
    <Link href={href} className="world-portal group mt-8 block w-full text-left">
      <span className="block text-[10px] uppercase tracking-[0.24em] text-white/35">{hint}</span>
      <span className="mt-1 block text-sm text-white/80 group-hover:text-white">{label}</span>
    </Link>
  );
}
