# OverRostered

A low-poly browser game about filling the Friday-night café roster. Play solo or share a keyboard with a second coordinator.

[Play Shift Happens!](https://vetematts.github.io/ShiftHappens/) · [Café demo](https://shift-says-back.drybee16.chatgpt.site)

## Shift Happens! playtest

After starting the local server, open `/shift-happens` for the separate office game. Two players share one keyboard. Player 1 uses **WASD** and **Space**. Player 2 uses the **arrow keys** and **Enter**. Staff wait at the table, each wearing a cap in their role colour (barista, kitchen or register). Their name tag shows the days they can work and the shifts they have left. Grab someone, hold the action key at the manager’s desk to sign them on (once per person), pass them over the counter, then stand at a day on the board and roster them onto a shift that matches their role on a day they can work. Nobody works two shifts in one day. After a shift they head home and come back while they have hours left. Sick calls knock people off the board, so refill those shifts too. Cover every needed shift before 3:00 runs out, then copy the finished roster from the end screen.

**Quick play** uses a sample café team. **Run it for real** lets you enter your own staff (name, role, days, shifts) and the shifts the week needs. It warns about any shift nobody can work and saves the team on that device.

Playing alone? Press **Q**, or the swap button on a phone, to switch between the duck and the bunny. Want phones as gamepads instead? See [Phones as controllers](#phones-as-controllers-jackbox-style). On a phone, Player 1 moves with the thumb stick and uses the round action button. The office lowers its detail automatically on slower devices. Add `?quality=high` or `?quality=low` to the address to fix the detail level.

### Phones as controllers (Jackbox-style)

Like a Jackbox party game, the laptop or projector shows the game and phones become the gamepads. Nobody installs anything.

1. Open the game on the laptop and select **Or use phones as controllers** on the start screen.
2. A QR code and a four-letter room code appear. Scan the QR code with a phone camera.
3. The first phone becomes the duck and the second becomes the bunny. The start screen ticks off each one as it connects.
4. Select **Start round** on a phone, or start from the laptop. Each phone shows a thumb stick, an action button, what its critter is holding and what the action button will do next.

Extra phones wait and take over a critter as soon as a phone leaves. The keyboard keeps working, so one phone and one keyboard player can play together.

**How it works.** There is no game server. The QR code opens the same GitHub Pages site with the room in the address (`#join-ABCD`). The laptop and phones find each other through public Nostr relays using [Trystero](https://github.com/dmotz/trystero), then talk directly over WebRTC. The laptop runs the whole game. Phones send their stick and button about 20 times a second, and the laptop sends each phone its critter's status 5 times a second. The game contacts the relays only after someone selects the phones button.

**Before a demo.** Test on the real Wi-Fi with real phones. Some venue and mobile networks block direct connections. If a phone stays on *Joining room…*, put the phones on the same Wi-Fi as the laptop or fall back to the keyboard.

**Testing without phones.** Add `?link=local` to the laptop's address and select the phones button. Then open `index.html#join-CODE-local` in other tabs of the same browser, with the room code in place of `CODE`. The tabs talk through the browser instead of the network.

### Publish the shared-keyboard demo

Run `npm run build:demo` to generate the static site in `out/shift-happens`. You can serve that directory with any static web host.

GitHub Pages publishes the office game automatically after every push to `main`, including merged pull requests. It needs **GitHub Actions** selected once under **Settings → Pages → Source**. To republish without a new commit, open **Actions**, select **Publish Shift Happens demo** and run it from `main`. The workflow uploads only the static game, and the phone controllers need nothing else. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

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
