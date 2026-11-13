# Torn Crimes 2.0 Assistant

A userscript that adds advice to Torn's Crimes 2.0 page. It reads the page and never clicks, so every action stays with the player. It needs no API key.

## Install

Open this link with Tampermonkey or Torn PDA installed:

https://raw.githubusercontent.com/mat-mcc-uk/mat-mcc-uk-torn-crimes-assistant/main/crimes-assistant.user.js

Both will pick up new versions from the same link.

## What it covers

| Crime | What you see |
|---|---|
| Scamming | Outlines the response to press, with fail and reward chances for each option, planned three moves ahead |
| Arson | Flammability, rurality, burn time against responder time, and a starter count on every job |
| Burglary | "Case first", "Case once more" or "Burgle now" per target, from its confidence and status |
| Card Skimming | Recover advice per skimmer, sale value, distance to the next price tier, honour progress |

Each crime has a "hide" switch in its hint bar. Run `CCA.reset()` in the console to bring every module back.

## Known limits

- Scamming move ranges come from a community guide. Banked Accelerate stacks are not tracked.
- Arson coaching during a live fire is not built yet.
- Burglary target names may differ from the guide's; unknown names get advice without a casing count.

## Development

All rule data sits in the `RULES` object at the top of the script. The decision logic is pure and tested:

```
node test.js
```

## Credits

Rules and data come from the "[Crimes 2.0] In-Depth Guide" series on the Torn forums and its linked reference sheets.
