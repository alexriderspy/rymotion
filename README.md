# Rymotion

**Type a sentence, drop in a few screenshots, get a product film.** Runs on your own computer with DeepSeek or any other cheap model.

Site and examples: **https://alexriderspy.github.io/deepseek-motion/**

Cheap models write code fine. They have terrible taste. Ask one for a motion graphic and you get default easing,
cramped type, random colors and text that flashes by too fast to read. Rymotion moves the taste out of the model and
into the tool: the model writes a tiny JSON scene plan (words, scene types, which screenshot goes where, a template
name) and Rymotion turns it into a [HyperFrames](https://github.com/heygen-com/hyperframes) composition that renders to
MP4. Templates, type, easing, camera moves, transitions and timing are all curated. The model never touches a pixel, a
millisecond or a hex code.

## Start building

Needs Node 22.18+ and ffmpeg.

```bash
npx github:alexriderspy/deepseek-motion studio
```

This opens the Rymotion studio at `http://127.0.0.1:5177`. Paste a DeepSeek API key once (it is saved in
`~/.config/rymotion/` on your machine and never leaves it), then:

1. Describe the video, and press **+** to add screenshots or a logo. Give each one a short note on what it shows.
2. Pick a look (Pastel, Glyph, Studio, Editorial, Dither, Night) or leave it on Auto.
3. Watch the preview in the page, then export MP4 or WebM. Videos are saved in `~/Rymotion/`.

You can pass the first prompt straight in: `npx github:alexriderspy/deepseek-motion studio "a launch film for my app" --format 9:16`.

## Pictures make it a product film

Screenshots are the product itself, so the model builds the video around them:

- **logo**: the mark pops in and the name writes out beside it
- **media**: a screenshot in a browser, laptop or phone swings in, the camera pushes toward the part that matters and a label pins onto it; `then` steps through more screens in the same device
- **collage**: several pictures tossed in as cards with sticker labels

From the command line, pass each picture with a note on what it shows (and where, if it matters):

```bash
node src/cli.ts make "A 20-second launch video for Ryshift ..." --template studio \
  --asset "logo=docs/logo.svg::the app icon" \
  --asset "wheel=shots/wheel.png::the wheel open while a file is dragged onto it, wheel centre at x 0.33 y 0.5"
```

## Templates

| Template | Look | Good for |
| --- | --- | --- |
| `pastel` | flat pastel colour fields that change every scene | friendly products, apps, ads |
| `glyph` | cobalt with drifting clouds of characters, mono corner labels | AI, data, research, launches |
| `studio` | dark product UI, hairline grid, big light numbers | apps, dashboards, developer tools |
| `editorial` | paper grain, large upright serif | brands, food, culture, premium |
| `dither` | black with a rippling dot matrix, one hot accent | security, privacy, bold claims |
| `night` | deep fields that shift hue every scene | developer tools, night mood |

## Scenes

`logo`, `media`, `collage`, `kinetic` (giant letters drop in and land), `app` (an app window types, a cursor clicks, the
result appears), `chat` (a conversation plays out in a phone), `columns` (full-height colour columns, one can win),
`title`, `statement`, `stat` (counts up), `list`, `quote`, `compare`, `bars`, `code`, `flow`, `steps`, `custom`
(model-drawn canvas animation), `end`.

**Edit:** shots overlap at every cut and hand over with an iris, a slanted sweep, a push, a zoom-through or a rise,
never the same move twice in a row. Every shot keeps a slow camera push, so no frame sits still. Each beat lasts as long
as its choreography plus reading time; ask for a length and the holds flex to hit it.

**Music:** every video gets its own score from a small built-in synthesizer, with a soft whoosh on every cut.
Use `--music song.mp3` for your own track or `--no-music` for silence.

## Commands

```
deepseek-motion studio ["<idea>"] open the Rymotion studio in your browser
deepseek-motion make "<prompt>"   ask a model for a spec, then build it (--template, --asset, --format)
deepseek-motion reel "<idea>"     a vertical reel with music
deepseek-motion check <spec.json> validate a spec
deepseek-motion preview <spec>    build + one PNG per beat
deepseek-motion render <spec>     build + render final.mp4
deepseek-motion guide             print the spec guide models are given
deepseek-motion mcp               run the MCP server on stdio
```

## Other models

Built and tuned for DeepSeek, but it talks to any OpenAI-compatible endpoint:

```bash
# OpenRouter, Together, Groq, ...
DEEPSEEK_MOTION_BASE_URL=https://openrouter.ai/api/v1 DEEPSEEK_MOTION_API_KEY=... DEEPSEEK_MOTION_MODEL=qwen/qwen3-coder \
  node src/cli.ts studio

# Local, through Ollama
DEEPSEEK_MOTION_BASE_URL=http://localhost:11434/v1 DEEPSEEK_MOTION_MODEL=qwen3:14b node src/cli.ts studio
```

If the spec breaks a rule, the model gets back a list of problems that names the exact field and the fix
(`beats[2].items[1]: "..." is 9 words; the limit is 6. Cut it to the key phrase.`) and tries again, up to three times.
When you describe a real product, the guide tells the model to use only the facts you gave.

## In an agent (MCP)

```bash
claude mcp add deepseek-motion -- node /path/to/deepseek-motion/src/cli.ts mcp
```

| Tool | What it does |
| --- | --- |
| `motion_guide` | The whole spec contract: templates, scenes, writing rules |
| `motion_check` | Validate a spec; returns fix-it messages |
| `motion_preview` | Build and return one frame per beat as a contact sheet image |
| `motion_render` | Render to MP4 |

## Development

```bash
npm test                 # unit tests
npm run studio           # the studio from source
node scripts/matrix.ts   # every scene at its copy limits through HyperFrames' layout + contrast audit
npm run build            # compile to dist/
```

The site in `web/public/` is published to GitHub Pages by `.github/workflows/pages.yml`.

## Credits

Ideas (no code) from [OpenMotion](https://github.com/nexu-io/openmotion) (Apache-2.0): overlapping, camera-led edits and
templates as whole looks. The site's ASCII creatures are inspired by [@stackedlol](https://x.com/stackedlol/status/2112257760628986188).
Rendered with [HyperFrames](https://github.com/heygen-com/hyperframes) and GSAP. Fonts: Geist (OFL), Anton, Unbounded,
Instrument Serif.

MIT. An independent project, not affiliated with DeepSeek.
