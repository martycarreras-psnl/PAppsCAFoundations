# Third-Party Notices

This file documents third-party works that have been adapted, incorporated, or
referenced in this repository. Each entry includes the source, license, and a
description of what was adapted.

---

## grill-with-docs

**Source:** https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs
**Author:** Matt Pocock
**License:** MIT

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**What was adapted:** The interview cadence (one question at a time with a
recommended answer, depth-first dependency resolution), the `CONTEXT.md` living
glossary pattern (format, rules, and inline-update discipline), and the ADR
gating criteria (hard-to-reverse + surprising + real trade-off) were adapted
into `.github/instructions/00e-grill-and-document.instructions.md` with
PACAF-specific additions: Dataverse-aware glossary bridge, Code-App ADR trigger
list, and integration with the planning-payload artifact workflow.
