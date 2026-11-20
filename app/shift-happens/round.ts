export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const shifts = (["AM", "PM"] as const).flatMap(half =>
  days.map(day => ({ day, half, label: `${day} ${half}` })),
);

export const settings = {
  duration: 120,
  stampTime: 2,
  trayLimit: 4,
  rushAt: 40,
  spawnEvery: 4,
  rushSpawnEvery: 2.5,
  speed: 6.4,
  reach: 1.45,
  /** How far from the edge of the inbox or desk a player can still use it. */
  stationReach: 1,
  /** Collision radius of a player, close to the size of the drawn critters. */
  body: .42,
};

export type Point = { x: number; z: number };

export const office = {
  bounds: { x: 9.25, z: 5.1 },
  counterRight: 5.1,
  counterDepth: .48,
  tray: { x: -6.4, z: 3.4 },
  desk: { x: -.55, z: 3.4 },
  boardZ: -4.35,
  pass: [-4.7, -2.6, -.5, 1.6].map(x => ({ x, z: 0 })),
};

/** A solid piece of furniture: centre plus full width (x) and depth (z). */
export type Block = Point & { w: number; d: number };

// The 3D office draws each piece at these positions and sizes.
export const furniture = {
  inbox: { ...office.tray, w: 3.3, d: 1.5 },
  desk: { ...office.desk, w: 3.5, d: 1.2 },
  plants: [{ x: -9.05, z: -4.75, size: 1 }, { x: 9.05, z: -4.75, size: 1.1 }, { x: 9.1, z: 4.75, size: .9 }]
    .map(({ x, z, size }) => ({ x, z, w: .8 * size, d: .8 * size, size })),
  cooler: { x: -9.05, z: 4.7, w: .6, d: .6 },
  cabinet: { x: 9.15, z: -2.4, w: .7, d: .8 },
  coffee: { x: 9.1, z: -.95, w: .7, d: 1.3 },
  printer: { x: -9.1, z: -2.1, w: .75, d: .9 },
  beanbag: { x: 7.6, z: 4.25, w: 1.15, d: 1.05 },
  lamp: { x: 9.05, z: 3.3, w: .5, d: .5 },
};

const blocks: Block[] = [
  furniture.inbox, furniture.desk, ...furniture.plants, furniture.cooler, furniture.cabinet,
  furniture.coffee, furniture.printer, furniture.beanbag, furniture.lamp,
];

/** Distance from a point to the nearest edge of a block (0 when inside it). */
function edgeDistance(point: Point, block: Block) {
  const dx = Math.max(0, Math.abs(point.x - block.x) - block.w / 2);
  const dz = Math.max(0, Math.abs(point.z - block.z) - block.d / 2);
  return Math.hypot(dx, dz);
}

/** Whether a player at this point can use the inbox or the desk. */
export function nearStation(point: Point, station: Block) {
  return edgeDistance(point, station) <= settings.stationReach;
}

type CardLocation =
  | { place: "tray" | "board" }
  | { place: "hand"; player: number }
  | { place: "counter"; pad: number }
  | { place: "floor"; point: Point };

export type Request = {
  shift: number;
  approved: boolean;
  stamp: number;
  at: CardLocation;
};

export type Player = {
  position: Point;
  carrying?: Request;
  stamping: boolean;
  facing: number;
  moving: boolean;
  message: string;
  messageUntil: number;
};

export type Round = {
  phase: "ready" | "playing" | "won" | "lost";
  elapsed: number;
  nextSpawn: number;
  requests: Request[];
  players: Player[];
};

export function newRound(): Round {
  return {
    phase: "ready",
    elapsed: 0,
    nextSpawn: 0,
    requests: [],
    players: [
      { position: { x: -5.3, z: 2.05 }, facing: 0, moving: false, stamping: false, message: "", messageUntil: 0 },
      { position: { x: -.5, z: -1.3 }, facing: Math.PI, moving: false, stamping: false, message: "", messageUntil: 0 },
    ],
  };
}

function replenish(round: Round, count = 1) {
  const available = settings.trayLimit - round.requests.filter(card => card.at.place === "tray").length;
  for (let i = 0; i < Math.min(count, available) && round.requests.length < shifts.length; i++) {
    round.requests.push({ shift: round.requests.length, approved: false, stamp: 0, at: { place: "tray" } });
  }
}

export function beginRound(round: Round) {
  if (round.phase !== "ready") return;
  round.phase = "playing";
  replenish(round, settings.trayLimit);
  round.nextSpawn = settings.spawnEvery;
}

function atBoard(point: Point) {
  return point.z <= office.boardZ + settings.reach && Math.abs(point.x) <= 7.8;
}

function atDesk(point: Point) {
  return nearStation(point, furniture.desk);
}

function notify(round: Round, player: Player, message: string) {
  player.message = message;
  player.messageUntil = round.elapsed + 2.2;
}

export function stopStamp(player: Player) {
  player.stamping = false;
  if (player.carrying && !player.carrying.approved) player.carrying.stamp = 0;
}

export function stepRound(round: Round, seconds: number) {
  if (round.phase !== "playing") return;
  round.elapsed = Math.min(settings.duration, round.elapsed + seconds);
  if (round.elapsed >= settings.duration) {
    round.phase = "lost";
    return;
  }
  if (round.elapsed >= round.nextSpawn) {
    replenish(round);
    round.nextSpawn = round.elapsed + (round.elapsed < settings.rushAt ? settings.spawnEvery : settings.rushSpawnEvery);
  }
  for (const player of round.players) {
    const card = player.carrying;
    if (!player.stamping || !card) continue;
    if (!atDesk(player.position)) {
      stopStamp(player);
      continue;
    }
    card.stamp = Math.min(settings.stampTime, card.stamp + seconds);
    if (card.stamp >= settings.stampTime) {
      card.approved = true;
      player.stamping = false;
    }
  }
}

function walkable(point: Point) {
  const { body } = settings;
  return Math.abs(point.x) <= office.bounds.x
    && Math.abs(point.z) <= office.bounds.z
    && (point.x > office.counterRight + body || Math.abs(point.z) > office.counterDepth + body)
    && blocks.every(block => edgeDistance(point, block) >= body);
}

export function walk(round: Round, index: number, dx: number, dz: number, seconds: number) {
  const player = round.players[index];
  const length = Math.hypot(dx, dz);
  player.moving = false;
  if (!length || round.phase !== "playing") return;
  const { position } = player;
  const speed = settings.speed * seconds / length;
  const x = position.x + dx * speed;
  const z = position.z + dz * speed;
  if (walkable({ x, z: position.z })) {
    player.moving = player.moving || x !== position.x;
    position.x = x;
  }
  if (walkable({ x: position.x, z })) {
    player.moving = player.moving || z !== position.z;
    position.z = z;
  }
  player.facing = Math.atan2(dx, dz);
  if (player.stamping && !atDesk(position)) stopStamp(player);
}

function cardInReach(round: Round, point: Point) {
  return round.requests.map(card => {
    // The inbox is in reach anywhere along its edge; loose cards are measured from their centre.
    if (card.at.place === "tray") return { card, distance: edgeDistance(point, furniture.inbox), reach: settings.stationReach };
    let target: Point | undefined;
    if (card.at.place === "counter") target = office.pass[card.at.pad];
    if (card.at.place === "floor") target = card.at.point;
    return { card, distance: target && Math.hypot(point.x - target.x, point.z - target.z), reach: settings.reach };
  }).filter(entry => entry.distance !== undefined && entry.distance <= entry.reach)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0]?.card;
}

function passInReach(round: Round, point: Point, emptyOnly: boolean) {
  return office.pass.map((pad, index) => ({ index, distance: Math.hypot(pad.x - point.x, pad.z - point.z) }))
    .filter(({ index, distance }) => distance <= settings.reach && (!emptyOnly || !round.requests.some(
      card => card.at.place === "counter" && card.at.pad === index,
    )))
    .sort((a, b) => a.distance - b.distance)[0]?.index;
}

export function nextAction(round: Round, index: number) {
  const { carrying, position } = round.players[index];
  if (!carrying) {
    if (cardInReach(round, position)) return "Pick up";
    return position.z < 0 ? "Collect from the counter" : "Find a request";
  }
  if (atBoard(position)) return carrying.approved ? "Pin shift" : "Needs approval";
  if (!carrying.approved && atDesk(position)) return "Hold to stamp";
  if (passInReach(round, position, true) !== undefined) return "Pass card";
  if (passInReach(round, position, false) !== undefined) return "Counter full";
  return "Put down";
}

export function interact(round: Round, index: number) {
  if (round.phase !== "playing") return;
  const player = round.players[index];
  const { carrying, position } = player;
  if (!carrying) {
    const card = cardInReach(round, position);
    if (card) {
      player.carrying = card;
      card.at = { place: "hand", player: index };
    }
    return;
  }
  if (atBoard(position)) {
    if (!carrying.approved) {
      notify(round, player, "Needs the manager’s stamp.");
      return;
    }
    carrying.at = { place: "board" };
    player.carrying = undefined;
    if (filledShifts(round) === shifts.length) round.phase = "won";
    return;
  }
  if (!carrying.approved && atDesk(position)) {
    player.stamping = true;
    return;
  }
  const pad = passInReach(round, position, true);
  if (pad === undefined && passInReach(round, position, false) !== undefined) return;
  carrying.at = pad === undefined
    ? { place: "floor", point: { ...position } }
    : { place: "counter", pad };
  stopStamp(player);
  player.carrying = undefined;
}

export function filledShifts(round: Round) {
  return round.requests.filter(card => card.at.place === "board").length;
}
