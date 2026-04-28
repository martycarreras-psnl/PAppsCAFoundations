# Image Generation Prompt — Foundations Workflow Journey

Use this prompt with an image generation model (Midjourney, DALL-E 3, Imagen, Ideogram, GPT-Image, etc.) to produce a single clear "journey map" infographic of the Power Apps Code Apps Foundations workflow.

> **Tip:** Ideogram and GPT-Image handle embedded text best. Midjourney produces the strongest aesthetic but garbles long labels — for Midjourney, use the **short label variant** at the bottom of this file.

---

## Primary Prompt (text-friendly models — Ideogram, GPT-Image, DALL-E 3)

```
A polished, modern infographic-style horizontal journey map illustrating a 10-step developer workflow titled "Power Apps Code Apps Foundations — From Template to Production". Clean, professional Microsoft Fluent design language: white background, generous whitespace, rounded corners, subtle drop shadows, and a confident gradient accent flowing left-to-right from azure blue (#0078d4) through plum purple (#5c2d91) to teal green (#008272).

Layout: ten numbered hexagonal or rounded-square nodes arranged along a gently curving horizontal path, connected by a glowing gradient ribbon that reads as a single continuous story. Each node contains a clean line-art icon, a short bold label, and a one-line caption. Each node is numbered 1–10 in a small circular badge.

The ten nodes, in order:

1. "Use the Template" — icon of a GitHub repo with a copy/fork glyph. Caption: "Click 'Use this template' on GitHub. Get a fresh repo in seconds."

2. "Run the Wizard" — icon of a friendly terminal window with a sparkle. Caption: "Guided setup: publisher, solution, auth, and your first deploy."

3. "Sample App Live" — icon of a browser window showing a small Power Apps shield checkmark. Caption: "Confirm the starter app is running in your Power Platform environment."

4. "Plan Mode in VS Code" — icon of a VS Code window with a lightbulb and a notepad. Caption: "Use Copilot Plan mode to shape the concept before writing code."

5. "Agent Mode Builds the POC" — icon of a VS Code window with a small robot/agent badge and a code bracket. Caption: "Switch to Agent mode and watch the POC come together."

6. "Connect Connectors" — icon of two interlocking puzzle pieces or plug-and-socket with small connector logos floating around it. Caption: "Add Office 365, SharePoint, SQL, custom — any connector by URL."

7. "Bind to Dataverse" — icon of a stacked-cylinder database with the Dataverse hex glyph. Caption: "Generate typed data sources from your Dataverse tables."

8. "Test" — icon of a checkmark inside a magnifying glass over a sheet of paper. Caption: "Run unit, integration, and smoke tests before you share."

9. "Share & Collaborate" — icon of three friendly user avatars with a share/handshake glyph. Caption: "Invite users to test, comment, and collaborate."

10. "Promote with Pipelines" — icon of a pipeline with a rocket emerging on the right and a small "TEST" environment badge. Caption: "Use Power Platform Pipelines to promote from Dev to Test."

Visual style: flat-but-dimensional, vector illustration aesthetic, soft shadows, isometric-friendly icons, no photorealism, no stock clipart feel. Typography: clean sans-serif (Segoe UI / Inter / SF Pro feel), bold step labels, lighter captions. Use color accents sparingly — primarily azure/plum/teal — to keep the eye moving along the ribbon.

Subtle background details: a faint dotted grid, soft floating geometric shapes (hexagons, circles, squares) at low opacity in the corners. Bottom-right corner: small "Power Apps Code Apps Foundations" wordmark.

Mood: confident, approachable, "this is the modern way to ship a Power App." High clarity, zero clutter, instantly readable in 5 seconds.

Aspect ratio: 16:9 widescreen, suitable for a blog header, conference slide, or LinkedIn banner. Resolution: high detail, print-ready.
```

---

## Short-Label Variant (for Midjourney / models that struggle with long text)

Use this if the primary prompt produces garbled labels. Midjourney handles short text best; supply the captions separately in your blog post.

```
Polished horizontal infographic journey map, 10 numbered steps connected by a flowing gradient ribbon (azure blue to plum purple to teal green). Microsoft Fluent design, white background, soft shadows, modern flat-vector illustration. Each step is a rounded-square node with a clean line-art icon and a short bold label.

Steps in order, left to right:
1) "Template" — GitHub repo icon
2) "Wizard" — terminal with sparkle
3) "Live" — browser with checkmark
4) "Plan" — VS Code with lightbulb
5) "Build" — VS Code with robot/agent
6) "Connect" — puzzle pieces / plug
7) "Dataverse" — database cylinder with hex
8) "Test" — checkmark in magnifier
9) "Share" — group of avatars
10) "Promote" — pipeline with rocket

Title at top: "Code Apps Foundations — Template to Production". Subtle dotted grid background, faint floating hexagons. 16:9 widescreen, conference-slide quality, print-ready, instantly readable in 5 seconds.

--ar 16:9 --style raw --v 6
```

---

## Negative Prompt (if your model supports one)

```
photorealistic, 3D render, cluttered, busy, dark background, neon, cyberpunk, generic stock illustration, hand-drawn doodle, watercolor, low contrast text, more than 10 steps, vertical layout, mobile portrait
```

---

## Style Notes

- **Color palette is intentional**: it matches the existing [docs/index.html](docs/index.html) hero gradient (#0078d4 → #5c2d91 → #008272), so the image will feel native to the site.
- **Ten steps is the upper limit** for "glance comprehension." If the model struggles, group steps 6+7 (Connect + Dataverse) into a single "Bind Data" node and reduce to 9.
- **Icons over screenshots**: real screenshots of VS Code or the Power Platform admin center will date the image quickly and crowd it visually. Iconographic abstractions age better.
- **The ribbon matters**: the connecting flow line is what makes this read as a *journey* rather than a checklist. Reinforce it in any iteration prompts.

---

## Iteration Hints

If the first generation isn't quite right:

- **Too cluttered?** Add: "extreme minimalism, generous whitespace, only 3 colors plus white"
- **Text garbled?** Switch to the short-label variant, or use a model with native text rendering (Ideogram, GPT-Image)
- **Feels generic?** Add: "in the style of a Microsoft Build keynote slide" or "in the style of a Stripe documentation diagram"
- **Wrong aspect?** Append `aspect ratio 16:9` and `widescreen banner` explicitly
- **Want more energy?** Add: "subtle motion blur on the ribbon, suggesting forward momentum"
