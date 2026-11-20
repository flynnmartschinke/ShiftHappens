import * as T from "three";

export type Point = { x: number; z: number };

export const stations = [
  { name: "Till", verb: "Take order", x: -5.1, z: .9, colour: 0xceabff },
  { name: "Grill", verb: "Cook order", x: 0, z: -2.25, colour: 0xffac7c },
  { name: "Pass", verb: "Serve order", x: 5, z: .85, colour: 0x9be4c6 },
  { name: "Floor", verb: "Cover tables", x: .2, z: 3.55, colour: 0xf3d581 },
] as const;

export function createCafeWorld(host: HTMLDivElement) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setClearColor(0x735b87);
  renderer.domElement.setAttribute("aria-label", "3D café floor");
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-8, 8, 5, -5, .1, 100);
  camera.position.set(7, 16, 20);
  camera.lookAt(0, .45, -.55);

  const materials = new Map<number, T.MeshLambertMaterial>();
  function material(colour: number) {
    let existing = materials.get(colour);
    if (!existing) {
      existing = new T.MeshLambertMaterial({ color: colour });
      materials.set(colour, existing);
    }
    return existing;
  }

  function box(parent: T.Object3D, colour: number, x: number, y: number, z: number,
               width: number, height: number, depth: number) {
    const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material(colour));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent: T.Object3D, colour: number, x: number, y: number, z: number,
                    radius: number, height: number, sides = 12) {
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, height, sides), material(colour));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function disc(parent: T.Object3D, x: number, z: number, radius: number) {
    const mesh = new T.Mesh(new T.CircleGeometry(radius, 18),
      new T.MeshBasicMaterial({ color: 0x35244a, transparent: true, opacity: .19, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, .024, z);
    parent.add(mesh);
    return mesh;
  }

  function sign(text: string, x: number, y: number, z: number, width: number, background: string) {
    const surface = document.createElement("canvas");
    surface.width = 480;
    surface.height = 124;
    const pen = surface.getContext("2d");
    if (!pen) return;
    pen.fillStyle = background;
    pen.roundRect(0, 0, 480, 124, 20);
    pen.fill();
    pen.fillStyle = "#181a31";
    pen.font = "900 55px sans-serif";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.fillText(text, 240, 67);
    const texture = new T.CanvasTexture(surface);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width * .258, 1);
    scene.add(sprite);
  }

  scene.add(new T.HemisphereLight(0xfdf0d7, 0x8d799a, 2.15));
  const sun = new T.DirectionalLight(0xffe1b7, 2.3);
  sun.position.set(-6, 12, 8);
  scene.add(sun);
  box(scene, 0x3a2d54, .2, -.48, .35, 17.4, .36, 11.9);
  box(scene, 0xd6c0c8, 0, -.2, 0, 17, .40, 11.5);
  for (let x = -8; x <= 8; x++) {
    for (let z = -5; z <= 5; z++) {
      box(scene, (x + z) % 2 ? 0xead6c7 : 0xf9e9d7, x, .009, z, .984, .018, .984);
    }
  }

  const walnut = 0x74566a;
  const cream = 0xffead4;
  const plum = 0x5b486e;
  box(scene, plum, 0, .84, -5.34, 17, 1.7, .36);
  box(scene, 0xf19c9b, 0, 1.73, -5.32, 17.15, .14, .5);
  for (const x of [-6.65, -4.35, -2.05, 2.05, 4.35, 6.65]) {
    box(scene, 0xa9d3dc, x, 1.05, -5.12, 1.55, .8, .1);
    box(scene, cream, x, 1.05, -5.04, .07, .8, .055);
  }
  sign("JUNIPER CAFÉ", 0, 2.28, -5.1, 3.8, "#ffd3ac");

  for (const [x, z] of [[-7.2, -3.65], [7.15, -3.65], [-7.2, 4.55], [7.2, 4.55]]) {
    cylinder(scene, 0x966575, x, .23, z, .31, .44, 8);
    cylinder(scene, 0x77aa88, x, .6, z, .36, .35, 6);
    cylinder(scene, 0xa1c89b, x - .16, .84, z, .23, .32, 6);
  }
  for (const x of [-4.1, 4.1]) {
    const z = 4.45;
    disc(scene, x, z, .85);
    cylinder(scene, walnut, x, .46, z, .68, .12);
    cylinder(scene, plum, x, .22, z, .10, .43);
    cylinder(scene, cream, x + .18, .57, z, .13, .10);
    for (const side of [-1, 1]) cylinder(scene, 0xe5a1a8, x + side * .94, .24, z, .30, .25, 8);
  }

  function counter(index: number, depthOffset: number) {
    const station = stations[index];
    const { x, z, colour } = station;
    const back = z + depthOffset;
    box(scene, colour, x, .023, z, 2.8, .026, 2.05);
    box(scene, walnut, x, .47, back, 2.55, .91, .88);
    box(scene, cream, x, .97, back, 2.75, .15, 1.04);
    box(scene, colour, x, .58, back + .45, 2.44, .48, .055);
    sign(station.name.toUpperCase(), x, 1.61, back, 1.45, ["#e7cdff", "#ffd0a9", "#b9f0da"][index]);
    return { x, back };
  }

  const till = counter(0, -1.17);
  box(scene, plum, till.x - .3, 1.19, till.back, .46, .48, .13).rotation.x = -.25;
  box(scene, 0x9be4c6, till.x - .3, 1.24, till.back + .078, .35, .28, .03);
  const grill = counter(1, -1.26);
  box(scene, plum, grill.x, 1.12, grill.back, 1.46, .22, .70);
  for (const x of [-.39, .39]) {
    cylinder(scene, 0xc77c65, x, 1.24, grill.back, .25, .025);
    cylinder(scene, 0x473956, x, 1.26, grill.back, .16, .025);
  }
  const pass = counter(2, -1.17);
  for (const x of [pass.x - .49, pass.x + .49]) {
    cylinder(scene, 0xfffaf2, x, 1.08, pass.back, .27, .045);
    cylinder(scene, 0xe9ad71, x, 1.15, pass.back, .13, .09, 6);
  }

  const floor = stations[3];
  box(scene, floor.colour, floor.x, .03, floor.z, 2.08, .04, 1.55);
  sign("FLOOR", floor.x, 1.66, floor.z + .24, 1.25, "#ffe7a3");

  for (const [name, x, z, label, colour] of [
    ["JO", -4.45, 3.18, "#ffd0a9", 0xffac7c],
    ["RAE", 4.4, 3.18, "#b9f0da", 0x9be4c6],
    ["KIT", 3.55, -3.3, "#ffe7a3", 0xf3d581],
  ] as const) {
    box(scene, colour, x, .031, z, 1.65, .025, 1.03);
    sign(name, x, 1.9, z, .90, label);
  }

  function makeCharacter(colour: number, skin: number) {
    const root = new T.Group();
    scene.add(root);
    const shadow = disc(scene, 0, 0, .40);
    const body = new T.Group();
    root.add(body);
    box(body, colour, 0, .78, 0, .61, .56, .40);
    box(body, 0xfaf0e3, 0, .72, .23, .32, .41, .07);
    box(body, skin, 0, 1.29, 0, .43, .44, .40);
    box(body, colour, -.015, 1.56, .025, .55, .13, .49);
    box(body, colour, 0, 1.50, .27, .41, .065, .16);
    for (const x of [-.1, .1]) box(body, 0x392a43, x, 1.31, .209, .046, .055, .025);
    const legs: T.Group[] = [];
    const arms: T.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new T.Group();
      leg.position.set(side * .17, .49, 0);
      body.add(leg);
      box(leg, plum, 0, -.18, 0, .19, .37, .22);
      box(leg, 0x312743, 0, -.40, .07, .21, .15, .34);
      legs.push(leg);
      const arm = new T.Group();
      arm.position.set(side * .37, 1, 0);
      body.add(arm);
      box(arm, colour, 0, -.16, 0, .16, .26, .20);
      box(arm, skin, 0, -.34, 0, .14, .13, .17);
      arms.push(arm);
    }
    return { root, body, shadow, legs, arms };
  }

  const people = [
    makeCharacter(0x83bdf7, 0xf3bf8e),
    makeCharacter(0xe5a4d1, 0xc88e67),
    makeCharacter(0xb49ceb, 0xa86c5a),
    makeCharacter(0xf29a75, 0xeeb88f),
    makeCharacter(0x81cfa9, 0xd49d75),
    makeCharacter(0xe7bd68, 0x9d6959),
  ];
  function person(index: number, point: Point, direction: number, stride: number, moving: boolean, visible = true) {
    const actor = people[index];
    actor.root.visible = visible;
    actor.shadow.visible = visible;
    actor.root.position.set(point.x, 0, point.z);
    actor.shadow.position.set(point.x, .062, point.z);
    actor.body.rotation.y = direction;
    const gait = moving ? Math.sin(stride * 13) * .59 : 0;
    actor.body.position.y = moving ? Math.abs(gait) * .12 : 0;
    actor.legs[0].rotation.x = gait;
    actor.legs[1].rotation.x = -gait;
    actor.arms[0].rotation.x = -gait;
    actor.arms[1].rotation.x = gait;
  }

  const ray = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  function pick(x: number, y: number): Point | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
    const hit = ray.ray.intersectPlane(plane, new T.Vector3());
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const span = Math.max(9.8, 18.7 / aspect);
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });
  resize.observe(host);

  return {
    person, pick,
    render: () => renderer.render(scene, camera),
    destroy() {
      resize.disconnect();
      scene.traverse(object => {
        if (object instanceof T.Mesh) object.geometry.dispose();
        if (object instanceof T.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
        if (object instanceof T.Mesh && object.material instanceof T.MeshBasicMaterial) object.material.dispose();
      });
      for (const value of materials.values()) value.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
