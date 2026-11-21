import { z } from "zod";
import { ENERGIES, FORMATS, PALETTES, TEMPLATES, TYPE_PAIRS, type FormatName } from "./tokens.ts";

const names = (o: object) => Object.keys(o) as [string, ...string[]];

const hold = z.number().min(0.5).max(9).optional()
  .describe("Seconds to hold after the entrance. Omit it: hold is computed from reading time.");

export const TitleBeat = z.object({
  scene: z.literal("title"),
  text: z.string().min(1).describe("The headline. 2-7 words."),
  kicker: z.string().optional().describe("Small label above the headline. 1-4 words."),
  hold,
});

export const StatementBeat = z.object({
  scene: z.literal("statement"),
  text: z.string().min(1).describe("One sentence. Up to 16 words."),
  highlight: z.string().optional().describe("A word or short phrase copied exactly from text, marked with the accent."),
  hold,
});

export const StatBeat = z.object({
  scene: z.literal("stat"),
  value: z.number().describe("The number to count up to."),
  prefix: z.string().max(3).optional().describe("e.g. $"),
  suffix: z.string().max(4).optional().describe("e.g. %, x, K, +"),
  decimals: z.number().int().min(0).max(2).optional(),
  label: z.string().min(1).describe("What the number means. Up to 10 words."),
  hold,
});

export const ListBeat = z.object({
  scene: z.literal("list"),
  title: z.string().optional().describe("Up to 6 words."),
  items: z.array(z.string().min(1)).min(2).max(5).describe("2-5 items, each up to 6 words."),
  hold,
});

export const QuoteBeat = z.object({
  scene: z.literal("quote"),
  text: z.string().min(1).describe("The quote, without quotation marks. Up to 24 words."),
  author: z.string().optional(),
  hold,
});

const Side = z.object({
  label: z.string().min(1).describe("Up to 4 words."),
  value: z.string().optional().describe("Short value, e.g. '$0.02' or '12 min'."),
});

export const CompareBeat = z.object({
  scene: z.literal("compare"),
  title: z.string().optional().describe("Up to 6 words."),
  left: Side,
  right: Side,
  winner: z.enum(["left", "right"]).optional().describe("Side to highlight with the accent."),
  hold,
});

export const BarsBeat = z.object({
  scene: z.literal("bars"),
  title: z.string().optional().describe("Up to 6 words."),
  unit: z.string().max(4).optional().describe("Appended to each value, e.g. %"),
  bars: z.array(z.object({
    label: z.string().min(1).describe("Up to 3 words."),
    value: z.number().min(0),
  })).min(2).max(6),
  hold,
});

export const CodeBeat = z.object({
  scene: z.literal("code"),
  title: z.string().optional().describe("Window title, e.g. a filename or 'terminal'."),
  lines: z.array(z.string()).min(1).max(8).describe("1-8 lines of code, each up to 46 characters."),
  hold,
});

export const EndBeat = z.object({
  scene: z.literal("end"),
  text: z.string().min(1).describe("Closing line or brand name. 1-6 words."),
  cta: z.string().optional().describe("Call to action, e.g. a URL or '@handle'. Up to 6 words."),
  hold,
});

export const FlowBeat = z.object({
  scene: z.literal("flow"),
  title: z.string().optional().describe("Up to 6 words."),
  nodes: z.array(z.string().min(1)).min(2).max(5).describe("2-5 stages, each up to 3 words. Data visibly travels from one to the next."),
  caption: z.string().optional().describe("One line under the diagram. Up to 12 words."),
  hold,
});

export const StepsBeat = z.object({
  scene: z.literal("steps"),
  title: z.string().optional().describe("Up to 6 words."),
  steps: z.array(z.string().min(1)).min(2).max(6).describe("2-6 steps in order, each up to 5 words. They tick off one by one."),
  hold,
});

export const CustomBeat = z.object({
  scene: z.literal("custom"),
  brief: z.string().min(1).describe("What this animated moment shows, concretely: subject, motion, the one line of text if any. Up to 50 words."),
  seconds: z.number().min(2).max(12).default(5).describe("Length of the moment."),
  code: z.string().optional().describe("Body of draw(ctx, t, api). Written in a second step from the brief; see the custom scene API."),
});

export const KineticBeat = z.object({
  scene: z.literal("kinetic"),
  text: z.string().min(1).describe("1-3 words, shown huge; each letter drops in and lands."),
  sub: z.string().optional().describe("One small line under it. Up to 8 words."),
  hold,
});

export const ChatBeat = z.object({
  scene: z.literal("chat"),
  title: z.string().optional().describe("Headline beside (or above) the phone. Up to 7 words."),
  name: z.string().optional().describe("Who 'them' is, shown in the phone header, e.g. an assistant or app name. 1-3 words."),
  messages: z.array(z.object({
    from: z.enum(["me", "them"]),
    text: z.string().min(1).describe("Up to 12 words."),
  })).min(2).max(4).describe("2-4 messages; 'them' replies are typed out first."),
  hold,
});

export const AppBeat = z.object({
  scene: z.literal("app"),
  name: z.string().min(1).describe("App or tool name in the window title. 1-3 words."),
  input: z.string().optional().describe("What gets typed into the app's field. Up to 10 words."),
  button: z.string().min(1).describe("The button the cursor clicks. 1-3 words."),
  result: z.string().min(1).describe("What the app produces after the click. Up to 14 words."),
  title: z.string().optional().describe("A caption pill under the window. Up to 6 words."),
  hold,
});

export const ColumnsBeat = z.object({
  scene: z.literal("columns"),
  title: z.string().optional().describe("Caption pill over the columns. Up to 6 words."),
  items: z.array(z.object({
    label: z.string().min(1).describe("Up to 3 words."),
    note: z.string().optional().describe("Up to 4 words."),
  })).min(3).max(5).describe("3-5 options, each its own full-height colour column."),
  pick: z.number().int().min(0).optional().describe("Index of the option that wins; its column takes over the frame."),
  hold,
});

const assetName = z.string().min(1).describe("Name of an asset the user supplied.");

export const MediaBeat = z.object({
  scene: z.literal("media"),
  asset: assetName.describe("The screenshot or picture to show."),
  then: z.array(assetName).max(3).optional().describe("Up to 3 more pictures shown in turn in the same device, e.g. the next steps of a flow."),
  device: z.enum(["browser", "laptop", "phone", "card"]).optional().describe("Frame around the picture. Default: phone for tall pictures, browser otherwise."),
  url: z.string().optional().describe("Address shown in the browser bar."),
  focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional().describe("[x, y] from 0 to 1: the part of the picture the camera pushes toward."),
  zoom: z.number().min(1).max(2.4).optional().describe("How far the camera pushes in, 1-2.4. Default 1.5."),
  label: z.string().optional().describe("A label pinned at the focus point. Up to 5 words."),
  title: z.string().optional().describe("Headline beside or above the device. Up to 7 words."),
  hold,
});

export const CollageBeat = z.object({
  scene: z.literal("collage"),
  title: z.string().optional().describe("Caption pill. Up to 6 words."),
  cards: z.array(z.object({ asset: assetName, label: z.string().optional().describe("Sticker on the card. Up to 3 words.") })).min(2).max(4),
  hold,
});

export const LogoBeat = z.object({
  scene: z.literal("logo"),
  asset: assetName.describe("The logo or app icon."),
  name: z.string().min(1).describe("The product name, exactly as written by its maker. 1-3 words."),
  sub: z.string().optional().describe("One line under it. Up to 8 words."),
  hold,
});

export const Beat = z.discriminatedUnion("scene", [
  TitleBeat, StatementBeat, StatBeat, ListBeat, QuoteBeat, CompareBeat, BarsBeat, CodeBeat, FlowBeat, StepsBeat, CustomBeat, EndBeat,
  KineticBeat, ChatBeat, AppBeat, ColumnsBeat, MediaBeat, CollageBeat, LogoBeat,
]);
export type Beat = z.infer<typeof Beat>;
export type SceneName = Beat["scene"];

export const BACKGROUNDS = ["glow", "grid", "dots", "plain", "glyph", "halftone", "grain", "hairline"] as const;

export const Spec = z.object({
  title: z.string().min(1).describe("Working title; names the output folder."),
  format: z.enum(Object.keys(FORMATS) as [FormatName, ...FormatName[]]).default("16:9"),
  template: z.enum(names(TEMPLATES)).optional().describe("A whole look; sets palette, type and background together."),
  palette: z.enum(names(PALETTES)).default("midnight-lime"),
  type: z.enum(names(TYPE_PAIRS)).default("modern"),
  energy: z.enum(names(ENERGIES)).default("smooth"),
  background: z.enum(BACKGROUNDS).default("plain"),
  duration: z.number().min(5).max(180).optional().describe("Target length in seconds. Set it only when the user asks for a length."),
  beats: z.array(Beat).min(1).max(12),
  assets: z.record(z.string(), z.string()).optional().describe("Asset name to file path. Filled in by the tool, not the model."),
});
export type Spec = z.infer<typeof Spec>;
export type SpecInput = z.input<typeof Spec>;
