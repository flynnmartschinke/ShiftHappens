import * as T from "three";
import { office, shifts, type Point, type Request, type Round } from "./round";

export function createOfficeWorld(host: HTMLDivElement) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x172325);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.domElement.setAttribute("aria-label", "3D office with a request tray, manager’s desk, pass counter and roster board");
  renderer.domElement.setAttribute("role", "img");
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-12, 12, 7, -7, .1, 100);
  camera.position.set(0, 17, 12);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xfffbef, 0x91a3bf, 2.2));
  const sunlight = new T.DirectionalLight(0xffe8b8, 2.05);
  sunlight.position.set(-5, 9, 4);
  scene.add(sunlight);

  const materials = new Map<number, T.MeshLambertMaterial>();
  const textures = new Map<string, T.SpriteMaterial>();
  const cube = new T.BoxGeometry();

  function material(colour: number) {
    let entry = materials.get(colour);
    if (!entry) {
      entry = new T.MeshLambertMaterial({ color: colour });
      materials.set(colour, entry);
    }
    return entry;
  }

  function box(parent: T.Object3D, colour: number, x: number, y: number, z: number, w: number, h: number, d: number) {
    const object = new T.Mesh(cube, material(colour));
    object.scale.set(w, h, d);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function labelMaterial(text: string, background: string, ink: string) {
    const key = [text, background, ink].join("|");
    const cached = textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 112;
    const pen = canvas.getContext("2d")!;
    pen.fillStyle = background;
    pen.beginPath();
    pen.roundRect(0, 0, canvas.width, canvas.height, 25);
    pen.fill();
    pen.fillStyle = ink;
    pen.font = "800 53px system-ui";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.fillText(text, 192, 57, 352);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const painted = new T.SpriteMaterial({ map, depthTest: false, depthWrite: false });
    textures.set(key, painted);
    return painted;
  }

  function sign(text: string, colour: string, x: number, y: number, z: number, width: number) {
    const sprite = new T.Sprite(labelMaterial(text, colour, "#192727"));
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width * .292, 1);
    sprite.renderOrder = 2;
    scene.add(sprite);
    return sprite;
  }

  box(scene, 0x54827b, 0, -.51, 0, 19.25, .7, 11.2);
  box(scene, 0xc9ad86, 0, -.19, 0, 18.95, .28, 10.65);
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 18; col++) {
      const north = row < 5;
      const colours = north ? [0xd8dfce, 0xe5e9dc] : [0xeddebd, 0xf3e6ca];
      box(scene, colours[(row + col) % 2], col - 8.5, -.027, row - 4.5, .982, .055, .982);
    }
  }

  box(scene, 0x46786f, 0, .64, -5.16, 19.1, 1.28, .34);
  box(scene, 0x70a499, 0, 1.32, -5.16, 19.2, .1, .4);
  for (const x of [-9.42, 9.42]) {
    box(scene, 0x46786f, x, .39, 0, .25, .78, 10.55);
    box(scene, 0x70a499, x, .81, 0, .33, .07, 10.55);
  }
  box(scene, 0x6e8d87, 0, .44, -4.55, 15.4, .88, .65);
  box(scene, 0xb4d2b9, 0, .93, -4.55, 15.55, .11, .76);
  sign("ROSTER BOARD", "#c3ebcb", 0, 1.81, -4.57, 3.45);

  const markers = shifts.map((_, index) => {
    const x = ((index % 7) - 3) * 2.04 + (index < 7 ? -.32 : .32);
    return box(scene, 0x859d8e, x, 1.01, -4.56, .44, .05, .42);
  });

  const counterWidth = office.counterRight + office.bounds.x;
  const counterCentre = (office.counterRight - office.bounds.x) / 2;
  box(scene, 0x527876, counterCentre, .42, 0, counterWidth, .84, .82);
  box(scene, 0x93b7a4, counterCentre, .87, 0, counterWidth + .13, .15, .99);
  for (const point of office.pass) {
    box(scene, 0xe9eac8, point.x, .965, point.z, 1.5, .06, .83);
  }
  sign("PASS CARDS", "#edf1ce", 3.42, 1.36, 0, 2.56);

  box(scene, 0x7d9ebc, office.tray.x, .34, office.tray.z, 3.2, .68, 1.42);
  box(scene, 0xb6d7ed, office.tray.x, .73, office.tray.z, 3.34, .15, 1.55);
  sign("REQUEST TRAY", "#cfe9ff", office.tray.x, 1.03, office.tray.z + 1.43, 3.16);
  box(scene, 0xb88c56, office.desk.x, .4, office.desk.z, 3.35, .8, 1.4);
  box(scene, 0xf4c675, office.desk.x, .86, office.desk.z, 3.51, .13, 1.52);
  box(scene, 0x6e5c56, .63, 1.08, 3.1, .6, .34, .45);
  box(scene, 0xc98968, .63, 1.31, 3.1, .46, .15, .36);
  sign("MANAGER’S DESK", "#ffdc9c", office.desk.x, 1.55, office.desk.z + .69, 3.64);

  for (const { x, z } of [{ x: -8.6, z: -4.44 }, { x: 8.1, z: -4.65 }, { x: 8.25, z: 4.2 }]) {
    box(scene, 0xb77f57, x, .32, z, .63, .64, .59);
    box(scene, 0x507b59, x + .08, .76, z + .06, .51, .53, .51).rotation.y = .38;
    box(scene, 0x8caf70, x - .13, 1.05, z - .08, .41, .53, .39).rotation.y = -.35;
  }

  function critter(colour: number, accent: number, bird: boolean) {
    const group = new T.Group();
    const body = new T.Group();
    group.add(body);
    scene.add(group);
    const head = box(body, colour, 0, 1.01, .06, .66, .56, .56);
    head.rotation.y = .05;
    box(body, colour, 0, .57, 0, .62, .48, .52);
    box(body, accent, 0, .54, .267, .36, .37, .055);
    for (const x of [-.16, .16]) {
      box(body, 0x24323a, x, 1.06, .355, .067, .087, .034);
      if (!bird) box(body, colour, x * 1.45, 1.36, .01, .22, .28, .25).rotation.z = -x;
    }
    if (bird) box(body, 0xdc8c4e, 0, .95, .375, .24, .13, .21);
    const feet = [-.19, .19].map(x => box(body, accent, x, .18, .075, .22, .31, .39));
    return { group, body, feet };
  }

  const pawns = [critter(0xefb04d, 0xa15938, true), critter(0xbaa1e9, 0x715eaa, false)];
  const playerLabels = pawns.map((_, i) => sign(`P${i + 1}`, i === 0 ? "#ffcf75" : "#dcc7ff", 0, 1.8, 0, 1.08));
  const cardLabels = shifts.map(shift => sign(shift.label, "#bee4ff", 0, 0, 0, 1.18));

  let lastRound: Round | undefined;

  function size() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const halfWidth = Math.max(10.7, 5.8 * aspect);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfWidth / aspect;
    camera.bottom = -halfWidth / aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (lastRound) renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(size);
  observer.observe(host);
  size();

  function positionOf(card: Request, round: Round, trayIndex: number): Point & { y: number } {
    if (card.at.place === "counter") return { ...office.pass[card.at.pad], y: 1.32 };
    if (card.at.place === "floor") return { ...card.at.point, y: .28 };
    if (card.at.place === "hand") return { ...round.players[card.at.player].position, y: 2.28 };
    return { x: office.tray.x + (trayIndex % 2 - .5) * 1.36, z: office.tray.z + (Math.floor(trayIndex / 2) - .5) * .58, y: 1.07 };
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function draw(round: Round) {
    lastRound = round;
    const motion = reducedMotion.matches ? 0 : round.elapsed * 18;
    pawns.forEach(({ group, body, feet }, i) => {
      const player = round.players[i];
      const { x, z } = player.position;
      group.position.set(x, 0, z);
      group.rotation.y = player.facing;
      body.position.y = player.moving ? Math.abs(Math.sin(motion)) * .085 : 0;
      feet.forEach((foot, side) => {
        foot.position.z = .075 + (player.moving ? Math.sin(motion + side * Math.PI) * .12 : 0);
      });
      playerLabels[i].position.set(x, 1.64, z);
    });
    let trayIndex = 0;
    cardLabels.forEach((sprite, index) => {
      const card = round.requests[index];
      const pinned = card?.at.place === "board";
      markers[index].material = material(pinned ? 0x60b991 : 0x859d8e);
      sprite.visible = Boolean(card && !pinned);
      if (!card || pinned) return;
      const { x, y, z } = positionOf(card, round, trayIndex);
      if (card.at.place === "tray") trayIndex++;
      sprite.position.set(x, y, z);
      sprite.material = labelMaterial(shifts[index].label, card.approved ? "#adf3c7" : "#bee4ff", "#192727");
    });
    renderer.render(scene, camera);
  }

  return {
    draw,
    dispose() {
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      materials.forEach(value => value.dispose());
      cube.dispose();
      textures.forEach(value => { value.map?.dispose(); value.dispose(); });
    },
  };
}
