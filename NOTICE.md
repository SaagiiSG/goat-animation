# Third-party files

The code in this repository is MIT-licensed (see LICENSE). These bundled files keep their own licences:

- **Fonts** in `skills/goat-animation/fonts/` (Inter, JetBrains Mono, STIX Two Text, Oswald, PT Serif Italic, Shantell Sans, Science Gothic): SIL Open Font License 1.1. Each family's licence text sits next to it as `OFL-*.txt`.
- **three.js** r170 in `skills/goat-animation/shared/three/` (the core module and the addons used): MIT License, © 2010-2024 three.js authors. The licence text is `shared/three/LICENSE`.
- **Sound effects** (`skills/goat-animation/sfx/*.wav`): made in code by GOAT Academy, part of this repository's MIT code.
- **Brand files** in `skills/goat-animation/brands/`: the GOAT and flowersos colours, and the flowersos flower mark (`flowersos-mark.svg`), which belongs to flowersos and is included for flowersos's own videos.
- **The built-in figure** `skills/goat-animation/figures/saagii.json` describes the paper figure of Saran-Ochir Sergelen (GOAT Academy), included with his permission for GOAT's own videos.

Downloaded or used at run time, not bundled:

- **HyperFrames** (https://github.com/heygen-com/hyperframes), run with `npx hyperframes@0.9.72`: Apache License 2.0, by HeyGen. It draws the frames in a private copy of Chrome and runs Whisper locally.
- **Whisper large-v3-turbo** speech model, downloaded by HyperFrames and run with whisper.cpp: MIT License, by OpenAI (model) and ggml-org (whisper.cpp).
- **GSAP** (https://gsap.com), loaded from jsDelivr by the templates: GSAP's own standard licence (free to use).

The caption grouping, pacing and silence rules in `skills/goat-animation/scripts/lib/words.mjs` are adapted from Nate Herk's herk-edit-kit (https://github.com/nateherkai/herk-edit-kit), under this notice:

> MIT License
>
> Copyright (c) 2026 Nate Herk
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

- **Poster** (`assets/poster.jpg`): frames from GOAT Academy's own test videos made with this skill, including Saran-Ochir Sergelen's paper figure, used with his permission.
