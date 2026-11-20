"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from "react";
import { createOfficeWorld } from "./office-world";
import {
  beginRound, days, filledShifts, interact, newRound, nextAction, settings, shifts, stepRound, stopStamp, walk,
  type Round,
} from "./round";
import { createSound, type Sound } from "./sound";

const keyboards = [
  { up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD", use: "Space", guide: "WASD", action: "Space" },
  { up: "ArrowUp", left: "ArrowLeft", down: "ArrowDown", right: "ArrowRight", use: "Enter", guide: "↑ ← ↓ →", action: "Enter" },
];
const swapKey = "KeyQ";
const gameKeys = [...keyboards.flatMap(({ up, left, down, right, use }) => [up, left, down, right, use]), swapKey];
const critterNames = ["duck", "bunny"];
const stickReach = 46;

function clock(seconds: number) {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function snapshot(round: Round) {
  return {
    phase: round.phase,
    time: settings.duration - round.elapsed,
    filled: filledShifts(round),
    slots: shifts.map((_, i) => round.requests[i]?.at.place === "board"),
    players: round.players.map((player, i) => ({
      carrying: player.carrying ? shifts[player.carrying.shift].label : "",
      approved: player.carrying?.approved ?? false,
      stamp: player.stamping ? (player.carrying?.stamp ?? 0) / settings.stampTime : 0,
      stamping: player.stamping,
      prompt: player.messageUntil > round.elapsed ? player.message : nextAction(round, i),
    })),
  };
}

export default function ShiftHappens() {
  const host = useRef<HTMLDivElement>(null);
  const round = useRef(newRound());
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0, pointer: -1, originX: 0, originY: 0 });
  const knob = useRef<HTMLSpanElement>(null);
  const sound = useRef<Sound | null>(null);
  // Player 1's controls (WASD, Space and the touch controls) drive this critter. Swapping lets one person play both.
  const active = useRef(0);
  // Which critter to mark and follow: always on touch screens, and on keyboards once someone swaps.
  const focus = useRef<number | null>(null);
  const holding = useRef(new Map<string, number>());
  const [lead, setLead] = useState(0);
  const [view, setView] = useState(() => snapshot(newRound()));
  const [graphics, setGraphics] = useState<"loading" | "ready" | "failed">("loading");
  const [muted, setMuted] = useState(false);

  function press(code: string) {
    sound.current?.unlock();
    if (round.current.phase !== "playing" || keys.current.has(code)) return;
    keys.current.add(code);
    if (code === swapKey) {
      swap();
      return;
    }
    const control = keyboards.findIndex(entry => entry.use === code);
    if (control === -1) return;
    const critter = control === 0 ? active.current : 1;
    holding.current.set(code, critter);
    interact(round.current, critter);
  }

  function release(code: string) {
    if (!keys.current.delete(code)) return;
    const critter = holding.current.get(code);
    holding.current.delete(code);
    if (critter !== undefined) stopStamp(round.current.players[critter]);
  }

  // Keyboard listeners live in an effect, so they reach the latest press and release through effect events.
  const onKeyDown = useEffectEvent((code: string) => press(code));
  const onKeyUp = useEffectEvent((code: string) => release(code));

  function swap() {
    if (round.current.phase !== "playing") return;
    const previous = active.current;
    holding.current.forEach((critter, code) => {
      if (critter !== previous || code !== keyboards[0].use) return;
      stopStamp(round.current.players[critter]);
      holding.current.delete(code);
      keys.current.delete(code);
    });
    active.current = 1 - previous;
    focus.current = active.current;
    setLead(active.current);
    sound.current?.play("swap");
  }

  useEffect(() => {
    const viewport = host.current;
    if (!viewport) return;
    const effects = createSound();
    sound.current = effects;
    if (window.matchMedia("(pointer: coarse)").matches) focus.current = 0;
    // Sync the saved preference after mount, so server and client render the same markup first.
    setMuted(effects.muted);
    let world: ReturnType<typeof createOfficeWorld> | undefined;
    let frame: number;
    let previous = performance.now();
    let lastUi = 0;
    let displayedPhase: Round["phase"] | undefined;
    let displayedRound: Round | undefined;

    function loop(now: number) {
      const state = round.current;
      const seconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      if (state.phase === "playing" && world) {
        const moves = state.players.map(() => ({ across: 0, downward: 0 }));
        const pressed = keys.current;
        keyboards.forEach(({ up, left, down, right }, i) => {
          const move = moves[i === 0 ? active.current : 1];
          move.across += Number(pressed.has(right)) - Number(pressed.has(left));
          move.downward += Number(pressed.has(down)) - Number(pressed.has(up));
        });
        moves[active.current].across += stick.current.x;
        moves[active.current].downward += stick.current.y;
        moves.forEach(({ across, downward }, i) => {
          const [dx, dz] = world!.toWorld(across, downward);
          walk(state, i, Math.abs(dx) < 1e-6 ? 0 : dx, Math.abs(dz) < 1e-6 ? 0 : dz, Math.min(.05, seconds));
        });
        stepRound(state, seconds);
      }
      world?.draw(state, focus.current);
      const changed = displayedRound !== state || displayedPhase !== state.phase;
      if (changed || (state.phase === "playing" && now - lastUi >= 80)) {
        setView(snapshot(state));
        lastUi = now;
        displayedRound = state;
        displayedPhase = state.phase;
      }
      frame = requestAnimationFrame(loop);
    }

    function keydown(event: KeyboardEvent) {
      if (!gameKeys.includes(event.code) || round.current.phase !== "playing" || event.metaKey || event.altKey || event.ctrlKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("a, button, input")) return;
      event.preventDefault();
      if (!event.repeat) onKeyDown(event.code);
    }
    function keyup(event: KeyboardEvent) {
      onKeyUp(event.code);
    }
    function clearKeys() {
      keys.current.clear();
      holding.current.clear();
      stick.current = { ...stick.current, x: 0, y: 0, pointer: -1 };
      round.current.players.forEach(stopStamp);
    }

    frame = requestAnimationFrame(now => {
      try {
        world = createOfficeWorld(viewport, effects);
      } catch {
        setGraphics("failed");
        return;
      }
      setGraphics("ready");
      loop(now);
    });
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
      world?.dispose();
    };
  }, []);

  function start() {
    sound.current?.unlock();
    keys.current.clear();
    holding.current.clear();
    active.current = 0;
    if (focus.current !== null) focus.current = 0;
    setLead(0);
    const state = newRound();
    beginRound(state);
    round.current = state;
    setView(snapshot(state));
    host.current?.focus({ preventScroll: true });
  }

  function toggleSound() {
    sound.current?.unlock();
    const next = !muted;
    sound.current?.setMuted(next);
    setMuted(next);
  }

  function moveStick(x: number, y: number) {
    const { originX, originY } = stick.current;
    let dx = x - originX;
    let dy = y - originY;
    const length = Math.hypot(dx, dy);
    if (length > stickReach) {
      dx = dx / length * stickReach;
      dy = dy / length * stickReach;
    }
    const strength = Math.min(1, length / stickReach);
    stick.current.x = strength > .22 ? dx / stickReach : 0;
    stick.current.y = strength > .22 ? dy / stickReach : 0;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function stickDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    sound.current?.unlock();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    stick.current = { x: 0, y: 0, pointer: event.pointerId, originX: box.left + box.width / 2, originY: box.top + box.height / 2 };
    moveStick(event.clientX, event.clientY);
  }

  function stickMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === stick.current.pointer) moveStick(event.clientX, event.clientY);
  }

  function stickUp() {
    stick.current = { ...stick.current, x: 0, y: 0, pointer: -1 };
    if (knob.current) knob.current.style.transform = "";
  }

  function actionDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    press("Space");
  }

  const urgent = view.time <= 20 && view.phase === "playing";
  const solo = view.players[lead];

  return (
    <main className="shifts">
      <header className="shifts-head">
        <h1>Shift Happens<span>!</span></h1>
        <div className="shifts-score" aria-label="Round score">
          <span><small>Covered</small><strong>{view.filled}<i> / {shifts.length}</i></strong></span>
          <span className={urgent ? "shifts-urgent" : undefined}>
            <small>Time left</small><strong>{clock(view.time)}</strong>
          </span>
          <button type="button" className="shifts-sound" onClick={toggleSound}
            aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>{muted ? "🔇" : "🔊"}</button>
        </div>
      </header>

      <section className="shifts-board" aria-label="Weekly roster">
        {days.map((day, i) => (
          <div className="shifts-day" key={day}>
            <b>{day}</b>
            {([i, i + days.length]).map(index => (
              <span key={index} data-filled={view.slots[index]}
                aria-label={`${shifts[index].label} ${view.slots[index] ? "covered" : "open"}`}>
                <span>{shifts[index].half}</span>{view.slots[index] ? "✓" : "–"}
              </span>
            ))}
          </div>
        ))}
      </section>

      <section className={urgent ? "shifts-game shifts-game--urgent" : "shifts-game"} aria-label="Office">
        <div className="shifts-floor" ref={host} tabIndex={0} />
        {view.phase === "playing" && (
          <div className="shifts-touch" aria-label="Player 1 touch controls">
            <div className="shifts-stick" onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp}
              role="presentation">
              <span ref={knob} />
            </div>
            <div className="shifts-action">
              <button type="button" className="shifts-swap" onPointerDown={event => { event.preventDefault(); swap(); }}
                aria-label={`Switch to the ${critterNames[1 - lead]}`}>
                <span aria-hidden="true">{lead === 0 ? "🐰" : "🐥"}</span>
                <small>Swap</small>
              </button>
              {solo.carrying && (
                <b className={solo.approved ? "shifts-approved" : "shifts-request"}>{solo.carrying}{solo.approved ? " ✓" : ""}</b>
              )}
              <button type="button" onPointerDown={actionDown} onLostPointerCapture={() => release("Space")}
                onPointerUp={() => release("Space")}>
                {solo.stamping ? "Stamping…" : solo.prompt}
              </button>
            </div>
          </div>
        )}
        {(view.phase !== "playing" || graphics === "failed") && (
          <div className="shifts-overlay">
            <div>
              {graphics === "failed" ? (
                <><h2>Office couldn’t load</h2><p>Open this game in a browser with WebGL 2 enabled.</p></>
              ) : view.phase === "ready" ? (
                <>
                  <h2>Cover the week</h2>
                  <p>Grab requests from the inbox. Stamp them at the manager’s desk. Pass them over the counter and pin them to the roster.</p>
                  <p className="shifts-tip">Playing alone? Swap between the duck and the bunny with <kbd>Q</kbd> or the swap button.</p>
                  <button disabled={graphics !== "ready"} onClick={start}>Start round</button>
                </>
              ) : (
                <>
                  <h2>{view.phase === "won" ? "Fully rostered!" : "Understaffed"}</h2>
                  <p>{view.phase === "won" ? `${clock(view.time)} to spare` : `${view.filled} of ${shifts.length} shifts covered`}</p>
                  <button onClick={start}>Play again</button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="shifts-controls" aria-label="Player controls">
        {keyboards.map(({ guide, action }, i) => {
          // Player 1's keys follow whichever critter they have swapped to.
          const critter = i === 0 ? lead : 1;
          const player = view.players[critter];
          return (
            <section className="shifts-player" key={action} aria-label={`Player ${i + 1}, controlling the ${critterNames[critter]}`}>
              <strong className="shifts-player-tag" data-critter={critter}>P{critter + 1}</strong>
              <div>
                <div className="shifts-keys">
                  <kbd>{guide}</kbd> <kbd>{action}</kbd>
                  {i === 0 && <> · <kbd>Q</kbd> swap</>}
                </div>
                {view.phase === "playing" && (
                  <div className="shifts-prompt">
                    {player.carrying && <span className={player.approved ? "shifts-approved" : "shifts-request"}>{player.carrying}{player.approved ? " ✓" : ""}</span>}
                    <span>{player.stamping ? "Stamping…" : player.prompt}</span>
                  </div>
                )}
              </div>
              {player.stamping && <progress aria-label={`The ${critterNames[critter]}’s approval progress`} value={player.stamp} max={1} />}
            </section>
          );
        })}
      </div>
    </main>
  );
}
