---
"@pacaf/wizard-ux": patch
---

Step 7 (Scaffold): show an info banner while `pac code init` is running, letting users know that scaffolding can take a few minutes and asking them to keep the tab open and maintain their network/VPN connection. Closing the tab, sleeping the machine, or dropping the network mid-run can interrupt PAC CLI auth and leave the scaffold in an incomplete state — the banner heads that off before users assume the wizard has hung.
