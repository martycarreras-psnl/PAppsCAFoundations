---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
"@pacaf/scripts": patch
---

Make the manual "add app to solution" fallback copy-paste-safe. When automatic
add-to-solution can't be confirmed, the suggested `pac solution
add-solution-component` command now embeds the real `appId` (no `<appId>`
placeholder to fill in) and explicitly warns it must be a SINGLE line — a pasted
line break before `--componentType` makes zsh run it as two broken commands
(`A required argument --componentType is missing` + `command not found:
--componentType`). `manualSolutionAddSteps` gains an optional `appId` argument;
both deploy-step copies (CLI `@pacaf/wizard` and browser `@pacaf/wizard-ux`)
pass it through.
