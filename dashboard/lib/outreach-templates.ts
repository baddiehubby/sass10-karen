export type OutreachTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "support-deaf",
    name: "Your AI is deaf to emotions",
    subject: "{name}, your support AI might be missing half the signal",
    body: `Hi {name},

I'm reaching out because {company} ships AI-assisted support — and most stacks are brilliant at tickets yet deaf to how customers *feel* while they wait.

Buddy AI adds a tiny emotional companion beside your chat and a dashboard of mood + sentiment so your team can humanize your AI with data, not guesswork.

Worth a 12-minute look? I can share a one-line embed + sample dashboard for {pain_point}.

— Buddy AI`,
  },
  {
    id: "marketing-unforgettable",
    name: "Make your chatbot unforgettable",
    subject: "Make {company}'s chatbot unforgettable (without a re-platform)",
    body: `Hi {name},

Marketing agencies pitch "more human AI" — Buddy AI actually measures it: mood timelines, sentiment, top words that spark joy vs concern.

If {company} is pitching conversational AI to brands, this is the emotional intelligence layer that makes demos pop and retainers stick.

Open to a Loom on how we'd plug into {pain_point}?

— Buddy AI`,
  },
  {
    id: "ecom-friend",
    name: "Turn your AI into a friend",
    subject: "{name}, shoppers trust friends — not grey chat boxes",
    body: `Hi {name},

E-commerce brands using AI shopping assistants see lifts when the experience feels emotionally legible.

Buddy AI embeds in one line, reacts to tone in real time, and gives you analytics on how shoppers feel across sessions — so you can humanize your AI where it matters: checkout and support.

Could Buddy fit {company}'s roadmap around {pain_point}?

— Buddy AI`,
  },
  {
    id: "thought-leadership-gap",
    name: "The emotional intelligence gap in AI",
    subject: "The emotional intelligence gap in AI (2026 memo)",
    body: `Hi {name},

Teams are shipping faster models — but not better *felt* experiences. The gap isn't IQ; it's emotional intelligence at the UI + analytics layer.

Buddy AI is a companion widget + dashboard that turns conversations into measurable sentiment — built for agencies rolling out AI for clients like {company}.

If {pain_point} is on your radar this quarter, happy to send the one-pager.

— Buddy AI`,
  },
];

export function fillTemplate(text: string, vars: { name: string; company: string; pain_point: string }) {
  return text
    .replaceAll("{name}", vars.name || "there")
    .replaceAll("{company}", vars.company || "your team")
    .replaceAll("{pain_point}", vars.pain_point || "AI experience quality");
}
