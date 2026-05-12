---
'@pacaf/wizard-ux': patch
---

Switch Step 5 `pac env fetch` calls from `--xml` (inline FetchXML) to
`--xmlFile` (temp file) to avoid `System.Xml.XmlException` on macOS PAC CLI
2.2.1+ where inline XML attribute quotes get corrupted. Closes #23.
