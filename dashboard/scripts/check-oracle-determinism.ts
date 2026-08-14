import { deriveMoodState } from "@/lib/companion-mood";
import { interpretReading } from "@/lib/oracle/interpreter";

const state = deriveMoodState([
  { id: "1", mood: "calm", intensity: 40, createdAt: "2026-08-14T10:00:00.000Z" },
]);
const date = new Date("2026-08-14T12:00:00.000Z");
const a = interpretReading(state, "cosmic", "", date);
const b = interpretReading(state, "cosmic", "", date);
const pandit = interpretReading(state, "pandit", "", date);

if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error("Oracle readings are not deterministic");
}
if (a.sign !== "the Soft Tide") {
  throw new Error(`Unexpected calm sign: ${a.sign}`);
}
if (pandit.energyLabel !== "Today's संकेत") {
  throw new Error("Pandit energy label missing");
}
if (a.disclaimer.toLowerCase().includes("diagnos") || a.disclaimer.toLowerCase().includes("fate guaranteed")) {
  throw new Error("Disclaimer too strong");
}

console.log("oracle determinism ok", a.dateKey, a.sign);
