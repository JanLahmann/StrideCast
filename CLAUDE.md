# StrideCast: notes for Claude

## Project

- A Raspberry Pi reads a Kettler ELYX 5 cross trainer over USB, offers it over Bluetooth LE (FTMS, Cycling Power), and serves live stats to a browser on the TV.
- Not a Fun-with-Quantum family member: no family footer, no Umami, no family links unless Jan says so.
- Background notes, patches and build scripts: `~/GitHub/FwQ-Coordinator/docs/projects/elyx-kettler/`.
- The qz logs in `~/GitHub/RasQberry-Two/.local/elyx-kettler/` contain heart-rate data. Never commit or copy them anywhere.

## Licensing

- This repo is Apache-2.0.
- Never copy GPL code from qdomyos-zwift (QZ) into this repo. Reference upstream and install it instead.
- MIT code (e.g. gnep88/kettlerUSB2BLE) may be included, with its license notice kept.

## Devices

- `rasq-pi5` is the RasQberry rig Pi and is shared. Check with the RasQberry session before using it, and leave it as you found it.
- No credentials on any device.

## Commits and PRs

- Branch from `main`, open a PR, merge after green checks with `gh pr merge --squash --delete-branch`.
- No force-push; use follow-up commits.
- Commits end with the `Co-Authored-By: Claude …` line and the session line; PR bodies end with the "Generated with Claude Code" line and the session URL.

## Needs Jan's own word

- Going public with anything new (site, domain, app store, TV app store).
- Privacy or legal text.
- Secrets, costs, budgets.
- Deleting content.
- Contacting outside projects. Jan submits upstream PRs and issues himself; draft them for him.

## Other

- Never enter passwords or create accounts; Jan logs in himself. Never ask for tokens in chat. Secrets go in `~/.config/<name>/` (mode 600) and are used without printing.
- `~/ClaudeLogs` is private: never commit, copy or send it.
- American spelling in new texts. Compute every number you state.
