export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const roles = [
  { id: "barista", label: "Barista", colour: "#ff7aa8" },
  { id: "kitchen", label: "Kitchen", colour: "#ffa53d" },
  { id: "register", label: "Register", colour: "#3ec7b4" },
] as const;
export type Role = typeof roles[number]["id"];

// Which role each shift needs, Monday to Sunday.
const amRoles: Role[] = ["barista", "kitchen", "register", "barista", "kitchen", "register", "barista"];
const pmRoles: Role[] = ["kitchen", "register", "barista", "kitchen", "register", "barista", "kitchen"];

export const shifts = (["AM", "PM"] as const).flatMap(half =>
  days.map((day, i) => ({ day, half, label: `${day} ${half}`, role: (half === "AM" ? amRoles : pmRoles)[i] })),
);

const names = [
  "Jo", "Rae", "Kit", "Sam", "Ali", "Bea", "Cy", "Dev", "Eli", "Fi", "Gus", "Hana",
  "Ivy", "Max", "Nia", "Oli", "Pip", "Quin", "Remy", "Tao", "Uma", "Vic", "Wren", "Zac",
];

export const settings = {
  duration: 180,
  stampTime: 1.2,
  trayLimit: 4,
  rushAt: 50,
  spawnEvery: 3.5,
  rushSpawnEvery: 2.5,
  sickFrom: 35,
  sickEvery: 32,
  speed: 6.4,
  reach: 1.45,
  /** How far from the edge of the inbox or desk a player can still use it. */
  stationReach: 1,
  /** Collision radius of a player, close to the size of the drawn critters. */
  body: .42,
};

/** Board columns, one per day, centred on the office. */
export const columnGap = 2.06;
export const columnX = (day: number) => (day - 3) * columnGap;

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

type StaffLocation =
  | { place: "tray" }
  | { place: "gone" }
  | { place: "board"; slot: number }
  | { place: "hand"; player: number }
  | { place: "counter"; pad: number }
  | { place: "floor"; point: Point };

/** Someone who wants shifts. They wait at the table until a player brings them to the board. */
export type Staff = {
  id: number;
  name: string;
  role: Role;
  approved: boolean;
  stamp: number;
  at: StaffLocation;
};

export type Player = {
  position: Point;
  carrying?: Staff;
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
  nextSick: number;
  staff: Staff[];
  players: Player[];
  /** Latest office news for the interface, such as a sick call. */
  news: { text: string; until: number };
};

export function newRound(): Round {
  return {
    phase: "ready",
    elapsed: 0,
    nextSpawn: 0,
    nextSick: settings.sickFrom,
    staff: [],
    news: { text: "", until: 0 },
    players: [
      { position: { x: -5.3, z: 2.05 }, facing: 0, moving: false, stamping: false, message: "", messageUntil: 0 },
      { position: { x: -.5, z: -1.3 }, facing: Math.PI, moving: false, stamping: false, message: "", messageUntil: 0 },
    ],
  };
}

export const roleOf = (role: Role) => roles.find(entry => entry.id === role)!;

/** Who is rostered on each shift, or undefined while it is open. */
export function roster(round: Round) {
  return shifts.map((_, slot) => round.staff.find(person => person.at.place === "board" && person.at.slot === slot));
}

export function filledShifts(round: Round) {
  return round.staff.filter(person => person.at.place === "board").length;
}

// Only bring in people the week still needs, so every round can be finished.
function hire(round: Round) {
  if (round.staff.filter(person => person.at.place === "tray").length >= settings.trayLimit) return;
  const open = roster(round).map((person, slot) => person ? undefined : shifts[slot].role).filter(Boolean) as Role[];
  const coming = round.staff.filter(person => person.at.place !== "board" && person.at.place !== "gone");
  const needed = roles.map(({ id }) => ({
    id, gap: open.filter(role => role === id).length - coming.filter(person => person.role === id).length,
  })).filter(entry => entry.gap > 0);
  if (!needed.length) return;
  const total = needed.reduce((sum, entry) => sum + entry.gap, 0);
  let pick = Math.random() * total;
  const role = needed.find(entry => (pick -= entry.gap) < 0)?.id ?? needed[0].id;
  const used = new Set(round.staff.filter(person => person.at.place !== "gone").map(person => person.name));
  const free = names.filter(name => !used.has(name));
  const name = free[Math.floor(Math.random() * free.length)] ?? `Temp ${round.staff.length + 1}`;
  round.staff.push({ id: round.staff.length, name, role, approved: false, stamp: 0, at: { place: "tray" } });
}

export function beginRound(round: Round) {
  if (round.phase !== "ready") return;
  round.phase = "playing";
  for (let i = 0; i < settings.trayLimit; i++) hire(round);
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

// Someone already on the board calls in sick, opening their shift again.
function sickCall(round: Round) {
  const rostered = round.staff.filter(person => person.at.place === "board");
  if (rostered.length < 3) return;
  const person = rostered[Math.floor(Math.random() * rostered.length)];
  const slot = person.at.place === "board" ? person.at.slot : 0;
  person.at = { place: "gone" };
  round.news = { text: `${person.name} called in sick. ${shifts[slot].label} is open again.`, until: round.elapsed + 4 };
}

export function stepRound(round: Round, seconds: number) {
  if (round.phase !== "playing") return;
  round.elapsed = Math.min(settings.duration, round.elapsed + seconds);
  if (round.elapsed >= settings.duration) {
    round.phase = "lost";
    return;
  }
  if (round.elapsed >= round.nextSpawn) {
    hire(round);
    round.nextSpawn = round.elapsed + (round.elapsed < settings.rushAt ? settings.spawnEvery : settings.rushSpawnEvery);
  }
  if (round.elapsed >= round.nextSick) {
    sickCall(round);
    round.nextSick = round.elapsed + settings.sickEvery;
  }
  for (const player of round.players) {
    const person = player.carrying;
    if (!player.stamping || !person) continue;
    if (!atDesk(player.position)) {
      stopStamp(player);
      continue;
    }
    person.stamp = Math.min(settings.stampTime, person.stamp + seconds);
    if (person.stamp >= settings.stampTime) {
      person.approved = true;
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

function staffInReach(round: Round, point: Point) {
  return round.staff.map(person => {
    // The waiting table is in reach anywhere along its edge; people elsewhere are measured from where they stand.
    if (person.at.place === "tray") return { person, distance: edgeDistance(point, furniture.inbox), reach: settings.stationReach };
    let target: Point | undefined;
    if (person.at.place === "counter") target = office.pass[person.at.pad];
    if (person.at.place === "floor") target = person.at.point;
    return { person, distance: target && Math.hypot(point.x - target.x, point.z - target.z), reach: settings.reach };
  }).filter(entry => entry.distance !== undefined && entry.distance <= entry.reach)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0]?.person;
}

function passInReach(round: Round, point: Point, emptyOnly: boolean) {
  return office.pass.map((pad, index) => ({ index, distance: Math.hypot(pad.x - point.x, pad.z - point.z) }))
    .filter(({ index, distance }) => distance <= settings.reach && (!emptyOnly || !round.staff.some(
      person => person.at.place === "counter" && person.at.pad === index,
    )))
    .sort((a, b) => a.distance - b.distance)[0]?.index;
}

/** The day column in front of a player at the board. */
export function columnAt(point: Point) {
  return Math.max(0, Math.min(6, Math.round(point.x / columnGap + 3)));
}

/** The open shift in this column that suits the person, if there is one. */
function slotFor(round: Round, point: Point, person: Staff) {
  const day = columnAt(point);
  const taken = roster(round);
  return [day, day + 7].find(slot => !taken[slot] && shifts[slot].role === person.role);
}

function boardHint(round: Round, point: Point) {
  const day = columnAt(point);
  const taken = roster(round);
  if (!taken[day] || !taken[day + 7]) return `${days[day]} needs ${[day, day + 7].filter(slot => !taken[slot]).map(slot => roleOf(shifts[slot].role).label.toLowerCase()).join(" and ")}`;
  return `${days[day]} is covered`;
}

export function nextAction(round: Round, index: number) {
  const { carrying, position } = round.players[index];
  if (!carrying) {
    const person = staffInReach(round, position);
    if (person) return `Grab ${person.name}`;
    return position.z < 0 ? "Collect from the counter" : "Grab someone waiting";
  }
  if (atBoard(position)) {
    if (!carrying.approved) return "Sign them on first";
    const slot = slotFor(round, position, carrying);
    return slot === undefined ? boardHint(round, position) : `Roster ${carrying.name} on ${shifts[slot].label}`;
  }
  if (!carrying.approved && atDesk(position)) return "Hold to sign on";
  if (passInReach(round, position, true) !== undefined) return "Pass over";
  if (passInReach(round, position, false) !== undefined) return "Counter full";
  return "Put down";
}

export function interact(round: Round, index: number) {
  if (round.phase !== "playing") return;
  const player = round.players[index];
  const { carrying, position } = player;
  if (!carrying) {
    const person = staffInReach(round, position);
    if (person) {
      player.carrying = person;
      person.at = { place: "hand", player: index };
    }
    return;
  }
  if (atBoard(position)) {
    if (!carrying.approved) {
      notify(round, player, "Sign them on at the desk first.");
      return;
    }
    const slot = slotFor(round, position, carrying);
    if (slot === undefined) {
      notify(round, player, `${boardHint(round, position)}. ${carrying.name} works ${roleOf(carrying.role).label.toLowerCase()}.`);
      return;
    }
    carrying.at = { place: "board", slot };
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
