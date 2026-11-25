---
name: goat-animation
description: "Animation · Анимэйшн. Makes a no-camera animated video for Reels/TikTok from a script and the user's own voice recording (or no voice at all): glowing white line drawings of 3D objects floating over a faint grid floor in the dark, turning into each other on the spoken word (Wireframe), with plain captions and an optional \"Comment WORD\" ending typed into a comment box. Everything is drawn in code on the user's computer: no camera, no API keys, no paid image or video generator. Four more styles: Stage (solid toy-like objects on a lit stage with a paper-cut narrator made from the user's own photo, the stage going dark at \"but here's the catch\"), Comic (comic panels inked and halftoned, the user's paper figure as the hero against a villain, speech bubbles, sound words and impact frames), Collage (black-and-white halftone cut-outs on grey paper with condensed words slamming in), and App Explainer (a graphing-calculator window on cream paper that types, drags and taps on the spoken word, for maths and SAT tips). Built on HyperFrames + three.js; renders a 1080x1920 MP4. For a look these five don't have, or to copy the look of a picture or video, it hands off to the separate Lemo-Opuscar skill (99 code-made film styles), installing it first if the user agrees. Use whenever the user wants an animation, an animated explainer, a faceless video, a wireframe or line-art video, or types /goat-animation, /анимэйшн, or says \"анимэйшн хий\", \"хөдөлгөөнт видео хий\", \"нүүргүй видео хий\", \"wireframe видео\", \"коллаж видео\", \"цаасан дүр\", \"make an animation\", \"animated explainer\", \"calculator video\", \"Desmos-style explainer\", \"app explainer\", \"collage video\", \"comic video\", \"комикс хий\", \"энэ видео шиг хий\", \"copy this style\", \"paper cut-out narrator\", \"make me a cartoon of myself\", even if they don't name the skill."
---

# Animation · Анимэйшн

The user brings an idea. You write the script with them, they record it on their phone, and the skill draws the whole video in code, one object per idea, each arriving exactly on the word that names it. Five looks:
- **Wireframe:** glowing white line objects over a faint grid floor in the dark, each breaking apart and re-forming into the next. Small plain captions.
- **Stage:** the same objects as solid, soft toys on a round plinth under a spotlight, with a paper-cut narrator (the user's own figure, made from their photo) standing beside them, talking, pointing and thinking. The stage can turn dark navy at the twist ("but here's the catch") and back.
- **Comic:** each idea a comic panel, inked and halftoned like a printed comic: the user's paper figure as the hero, the problem as a villain object with an angry face, the voice's lines in speech bubbles and narration boxes, sound words (ТАС!, ШУУ!) and red-black-white impact frames on the hits.
- **Collage:** grey folded paper; each object as a black-and-white halftone cut-out over a circle or bar in the brand colour, the spoken words slamming in, the named word huge.
- **App Explainer:** a graphing-calculator window that types, drags and taps (maths and SAT tips).

Every style can end on the user's comment word ("Comment GOAT").

**Good for:** explaining one idea in steps (a day, a week, a process), "what happens if…" stories, offers with a comment ending. Works in Mongolian and English.
**Not for:** videos with a person on camera (use a GOAT editing look), real product photos, or anything that needs a real face or logo.

Talk to the user in the language they write in (usually Mongolian). Keep messages short and plain; many users are not technical. One step per message, then wait for them. `SKILL_DIR` means this skill's base directory (shown when the skill loads). Run commands from the user's project folder with absolute paths into `SKILL_DIR`. `anim` below means `node SKILL_DIR/scripts/anim.mjs`.

## 1. Setup check (first time on a machine)

Run `anim check --voice` (leave out `--voice` if they will make a video with no voice). It prints `[anim] ready`, or one line per missing tool with how to install it. Show the user only what is missing, and ask before installing (it is their computer):
- Mac: `brew install node ffmpeg whisper-cpp` (whisper-cpp times the words of the voice; Homebrew's build uses the Mac's graphics chip, so it is fast).
- Windows: `winget install OpenJS.NodeJS.LTS` and `winget install Gyan.FFmpeg`, then close and reopen the terminal. For the voice, download `whisper-bin-x64.zip` from https://github.com/ggml-org/whisper.cpp/releases, unzip it, and set `HYPERFRAMES_WHISPER_PATH` to the `whisper-cli.exe` inside (`setx HYPERFRAMES_WHISPER_PATH "C:\path\to\whisper-cli.exe"`, then reopen the terminal). Without it the timing step tries to build Whisper and needs developer tools.

A video with no voice needs no whisper-cpp. The first video with a voice downloads, once, the speech model (Whisper large-v3-turbo, about 1.6 GB), and the first render a private copy of Chrome that draws the frames. Tell the user the first run takes a while; after that it starts at once. Nothing is uploaded: everything runs on their computer, with no account.

**Long steps:** the first `anim time` (the 1.6 GB download) and every `anim render` can run longer than a normal command timeout. Run them in the background, or with a 600000 ms timeout, and wait for them to end. Never stop one and start it again: an interrupted download starts again from zero. Whisper needs about 2 GB of memory; on an 8 GB computer ask the user to close other heavy apps first.

**Windows has not been tested yet.** If a step fails there, show the error to the user in plain words.

## 2. Idea → script

Ask what the video is about and who it is for (one question). Pick the style with them: **Wireframe** (cool, techy), **Stage** (friendly, with them on screen as a paper figure; good for a story with a twist), **Comic** (loud and fun: them as the hero beating a problem), **Collage** (bold, editorial, words first), all from the same objects; **App Explainer** when the video shows steps on a graphing calculator (the only app so far). If they can't choose, show the three names with one line each and let them pick. If none of the five fits, or they want the look of a picture or video they like, offer **Lemo-Opuscar** instead (see "Other looks" at the end). Then write the script with them:
- **30–60 seconds** when read aloud: about 2 spoken words a second (Mongolian words are longer, so lean shorter). No greeting; start on the idea. If the user brings their own script and it is much shorter, say so once and offer one or two more lines; use theirs as it is if they want.
- **Every sentence must be something you can draw:** with one of the objects in step 5a, or, in App Explainer, with a line typed, a slider dragged or a point tapped (step 5b). If you can't picture the object for a sentence, rewrite the sentence.
- Numbers beat adjectives, and real value beats hype. Never invent a price, a result or a date: ask.
- If they want an ending, the last line asks for a comment with one word ("Коммент дээр GOAT гэж бичээрэй").
- Write "Чингис хаан" in full, never "Чингис" alone. No emoji or symbols such as ★ → in the script: the caption font can't draw them, and the render stops.

Show the script as a short table (line → object you'll show), change it until they say yes, and save it as `script.txt` in the project folder.

## 3. Voice

Ask the user to record the script on their phone (a voice memo is fine: m4a, mp3 or wav) and copy it into the project folder, for example as `voice.m4a`. Recording tips: a small quiet room (a parked car or a wardrobe works), phone about 20 cm from the mouth, read the script out loud once before recording, and read it as written: the timing matches the script word by word.

**No voice** is fine too: leave `"voice"` out of the plan. Captions are then timed by reading speed, and they can add their own music file with `"music": "song.mp3"`.

## 3b. Their paper figure (Stage and Comic, once)

Stage has a narrator and Comic a hero: a paper-cut figure of the user. Make it once and keep the file; every Stage and Comic video can use it.

1. Ask for one photo of themselves (a selfie is fine): face and top half visible, glasses on if they wear them. Say why: you look at it to pick the figure's hair, glasses and clothes. The photo isn't drawn into the video and the skill never uploads it; like any picture they send you, you see it in this chat. If they'd rather not send one, ask them to describe their hair, glasses, facial hair and usual top instead.
2. Look at the photo and write `figure.json` in the project folder, picking the nearest of each:

```json
{ "name": "Saraa", "skin": "#E8B992", "hair": "long", "hairColor": "#1E1A17", "glasses": "none", "face": "none",
  "top": "shirt", "topColor": "#F4F4F0", "sleeves": "pushed", "pants": "#2E3D5C", "shoes": "#F4F1EA", "watch": false }
```

| Field | Choices |
|---|---|
| `hair` | `short` (neat, short fringe), `side-part` (combed over from a part), `buzz` (cut close), `bald`, `curly-top` (curls piled on top, short sides), `curly-mop` (messy curls to the chin, over the ears), `long` (past the shoulders, middle part), `bob` (chin length, straight bangs), `ponytail`, `bun` |
| `glasses` | `none`, `clear` (thick clear rectangles), `dark` (thick black rectangles), `round` (thin round wire), `aviator` (thin wire, double bridge) |
| `face` | `none`, `stubble`, `mustache`, `goatee` (mustache + chin beard), `beard` (full jaw) |
| `top` | `crew` (sweater or crewneck), `hoodie`, `shirt` (collar and buttons), `tee` (short sleeves) |
| `sleeves` | `full`, `pushed` (up to the elbow), `short` (a `tee` is always short) |
| colours | `skin`, `hairColor`, `topColor`, `pants`, `shoes` as `#RRGGBB`, sampled from the photo (skin from the cheek in daylight, not a shadow) |
| `watch` | `true` shows a silver watch on one wrist (with pushed or short sleeves) |

3. Run `anim figure figure.json`. It checks the file (any mistake names the field and the choices) and writes `figure.png` next to it: the figure waving on the stage. Look at it yourself first, then show it to the user and ask what's off (hair, glasses, colours). Change the file and run it again until they like it. It's a simple paper cut-out, not a portrait: aim for "that's clearly me", not a likeness.

The built-in figures in `figures/` are GOAT's own, for GOAT's videos; never use them for a member's video.

## 4. Timing

Write `plan.json` in the project folder with what you know so far:

```json
{ "name": "my-video", "style": "wireframe", "brand": "goat", "language": "mn",
  "script": "script.txt", "voice": "voice.m4a" }
```

`"name"` becomes the video's file name. `"language"` is `"mn"` or `"en"` (what is spoken). Run `anim time plan.json`. (The skill keeps its working files in a `.work-anim/` folder next to the plan; leave it there. You don't need to run `anim time` again after changing the beats, only after changing the script or the voice: `anim render` re-times by itself when they change.) It prints `[anim] timing: aligned` (the script lined up word by word with the voice), and then every caption line with its time:

```
  1  0.03–1.10  Эхний өдөр.
  2  1.28–2.55  Тэр бүгдийг ганцаараа
```

- `sentences` plus a note means the voice and the script only partly match: the user probably said something different. Show them the note and ask whether to fix the script to what they said (then run `anim time` again) or keep it.
- `the script doesn't match the voice … is it the right file?` stops the step: check the voice file and the script.
- `reading` is a video with no voice.
- `note: the … s of silence before the first word is cut` is normal: the video starts just before the first word, and the printed times are the video's.

## 5. Plan the beats

### 5a. Wireframe beats

Add `"beats"` to `plan.json`: one object per idea, each landing on the word that names that idea.

```json
"beats": [
  { "at": 0, "object": "calendar" },
  { "say": "Унтах", "object": "bed" },
  { "say": "Дөрвөн", "object": "robot", "count": 4 }
],
"cta": { "say": "коммент", "word": "GOAT" }
```

- **`say`** is one or more words in a row copied from the caption lines that `anim time` printed. Capitals and punctuation don't matter, and the words can start anywhere in a line (`"say": "bot"` finds "a bot answer"). The object arrives on the first of them (it starts forming 0.4 s before and is whole 0.1 s after). Beats are found in the order you write them, each after the one before, so a word said twice is found again by a later beat. **`at`** is seconds instead of words.
- **The first beat is `"at": 0`**, so the first frame (the thumbnail) is never empty.
- **Each beat holds at least 1.2 s,** and that includes the last one: it must start at least 1.2 s before the video ends (the video ends 0.6 s after the last spoken word). If two ideas come faster than that, put the next one on a later word; if the last idea comes too late, put it on an earlier word of the same sentence (the subject, not the last word).
- **Match the words exactly. This is the most important rule.** The picture must say what the voice says:
  - A number from two to six of something → `"count"` with that number ("four AI workers" → four robots, "three posts" → `phone` with `"count": 3`). More than six → one object, no `count` (or `people` for a crowd, `bars` for a growing number).
  - The same idea coming back → the same object coming back (each new day → `calendar` again).
  - Never show an object the words don't name or clearly mean.
- **Objects (pick the nearest; there are no others):**

  | Object | Use for |
  |---|---|
  | `calendar` | a day, a date, a week, a deadline |
  | `clock` | time, hours, "every day at…" |
  | `hourglass` | waiting, time running out |
  | `bed` | sleep, tired, rest, night |
  | `bowl` | food, eating, a meal, a café |
  | `phone` | social media, posts, content, an app |
  | `laptop` | work, a website, online |
  | `chat` | messages, DMs, replies, customers asking |
  | `mail` | email, a letter, an order notice |
  | `megaphone` | marketing, ads, announcing |
  | `comment` | the ending: the CTA word is typed into it |
  | `coins` | money, sales, income, price |
  | `wallet` | spending, savings, cost |
  | `card` | paying, payment, checkout |
  | `bars` | growth, comparing numbers |
  | `line-chart` | a trend, results over time |
  | `pie` | a share, a part of the whole |
  | `gauge` | speed, performance, a level |
  | `target` | a goal, customers you aim at |
  | `magnet` | attracting customers, leads |
  | `rocket` | launch, fast growth, starting |
  | `bulb` | an idea, a tip, a lesson |
  | `notebook` | writing it down, notes, a list, a plan |
  | `trophy` | winning, results, the best |
  | `gift` | a bonus, a free offer, a present |
  | `shop` | a store, a business, a branch |
  | `box` | a product, a package, stock |
  | `truck` | delivery, shipping |
  | `person` | one customer, the owner, "you" |
  | `people` | a team, a crowd, customers |
  | `robot` | AI, an AI worker, automation |
  | `terminal` | code, a command, "Claude does it", steps a computer runs |

  If no object fits an idea, use the nearest one and tell the user which object stands in for it.
- **`lines`** (terminal only): the lines it types, one after another, in the beat's time: `{ "say": "Claude", "object": "terminal", "lines": ["> write the script", "✓ done"] }`. At most 5 lines of 30 characters. Keep them to the words the voice says, shortened.
- **`tag`** (optional, any beat): a small accent-coloured label next to the object, at most 16 characters (`"tag": "24/7"`, `"tag": "+40%"`). Use it for a number or name the voice says that the object alone can't show. Not on every beat: two or three in a video.
- Each object's key part (the robot's eyes, the top coin) is drawn in the brand's accent colour by itself. There's nothing to set.
- **`cta`** (optional): `say` is the word where the comment box appears, `word` is what gets typed into it (in the brand colour). Keep the word short, about 7 capitals at most (GOAT, ЧЕЛЛЕНЖ), or the render refuses it. It counts as the last beat.
- **`sounds`** (optional): `"sounds": [{ "say": "Борлуулалт", "sound": "swish" }]`. At most one per beat, never two within 0.5 s, and none is fine: the voice carries the video. Names: boom, click, ding, hit, marker, notify, paper, pop, projector, riser, shimmer, shutter, swish, tape, thud, tick, type, whoosh.
- Brands: `"goat"` and `"flowersos"` (every style; flowersos has a logo mark that App Explainer shows). `"quality": "light"` turns off the glow if a render is very slow (on a computer without a graphics chip it turns off by itself).

### 5b. App Explainer beats

Use `"style": "app-explainer"` with `"app": "calculator"` (the only app). A graph window sits on cream paper. Each beat does one thing on it. The window shows `"view"` at least, as `[x0, x1, y0, y1]` (default `[-10, 10, -5, 5]`). The graph keeps square units, so it may show a bit more: pick ranges about twice as wide as tall, like `[-5, 5, -2.5, 2.5]` (the checker refuses a view it would have to widen more than 3 times). Lines are drawn red, then green, purple, black.

| Beat field | What it does |
|---|---|
| `say` / `at` | the word (or second) where the beat happens, as in 5a. The first beat is `"at": 0` |
| `title` | big maths at the top: one line or a list, like `["y = 3x + 5", "y = kx - 2"]` |
| `sub` | a few words under the title, like `"No solution. k = ?"` (40 characters at most) |
| `type` | one line, or a list of lines, typed into the rows and drawn |
| `slider` | a letter, like `"k"`, gets a slider (one per letter). `min` and `max` set its range (default -10 to 10), `value` where it starts (default 1) |
| `drag` + `to` | drags that letter's slider to the number `to`. The lines move with it |
| `tap` | `[x, y]` marks a point on the graph |
| `answer` | the result, like `"k = 3"` (24 characters at most). It takes the sub's place, in the brand colour |

Rules (the checker says the same, in words):
- **One action per beat:** `type`, `slider`, `drag` or `tap`. `title`, `sub` and `answer` may come with it, or on a beat of their own.
- **Every letter in a typed line needs a slider** (`k` in `y = kx - 2`). `x` doesn't, and neither does the `y` in `y = ...`. Put `slider` on a beat before you `drag` it, and keep `to` and `value` inside its range.
- **4 rows at most:** each typed line and each slider is one row.
- **Maths fields hold maths only:** `title` and `type`. Write `y = ...`, `^` for powers (`x^2`), single-letter variables, and 3x or kx for multiply. No functions (sin, sqrt), no `<` or `>` yet. Words go in `sub` and `answer`, never in a title or a line (the maths font has no Ө or Ү).
- **Typing must finish before the next beat.** All the lines in a beat type one after another (about 16 keys a second), then take half a second to draw. The next beat must start at least 0.3 s after that. Count the keys: `y = 3x + 5` is 6 keys (spaces don't count), so two lines of 6 keys take 12 / 16 + 0.5 = 1.25 s, and the next beat must be at least 1.55 s later. If the checker says the next beat comes too soon, move that beat to a later word.
- **Each beat holds at least 1.0 s.** `tap` must land inside the graph.
- The words in `say` are caption words, as in 5a. Captions fade in word by word.
- `cta` is as in 5a. `"word"` is any short word, about 7 capitals at most.
- **The flower:** with `"brand": "flowersos"`, the flowersos flower in the corner nods on each beat and blooms on `answer`. `goat` has no mark, so no flower.

The example below finds k so the two lines are parallel. Use it as the model:

```json
{ "name": "sat-find-k", "style": "app-explainer", "brand": "flowersos", "language": "en",
  "app": "calculator", "view": [-5, 5, -2.5, 2.5],
  "script": "No solution? Find k without algebra. Type both lines. Put k on a slider. Now drag it until the lines are parallel. Parallel lines never meet, so k is three. Comment DESMOS for more tricks.",
  "beats": [
    { "at": 0, "title": ["y = 3x + 5", "y = kx - 2"], "sub": "No solution. k = ?" },
    { "say": "Type both lines", "type": ["y = 3x + 5", "y = kx - 2"] },
    { "say": "a slider", "slider": "k", "min": -5, "max": 5, "value": -1 },
    { "say": "drag it", "drag": "k", "to": 3 },
    { "say": "so k is three", "answer": "k = 3" }
  ],
  "cta": { "say": "Comment", "word": "DESMOS" } }
```

### 5c. Stage beats

`"style": "stage"`. Beats, `count`, `lines` (terminal), `tag`, `cta` and `sounds` work as in 5a, with the same objects, drawn solid on a round plinth. The differences:

- **Each beat holds at least 1.5 s.** Stage is calmer: an object rises out of the plinth, the narrator points at it, it turns slowly. Use fewer beats than Wireframe; one per sentence is plenty.
- **`"narrator": "figure.json"` (required)**: their figure from 3b. Two figures (`["me.json", "friend.json"]`) stand either side of the plinth; then `"speakers"` is required too, saying whose mouth moves from which word: `[{ "at": 0, "who": "me.json" }, { "say": "But", "who": "friend.json" }]` (the voice is still one file).
- **`"turn": { "say": "But here's" }`** (optional): from that word the stage goes deep navy under one spotlight, and the narrator thinks for a moment, hand on chin. **`"turnBack": { "say": "..." }`** brings the light back (at least 1 s later). Use it for the twist in the story: a problem, a catch, "most people get this wrong". Once a video, or not at all.
- The words in each beat's `say` show in the caption in the brand colour, in italics. So `say` the word that matters ("folder", not "one").
- `count` from 2 to 4 stands in a row; 5 or 6 stand in two rows.

```json
{ "name": "studio-folder", "style": "stage", "brand": "goat", "language": "en", "script": "script.txt", "voice": "voice.m4a",
  "narrator": "figure.json",
  "beats": [ { "at": 0, "object": "laptop" }, { "say": "AI workers", "object": "robot", "count": 4, "tag": "24/7" } ],
  "turn": { "say": "But here's" },
  "cta": { "say": "Comment", "word": "GOAT" } }
```

### 5d. Collage beats

`"style": "collage"`. Beats, `count`, `cta` and `sounds` work as in 5a; `lines` and `tag` aren't drawn. Each beat is a page: the object printed as a halftone cut-out on a brand-colour circle or bar (the two layouts take turns), and the beat's words slamming in one at a time. The next beat pulls the page away.

- **Each beat holds at least 1.2 s.**
- **The words in `say` are printed huge** and stay for the whole page; the other words come in small, one caption line at a time. So `say` the one word that carries the idea ("Зардал", "AI баг"), and keep it short: one or two words.
- `count` from 2 to 6 shows that many cut-outs, smaller.
- **Their own photos:** a beat can show `"photo": "photos/shop.jpg"` (a file in the project folder) instead of an `"object"`: their shop, product, team or face, printed in the same halftone. Ask for photos when the script names something real of theirs; look at each one so you put it on the word that names it, and never stand an object in for a photo they have. A normal photo is printed as a rectangle with a paper border. A PNG with the background removed is cut out round its outline, which looks best for people and products: on a Mac, open the photo in Preview, then Tools → Remove Background, then File → Export as PNG; on an iPhone, touch and hold the subject in Photos, then Share → Save Image. PNG, JPG or WEBP; a HEIC photo from an iPhone needs a JPG copy first (the checker prints the Mac command). The photos never leave their computer.
- `cta`: the last page stamps the word in white on the brand colour. If the voice says the word, it is stamped as it's said.

### 5e. Comic beats

`"style": "comic"`, with `"narrator": "figure.json"` (their figure from 3b) as the hero. Each beat is a comic panel, and the skill lays out the pages: a panel fills the screen (the words and faces stay clear of the app's caption and buttons), a hero close-up right after a panel lands as an inset on it, and `count` copies stand in slanted columns. Each caption line shows as a speech bubble when the hero is in the panel and as a yellow narration box when not; the words in `say` are in the brand colour.

| Beat field | What the panel shows |
|---|---|
| `object` | the object, inked, on a sky-blue or dotted background |
| `object` + `"villain": true` | the object as the bad guy: big, from below, angry eyes and teeth, on a night sky. Use it for the problem (a competitor, deadlines, cheap prices) |
| `"hero": "face"` | a close-up of the hero talking (no object needed). Right after a page with one full panel (and without `impact`) it lands as an inset on that page; otherwise it fills a page of its own. Don't put two close-ups in a row |
| `"hero": "point"` | the hero in a power pose on a burst, the `object` (optional) floating beside them |
| `"hero": "think"` | the hero thinking, hand on chin |
| `"count": 2` or `3` | that many copies of the object, one per slanted column (3 at most) |
| `"impact": true` | a quick red, black and white flash (0.13 s) on the word, then the panel lands. Two or three in a video, on the big turns, never on the first beat (the first frame is the thumbnail) |
| `"sfx": "ТАС!"` | a sound word, huge, in the brand colour (8 characters at most): ТАС! for a hit, ШУУ! for speed, ПАД! for a thud |
| `tag` | a small name card (as in 5a) |

- **Each beat holds at least 1.5 s.** A story reads best as: the villain first, the hero's reaction as a close-up, an impact on the turn, then the answers.
- `cta` ends on the comment box with the word stamped above it. `lines` and `photo` aren't drawn.

```json
{ "name": "price-war", "style": "comic", "brand": "goat", "language": "mn", "script": "script.txt", "voice": "voice.m4a",
  "narrator": "figure.json",
  "beats": [
    { "at": 0, "object": "shop", "villain": true },
    { "say": "Одоо", "hero": "face" },
    { "say": "бүү", "hero": "point", "object": "coins", "impact": true },
    { "say": "AI", "object": "robot", "count": 3, "sfx": "ТАС!", "tag": "AI БАГ" }
  ],
  "cta": { "say": "коммент", "word": "GOAT" } }
```

## 6. Render

Run `anim render plan.json` (in the background or with a 600000 ms timeout). If it prints problems, each line says what to change in the plan (a word it can't find lists the words around there; two beats too close says by how much). Fix them all and run it again; don't show the user these errors unless you need their help. When it works it prints the video and a contact sheet: `out/<name>.mp4` and `out/<name>-sheet.jpg`.

## 7. Check it before you show it

Open the contact sheet image and look at it yourself first. It shows one frame per second, six to a row. A frame caught in the middle of a change shows the object broken into short lines: that is the transition, and it is normal.
- Every object is recognisable and is the one its words name (and the right count).
- The first frame isn't empty, and nothing is cut off at the edges.
- The captions read the script's words.

Fix the plan and render again if anything is off. (App Explainer: the contact sheet should show the typed lines, the slider moving, and the answer in the last frames, with no text cut off.) (Stage: the narrator is whole and beside the plinth, never covering the object; the caption sits top left. Collage: the big word of each page reads whole, and no small words run off the right edge. Comic: every bubble's tail points at the hero, nothing covers a face, and each object sits whole in its panel.) Then give the user the path to the MP4 and ask what they would change. Never post or send the video anywhere for them.

## The look: what fails even if it renders

- Centred text on a gradient background, with everything fading in the same way.
- Everything moving at once. The objects arrive on their word; nothing else moves for no reason.
- A small graphic floating in empty space, or a cluttered frame. One idea fills the frame at a time.
- Loud sound: a sound on every beat, or two sounds closer than 0.5 s.
- Captions with a highlight colour, a box behind them, or a pop.

## Other looks: Lemo-Opuscar

When the user wants a look these five styles don't have, or the look of a picture or video they like, hand off to **Lemo-Opuscar**, a separate free skill by Lemomo (https://github.com/lemomo-ai/lemo-opuscar): 99 film styles made in code, and a way to make their own style from a description, a picture or a video.

1. Tell them in a few plain lines what changes: it's another skill, not this one; a film takes it 30–60 minutes and a good share of their Claude usage; its films are landscape 16:9 unless they ask for vertical (1080×1920 for Reels); the films they make are theirs, with no credit needed.
2. Check that it's installed: `claude plugin list --json` lists an entry whose `id` is `lemo-opuscar@lemolab` and whose `enabled` is true. If it's missing, ask before installing (it's their computer), then run `claude plugin marketplace add lemomo-ai/lemo-opuscar` and `claude plugin install lemo-opuscar@lemolab`, and ask them to type `/reload-plugins`. It needs Node 20+, ffmpeg 7+ and Python 3.11+; if one is missing, say which.
3. Hand over: run the skill `lemo-opuscar:lemo-opuscar` with their request in one sentence (the style, or "my own style from this picture/video" with the file; the topic; the length; vertical if it's for Reels; their voice file if they recorded one). From then on, follow that skill, not this one.

Never copy its guides or style files into this skill or the user's project by hand, and never pass it the figures in `figures/` (they are GOAT's own).
