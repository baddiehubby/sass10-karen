import type { MoodCheckIn } from "@/lib/companion-mood";
import type { AuraId } from "@/lib/buddy-identity";

export type AuraDef = {
  id: AuraId;
  title: string;
  line: string;
  premiumOnly: boolean;
};

export const AURA_CATALOG: AuraDef[] = [
  { id: "ember", title: "Ember", line: "The first quiet light.", premiumOnly: false },
  { id: "soft-aura", title: "Soft Aura", line: "A little more glow, after you showed up.", premiumOnly: false },
  { id: "night-halo", title: "Night Halo", line: "A ring for the hours you keep.", premiumOnly: false },
  { id: "aurora", title: "Aurora", line: "Color learned from returning.", premiumOnly: false },
  { id: "constellation", title: "Constellation", line: "Your check-ins became a sky.", premiumOnly: false },
  { id: "deep-field", title: "Deep Field", line: "A wider, slower universe.", premiumOnly: false },
  { id: "seasonal-veil", title: "Seasonal Veil", line: "The sky this month is wearing something extra.", premiumOnly: false },
  { id: "oracle-sigil", title: "Oracle Sigil", line: "A mark from the Realm.", premiumOnly: false },
];

export function auraDef(id: AuraId): AuraDef {
  return AURA_CATALOG.find((row) => row.id === id) ?? AURA_CATALOG[0];
}

export function seasonalVeilId(date = new Date()): "frost" | "bloom" | "solstice" | "ember-season" {
  const month = date.getMonth();
  if (month === 11 || month === 0) return "frost";
  if (month >= 2 && month <= 4) return "bloom";
  if (month >= 5 && month <= 7) return "solstice";
  return "ember-season";
}

export function uniqueDays(entries: MoodCheckIn[]): string[] {
  const days = new Set<string>();
  for (const row of entries) {
    const d = new Date(row.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return [...days].sort();
}

export function checkInStreak(entries: MoodCheckIn[], now = new Date()): number {
  const days = new Set(uniqueDays(entries));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 90; i += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function unlockedAuras(entries: MoodCheckIn[], oracleVisits: number, now = new Date()): AuraId[] {
  const n = entries.length;
  const found: AuraId[] = ["ember"];
  if (n >= 1) found.push("soft-aura");
  if (n >= 3) found.push("night-halo");
  if (n >= 7) found.push("aurora");
  if (n >= 14) found.push("constellation");
  if (n >= 30) found.push("deep-field");
  if (n >= 3) found.push("seasonal-veil");
  if (oracleVisits >= 3) found.push("oracle-sigil");
  void now;
  return found;
}

export function newestUnlock(prev: AuraId[], next: AuraId[]): AuraId | null {
  const had = new Set(prev);
  const fresh = next.filter((id) => !had.has(id));
  return fresh[fresh.length - 1] ?? null;
}
