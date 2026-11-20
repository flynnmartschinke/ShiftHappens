"use client";

import { useEffect, useRef, useState } from "react";
import { createCafeWorld, stations, type Point } from "./cafe-world";
import { assignedWorker, assignmentMask, assignments, atStation, completed, roles, type CoverRole, type CoverWorker, type ShiftAction, type Stage } from "./coverage";

const workers = {
  Jo: { home: { x: -4.45, z: 3.18 }, hours: 24, actor: 3, skills: "Grill or Pass" },
  Rae: { home: { x: 4.4, z: 3.18 }, hours: 32, actor: 4, skills: "Pass or Floor" },
  Kit: { home: { x: 3.55, z: -3.3 }, hours: 34, actor: 5, skills: "Floor" },
} as const;
const names: CoverWorker[] = ["Jo", "Rae", "Kit"];
const roundSeconds = 65;
const leadStart = { x: -1.65, z: 1.85 };
const partnerStart = { x: 1.65, z: 1.85 };
type Runner = { point: Point; angle: number; stride: number; escort: CoverWorker | null };
type Hud = { seconds: number; near: number; action: string; message: string; twoPlayers: boolean; lead: CoverWorker | null; partner: CoverWorker | null };

const initialHud: Hud = {
  seconds: roundSeconds, near: -1, action: "", message: "Mia called out. Grill, Pass and Floor need cover.",
  twoPlayers: false, lead: null, partner: null
};

const makeRunner = (point: Point): Runner => ({ point: { ...point }, angle: 0, stride: 0, escort: null });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const clampPoint = (point: Point): Point => ({
  x: Math.max(-7.35, Math.min(7.35, point.x)),
  z: Math.max(-4.4, Math.min(4, point.z)),
});
const hotspots = [...stations, ...names.map(name => workers[name].home)];
const pointOfInterest = (point: Point) => hotspots.findIndex(spot => distance(point, spot) < 1.10);
const inProgress = (stage: Stage | null) => stage !== null && stage > 0 && assignmentMask(stage) !== completed;

export default function CafeGame({ stage, send, busy }: {
  stage: Stage | null;
  send: (action: ShiftAction) => Promise<void>;
  busy: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const roster = useRef({ stage, send });
  const [hud, setHud] = useState<Hud>(initialHud);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const controls = useRef<{ go: (index: number) => void; act: () => void }>(null);

  const total = 1 + roles.filter(role => atStation(stage, role)).length;
  const won = total === 4;
  const timedOut = inProgress(stage) && hud.seconds === 0;
  const playing = inProgress(stage) && !timedOut;

  useEffect(() => { roster.current = { stage, send }; }, [stage, send]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let world: ReturnType<typeof createCafeWorld>;
    try {
      world = createCafeWorld(element);
    } catch {
      setFailed(true);
      return;
    }

    const keys = new Set<string>();
    const pending = new Set<CoverWorker>();
    const lead = makeRunner(leadStart);
    const partner = makeRunner(partnerStart);
    const staff = names.map(name => makeRunner(workers[name].home));
    const sam = makeRunner(stations[0]);
    let destination: Point | null = null;
    let twoPlayers = false;
    let message = initialHud.message;
    let animation = 0;
    let last = performance.now();
    let signature = "";
    let deadline = 0;
    let finishedWith: number | null = null;
    const canMove = () => inProgress(roster.current.stage) && (!deadline || performance.now() < deadline);

    function walk(runner: Runner, x: number, z: number, speed: number, dt: number) {
      const direction = Math.hypot(x, z);
      if (direction < .015) return false;
      const step = Math.min(speed * dt, direction);
      runner.point = clampPoint({
        x: runner.point.x + x / direction * step,
        z: runner.point.z + z / direction * step,
      });
      runner.angle = Math.atan2(x, z);
      runner.stride += dt * speed / 4.5;
      return true;
    }

    function actionFor(runner: Runner) {
      const near = pointOfInterest(runner.point);
      if (near === 0) return "Talk to Sam";
      if (near > 0 && near < stations.length) {
        const role = stations[near].name as CoverRole;
        if (atStation(roster.current.stage, role)) return "";
        return runner.escort ? `Assign ${runner.escort}` : "Check vacancy";
      }
      if (near >= stations.length) {
        const name = names[near - stations.length];
        return assignedWorker(roster.current.stage, name) ? "" : `Ask ${name} to cover`;
      }
      return "";
    }

    function interact(runner: Runner) {
      if (!canMove()) return;
      const near = pointOfInterest(runner.point);
      const other = runner === lead ? partner : lead;
      if (near === 0) {
        message = "Sam: “I’m on Till already. Another shift would take me to 43 hours.”";
      } else if (near >= stations.length) {
        const name = names[near - stations.length];
        const worker = workers[name];
        if (assignedWorker(roster.current.stage, name)) return;
        if (other.escort === name) {
          message = `${name} is already with the other player.`;
          return;
        }
        runner.escort = name;
        message = `${name}: “I can cover ${worker.skills}. That puts me on ${worker.hours + 4} hours.”`;
      } else if (near > 0) {
        const role = stations[near].name as CoverRole;
        const name = runner.escort;
        if (atStation(roster.current.stage, role)) {
          message = `${role} already has cover. Undo the assignment on the roster to switch it.`;
          return;
        }
        if (!name) {
          message = `${role} is vacant. Bring over a worker trained for this station.`;
          return;
        }
        const placement = assignments.find(item => item.worker === name && item.role === role);
        if (!placement) {
          message = `${name} is trained for ${workers[name].skills}.`;
          return;
        }
        if (pending.has(name)) return;
        pending.add(name);
        message = `Putting ${name} on ${role}…`;
        void roster.current.send(`assign-${placement.bit}`).finally(() => { pending.delete(name); });
      } else {
        message = "Move next to a worker or a station.";
      }
    }

    controls.current = {
      go(index) { destination = hotspots[index]; },
      act() { interact(lead); }
    };

    function keydown(event: KeyboardEvent) {
      if (!canMove() || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        destination = null;
        keys.add(key);
        event.preventDefault();
      } else if (key.startsWith("arrow")) {
        twoPlayers = true;
        element?.focus({ preventScroll: true });
        keys.add(key);
        event.preventDefault();
      } else if (key === "e" || (key === "enter" && twoPlayers && !(event.target instanceof HTMLButtonElement))) {
        event.preventDefault();
        if (!event.repeat) interact(key === "e" ? lead : partner);
      }
    }
    function keyup(event: KeyboardEvent) { keys.delete(event.key.toLowerCase()); }
    function blur() { keys.clear(); }
    function press(event: PointerEvent) {
      if (!canMove()) return;
      const point = world.pick(event.clientX, event.clientY);
      if (point) destination = clampPoint(point);
      element?.focus({ preventScroll: true });
    }

    function frame(now: number) {
      const dt = Math.min(.045, (now - last) / 1000);
      last = now;
      const stage = roster.current.stage;
      if (stage && !deadline) deadline = now + roundSeconds * 1000;
      const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : roundSeconds;
      if (assignmentMask(stage) === completed && finishedWith === null) finishedWith = remaining;
      const seconds = finishedWith ?? remaining;
      const movingAllowed = inProgress(stage) && seconds > 0;

      let dx = (Number(keys.has("d")) - Number(keys.has("a"))) * 10;
      let dz = (Number(keys.has("s")) - Number(keys.has("w"))) * 10;
      if (destination) {
        dx = destination.x - lead.point.x;
        dz = destination.z - lead.point.z;
        if (Math.hypot(dx, dz) < .045) destination = null;
      }
      const leadMoving = movingAllowed && walk(lead, dx, dz, 6.7, dt);
      world.person(0, lead.point, lead.angle, lead.stride, leadMoving);

      const side = Number(keys.has("arrowright")) - Number(keys.has("arrowleft"));
      const fore = Number(keys.has("arrowdown")) - Number(keys.has("arrowup"));
      const partnerMoving = movingAllowed && walk(partner, side * 10, fore * 10, 6.7, dt);
      world.person(1, partner.point, partner.angle, partner.stride, partnerMoving, twoPlayers);

      for (const [i, name] of names.entries()) {
        const worker = workers[name];
        const actor = staff[i];
        const assigned = assignedWorker(stage, name);
        const escort = lead.escort === name ? lead : partner.escort === name ? partner : null;
        if (assigned && escort) {
          escort.escort = null;
          message = `${name} is covering ${assigned.role}.`;
        }
        const spot = assigned ? stations[roles.indexOf(assigned.role) + 1] : worker.home;
        const offset = Math.sin(now / 730 + i) * .30;
        const target = assigned ? { x: spot.x + offset, z: spot.z } :
          escort ? { x: escort.point.x - .55, z: escort.point.z + .6 } : worker.home;
        const moving = walk(actor, target.x - actor.point.x, target.z - actor.point.z, assigned ? 4.6 : 6, dt);
        world.person(worker.actor, actor.point, actor.angle, actor.stride, moving);
      }
      const till = stations[0];
      const samMoving = walk(sam, till.x + Math.sin(now / 650) * .33 - sam.point.x, till.z - sam.point.z, 2.5, dt);
      world.person(2, sam.point, sam.angle, sam.stride, samMoving);

      world.render();
      const near = pointOfInterest(lead.point);
      const action = movingAllowed ? actionFor(lead) : "";
      const current = [seconds, near, action, message, twoPlayers, lead.escort, partner.escort].join("|");
      if (current !== signature) {
        signature = current;
        setHud({ seconds, near, action, message, twoPlayers, lead: lead.escort, partner: partner.escort });
      }
      animation = requestAnimationFrame(frame);
    }

    element.addEventListener("pointerdown", press);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    setReady(true);
    animation = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      element.removeEventListener("pointerdown", press);
      controls.current = null;
      world.destroy();
    };
  }, []);

  return <section className="cafe-game" aria-label="Friday Rush game">
    <div className="cafe-heading">
      <div><p>Juniper Café</p><h1>Friday Rush</h1></div>
      <div className="rush-score"><span>Shifts covered</span><strong>{total}<small> / 4</small></strong></div>
      <div className={`rush-score${playing && hud.seconds < 12 ? " rush-score--late" : ""}`}><span>Time left</span><strong>{hud.seconds}<small> s</small></strong></div>
    </div>
    <div className="cafe-layout">
      <div>
        <div className="cafe-frame">
          <div ref={host} className="cafe-viewport" tabIndex={0} aria-label="Café game world" />
          {(!playing || failed) && <div className="cafe-overlay">
            <div>
              <h2>{failed ? "3D graphics are unavailable" : won ? "Roster complete" : timedOut ? "Doors open. Roster short." : "Fill the Friday roster"}</h2>
              <p>{failed ? "Open OverRostered in a browser with WebGL enabled." : won ?
                "All four stations are covered. Everyone is within the 40-hour limit." : timedOut ?
                "The roster needs four covered stations before doors open." :
                "Cover three vacancies before doors open. Some workers can do more than one job."}</p>
              {won || timedOut ? <a className="play-again" href="/">Play again</a> :
                <button type="button" disabled={!ready || stage === null || busy} onClick={() => void send("report")}>Start round</button>}
            </div>
          </div>}
        </div>
        <div className="cafe-stations cafe-stations--roster" aria-label="Walk to a worker or station">
          {[["Jo", 4], ["Rae", 5], ["Kit", 6], ["Grill", 1], ["Pass", 2], ["Floor", 3]].map(([label, index]) => (
            <button key={label} type="button" className={`station-control station-control--${index}${hud.near === index ? " station-control--near" : ""}`}
              disabled={!playing} onClick={() => controls.current?.go(Number(index))}>
              <span>{label}</span>
            </button>
          ))}
          <button type="button" className="station-action" disabled={!playing || !hud.action}
            onClick={() => controls.current?.act()}>{hud.action || "Interact"}</button>
        </div>
        <p className="cafe-keys">WASD to move · E to talk or assign · Tap the floor or a destination to walk there</p>
        <p className="cafe-keys">{hud.twoPlayers ? "Player 2 joined · Arrow keys to move · Enter to talk or assign" : "Player 2 joins with the arrow keys and interacts with Enter."}</p>
      </div>
      <aside className="cafe-roster" aria-label="Shift roster">
        <h2>Friday close</h2>
        <p className="shift-time">6:00–10:00 pm</p>
        <div className="crew-row"><span className="crew-dot crew-dot--sam" /><div><strong>Till · Sam</strong><span>Covered · 39 h this week</span></div></div>
        {roles.map((role, i) => {
          const item = atStation(stage, role);
          return <div key={role} className="crew-row">
            <span className={item ? `crew-dot crew-dot--station-${i}` : "crew-dot crew-dot--away"} />
            <div><strong>{role} · {item?.worker ?? "Vacant"}</strong><span>{item ? `${workers[item.worker].hours + 4} h this week` : "Needs cover"}</span></div>
            {playing && item && <button type="button" className="undo-shift" disabled={busy}
              aria-label={`Undo ${role} assignment`} onClick={() => void send(`clear-${item.bit}`)}>Undo</button>}
          </div>;
        })}
        {playing && <>
          <p className="cafe-radio" role="status">{hud.message}</p>
          <p className="cafe-event">{hud.lead ? `Player 1 is with ${hud.lead}.` : "Talk to a worker, then lead them to an open station."}
            {hud.partner && ` Player 2 is with ${hud.partner}.`}</p>
        </>}
      </aside>
    </div>
  </section>;
}
