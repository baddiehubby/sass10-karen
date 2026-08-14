import type { PublicBond, SoulInteraction } from "@/lib/buddy-soul-types";

async function readBond(res: Response): Promise<PublicBond | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as { bond?: PublicBond };
  return data.bond ?? null;
}

export function publishSoul(bond: PublicBond) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("buddy-soul-updated", { detail: bond }));
}

export function subscribeSoul(onBond: (bond: PublicBond) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<PublicBond>).detail;
    if (detail) onBond(detail);
  };
  window.addEventListener("buddy-soul-updated", handler);
  return () => window.removeEventListener("buddy-soul-updated", handler);
}

export async function fetchBuddyPresence(): Promise<PublicBond | null> {
  try {
    const res = await fetch("/api/buddy/presence", { method: "POST" });
    const bond = await readBond(res);
    if (bond) publishSoul(bond);
    return bond;
  } catch {
    return null;
  }
}

export async function notifySoul(interaction: SoulInteraction, mood?: string): Promise<PublicBond | null> {
  try {
    const res = await fetch("/api/buddy/touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interaction, mood }),
    });
    const bond = await readBond(res);
    if (bond) publishSoul(bond);
    return bond;
  } catch {
    return null;
  }
}

export async function discoverBuddyMemory(): Promise<PublicBond | null> {
  try {
    const res = await fetch("/api/buddy/memory", { method: "POST" });
    const bond = await readBond(res);
    if (bond) publishSoul(bond);
    return bond;
  } catch {
    return null;
  }
}

export async function listBuddyMemories(): Promise<PublicBond | null> {
  try {
    const res = await fetch("/api/buddy/memory", { method: "GET" });
    const bond = await readBond(res);
    if (bond) publishSoul(bond);
    return bond;
  } catch {
    return null;
  }
}

export async function deleteBuddyMemory(memoryId: string): Promise<PublicBond | null> {
  try {
    const res = await fetch("/api/buddy/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId }),
    });
    const bond = await readBond(res);
    if (bond) publishSoul(bond);
    return bond;
  } catch {
    return null;
  }
}
