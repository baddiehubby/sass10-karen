"use client";

type BuddyGreetingProps = {
  line: string;
};

export function BuddyGreeting({ line }: BuddyGreetingProps) {
  return <p className="max-w-sm text-center text-base font-light tracking-wide text-white/80 md:text-lg">{line}</p>;
}
