# OverRostered

A low-poly browser game about filling the Friday-night café roster. Play solo or share a keyboard with a second coordinator.

[Play Shift Happens!](https://vetematts.github.io/ShiftHappens/) · [Café demo](https://shift-says-back.drybee16.chatgpt.site)

## Shift Happens! playtest

After starting the local server, open `/shift-happens` for the separate office game. Two players share one keyboard. Player 1 uses **WASD** and **Space**. Player 2 uses the **arrow keys** and **Enter**. Hold the action key at the manager’s desk to approve a request, set it on a counter pad, then pick it up from the other side and pin it at the board. Fill all 14 weekly shifts before 2:00 runs out.

Playing alone? Press **Q**, or the swap button on a phone, to switch between the duck and the bunny. On a phone, Player 1 moves with the thumb stick and uses the round action button. The office lowers its detail automatically on slower devices. Add `?quality=high` or `?quality=low` to the address to fix the detail level.

### Publish the shared-keyboard demo

Run `npm run build:demo` to generate the static site in `out/shift-happens`. You can serve that directory with any static web host.

GitHub Pages publishes the office game automatically after every push to `main`, including merged pull requests. It needs **GitHub Actions** selected once under **Settings → Pages → Source**. To republish without a new commit, open **Actions**, select **Publish Shift Happens demo** and run it from `main`. The workflow uploads only the static game. Online rooms will need a server to synchronise play. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## How to play

Start a round, talk to an available worker, and lead them to an empty station. Jo can cover Grill or Pass, Rae can cover Pass or Floor, and Kit can cover Floor. Pick carefully and use **Undo** to move someone out of a slot. You win by filling all four stations within 65 seconds while keeping everyone within the fictional 40-hour limit.

- Player 1 uses **WASD** and **E**.
- Player 2 joins with the **arrow keys** and uses **Enter** to interact.
- Tap a destination and the action button to play with touch.

The staff view shares the same fictional roster. Staff replies are scripted.

## Run locally

Use Node.js 22.13 or newer. From this folder run:

```sh
npm ci
npm run build
npm run db:init
npm start
```

Run `db:init` once per checkout to create the local Cloudflare D1 table. Open the loopback URL printed by Wrangler. Browser graphics use WebGL 2.

For later code changes, run `npm run build` and restart `npm start`. The publishing checkout for the public demo is separate. GitHub pushes do not automatically publish a new live version.
