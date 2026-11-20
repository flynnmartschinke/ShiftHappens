# OverRostered

A low-poly browser game about filling the Friday-night café roster. Play solo or share a keyboard with a second coordinator.

[Play the live demo](https://shift-says-back.drybee16.chatgpt.site)

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
