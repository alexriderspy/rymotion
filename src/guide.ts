import { BACKGROUNDS } from "./spec.ts";
import { ENERGIES, FORMATS, PALETTES, TEMPLATES, TYPE_PAIRS } from "./tokens.ts";

// The whole contract a model needs, kept short enough for a small context
// and concrete enough that a weak model copies the shape instead of guessing.

// Options are listed in a different order per request: weak models tend
// to take the first option offered, which made every video look alike.
const table = (o: Record<string, { description: string }>, seed: number) =>
  shuffle(Object.entries(o), seed).map(([k, v]) => `  - ${k}: ${v.description}`).join("\n");

function shuffle<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const seedOf = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0;

export const SCENES_GUIDE = `Scenes (each beat is one scene; every field limit is enforced):
  - title: { text (2-7 words), kicker? (1-4 words) } — opening headline
  - statement: { text (up to 16 words), highlight? (words copied exactly from text) } — one punchy sentence
  - stat: { value (number), prefix? ("$"), suffix? ("%", "x", "K", "M"), decimals? (0-2), label (up to 10 words) } — one big number that counts up
  - list: { title? (up to 6 words), items (2-5 strings, each up to 6 words) }
  - quote: { text (up to 24 words, no quote marks), author? }
  - compare: { title?, left: { label, value? }, right: { label, value? }, winner? ("left"|"right") } — A vs B
  - bars: { title?, unit? ("%"), bars: [{ label (up to 3 words), value (number) }] (2-6 bars) } — bar chart
  - code: { title? (filename or "terminal"), lines (1-8 lines, each up to 46 chars) }
  - flow: { title?, nodes (2-5 stages, each up to 3 words), caption? (up to 12 words) } — boxes joined by arrows with data travelling through; for pipelines, systems, cause and effect
  - steps: { title?, steps (2-6 steps in order, each up to 5 words) } — a tracker that ticks off each step; for recipes, how-tos, processes
  - kinetic: { text (1-3 words, 16 letters max), sub? (up to 8 words) } — giant letters drop in one by one and land; for a hook, a brand name, a punchline
  - chat: { title? (up to 7 words), name? (1-3 words), messages (2-4 of { from: "me"|"them", text (up to 12 words) }) } — a phone where a conversation plays out; for AI assistants, support, texting, before/after a reply
  - app: { name (1-3 words), input? (up to 10 words), button (1-3 words), result (up to 14 words), title? (up to 6 words) } — an app window: the input types itself, a cursor clicks the button, the result appears; for showing any tool or product doing its job
  - columns: { title? (up to 6 words), items (3-5 of { label (up to 3 words), note? (up to 4 words) }), pick? (index of the winner) } — full-height colour columns rise in; with pick, the winner takes over the frame; for options, plans, a lineup, choosing one
  - media: { asset, then? (up to 3 more asset names, shown in turn), device? ("browser"|"laptop"|"phone"|"card"), url?, focus? ([x, y] 0-1, where the camera pushes), zoom? (1-2.4), label? (up to 5 words, pinned at the focus), title? (up to 7 words) } — a real screenshot in a device that swings in; the camera pushes toward the focus and a label pins on. Only with assets the user gave
  - collage: { title? (up to 6 words), cards (2-4 of { asset, label? (up to 3 words) }) } — real pictures tossed in as cards with sticker labels. Only with assets
  - logo: { asset, name (1-3 words, exactly as the maker writes it), sub? (up to 8 words) } — the logo pops in and the name writes out beside it. Only with a logo asset
  - custom: { brief (up to 50 words), seconds (2-12, default 5) } — a free-form animated moment drawn in code in a second step. Anything the other scenes can't show: a simulation, a visual metaphor, particles, abstract motion, giant kinetic type, an illustration that builds itself
  - end: { text (1-6 words), cta? (up to 6 words, e.g. a URL or @handle) } — closing card
Any beat may set "hold" (seconds) but you should omit it: timing is computed from reading time.`;

export function guide(seed = 0): string {
  return `You write a JSON spec for a short motion-graphics video. You do not write code, colors, fonts or timings: pick names from the lists below and the renderer handles the design.

Spec shape:
{
  "title": string,
  "format": ${Object.keys(FORMATS).map((f) => `"${f}"`).join(" | ")}   (16:9 YouTube, 9:16 Reels/Shorts/TikTok, 1:1 and 4:5 feed),
  "template": one of the templates (sets palette, type and background together; prefer this),
  "palette": one of the palettes (only without a template),
  "type": one of the type pairs,
  "energy": one of the energies,
  "background": ${BACKGROUNDS.filter((b) => b !== "glow").map((b) => `"${b}"`).join(" | ")}   (ignored by flat palettes),
  "duration": seconds (optional; only when the user asks for a length),
  "beats": [ 3-9 beats ]
}

Templates (whole looks, designed as one; pick the one that fits the topic):
${table(TEMPLATES, seed + 3)}

Palettes (only when no template fits):
${table(PALETTES, seed)}

Type pairs:
${table(TYPE_PAIRS, seed + 1)}

Energies:
${table(ENERGIES, seed + 2)}

${SCENES_GUIDE}

Custom moments are drawn in code by a second model call. They are the riskiest scene, so use them sparingly:
  - Use 0-1 custom beats. Use one only for the single moment no other scene can show (a product's physical action, a visual metaphor), never for text, lists or a logo.
  - Write the brief like a storyboard line: what we see, how it moves, how it builds to its peak, and the one short line of text (if any) and where it lands. Concrete beats vague.

Pictures:
  - If the user lists assets (screenshots, logos), build the video around them: they are the product itself and beat any drawn scene. Open with logo when there is a logo, and use media or collage for at least half the beats.
  - Pick focus and label from the asset's description: point at the thing the beat is about. Use then to step through a flow in one device.
  - Never use an asset name that was not listed.

Look:
  - Flat palettes (their description says "flat") give every beat its own colour field and sweep between them. They look the most like a modern product film. Use one for products, apps, tools, launches, ads, small businesses and friendly explainers.
  - Light flat palettes (pastel-pop, sorbet) suit food, cafes, lifestyle, everyday products; night-studio suits developer tools and AI.
  - Open with kinetic (a 1-3 word hook) rather than title. Use title, statement, list and steps at most once each; they are plain text and read like slides.
  - Show things working instead of describing them: app for a tool or product doing its job, chat for any conversation with an assistant or customer, kinetic for the name or the hook, columns for options or a lineup.

Writing rules:
  - One idea per beat. Short words beat long ones. On-screen text is not narration.
  - Open with a title or a striking stat; close with an end card.
  - Vary scene types; never two of the same scene in a row.
  - Only use numbers the user gave you or that are common knowledge. Never invent statistics; if you have none, skip stat and bars.
  - When the user describes a real product, use only the facts they gave: its real name, what it really does, real numbers and links. Never invent features, prices, users, URLs or results. App and chat scenes must show what the product actually does.
  - Show, don't tell: when the idea is a process use steps, a system or pipeline use flow, numbers use stat or bars, a trade-off use compare. Use statement only for the one line that matters.
  - Pick palette, type and energy for the topic's mood. Do not default to the first option listed.
  - If the user asks for a length ("15-second", "1 minute"), set duration to it and use fewer beats: about one beat per 3-4 seconds.

Example:
{"title":"Inbox zero, finally","format":"16:9","template":"pastel","energy":"smooth","beats":[
 {"scene":"kinetic","text":"Inbox zero","sub":"without reading a single email"},
 {"scene":"app","name":"Sortly","input":"Sort my inbox and draft the replies","button":"Sort","result":"212 emails filed, 9 replies drafted, 3 need you","title":"One click every morning"},
 {"scene":"chat","name":"Sortly","messages":[{"from":"me","text":"Anything urgent today?"},{"from":"them","text":"Two: the invoice from Priya and tomorrow's 10am move."}]},
 {"scene":"columns","title":"Works where you do","items":[{"label":"Gmail"},{"label":"Outlook"},{"label":"iCloud"}]},
 {"scene":"end","text":"Try Sortly free","cta":"sortly.app"}]}

Reply with the JSON object only.`;
}
