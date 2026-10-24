/**
 * Quadcopter: a drone hovering over a round landing pad, banked a little at
 * rest. The pointer is projected onto the plane the drone hovers in, which
 * never moves; the drone leans toward it on two springs and drifts after it on two more, so the rotor
 * on the leading side dips and takes the bright stroke. A dashed shadow on the
 * pad follows the drift. The slider is the steepest lean, in degrees.
 *
 * The pattern: one rigid body on springs. Every part is built in the drone's
 * own frame and passed through a rotation before the camera, and the parts are
 * re-sorted by depth whenever the lean changes their order.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, circ, unproj, spring, stepS, rad,
  mk, poly, ringAt, flatDot, place, pointer, put, register, disposer, solid,
} = HL;

const PAD = 64, HOVER = 62, ARM = 44, PROP = 16, DRIFT = 12, REACH = 80;
const REST = [5, -3];

/** A ring turned by a degrees about the origin, then moved to (x, y): a bar that runs along a diagonal. */
const turn = (ring, a, x, y) => {
  const c = Math.cos(rad(a)), s = Math.sin(rad(a));
  return ring.map((q) => ({ u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.62);
  const reach = ARM + PROP + DRIFT + 4;
  fit(C, [[-PAD, -PAD, -6], [PAD, PAD, -6], [PAD, -PAD, -6], [-PAD, PAD, -6], [-reach, -reach, HOVER + 26], [reach, reach, HOVER - 30]], 200, 166);
  const P0 = proj(C), front = facing(C), zf = Math.sqrt(1 - C.k * C.k);
  const depth = (p) => (p[0] + p[1]) * Math.SQRT1_2 * zf + p[2] * C.k;
  let MAX = value, over = null;

  const g = mk("g", {}, svg);
  const [pr, pi] = [circ(PAD, 64), circ(PAD - 2.2, 64)];
  put(solid(g), prism(P0, front, pr, pi, -6, 0));
  mk("path", { class: "lo nf", d: poly(ringAt(P0, circ(PAD - 18, 64), 0)) }, g);
  [0, 1, 2, 3].forEach((k) => place(flatDot(g, C, 0.9, "dot off"), P0(Math.cos(rad(45 + 90 * k)) * (PAD - 9), Math.sin(rad(45 + 90 * k)) * (PAD - 9), 0)));
  const shadow = mk("path", { class: "dash nf" }, g);

  // The drone, in its own frame: z up from the underside of the body.
  const parts = [];
  const add = (c, build) => { const el = mk("g", {}, g); parts.push({ c, el, build, items: [] }); return parts.at(-1); };
  const block = (part, ring, inner, z0, z1) => part.items.push({ s: solid(part.el), ring, inner, z0, z1 });

  const gear = add([0, 0, -12]);
  for (const y of [-11, 11]) block(gear, ...rings(-20, y - 1.6, 20, y + 1.6, 1.6, 0.6), -16, -14);
  for (const x of [-10, 10]) for (const y of [-11, 11]) block(gear, ...rings(x - 1.5, y - 1.5, x + 1.5, y + 1.5, 1.5, 0.5), -14, 0);
  block(gear, ...rings(11, -5, 19, 5, 3.5, 0.9), -9, 0);

  const corners = [45, 135, 225, 315].map((a) => {
    const mx = Math.cos(rad(a)) * ARM, my = Math.sin(rad(a)) * ARM;
    const part = add([mx, my, 6]);
    block(part, ...[turn(rings(19, -2.2, ARM - 4, 2.2, 2.2, 0.7)[0], a, 0, 0), turn(rings(19, -2.2, ARM - 4, 2.2, 2.2, 0.7)[1], a, 0, 0)], 3, 7);
    block(part, at(circ(5.5, 24), mx, my), at(circ(4.6, 24), mx, my), 3, 10);
    block(part, at(circ(PROP, 48), mx, my), at(circ(PROP - 1.4, 48), mx, my), 11, 12.2);
    block(part, at(circ(2.4, 16), mx, my), null, 12.2, 14.5);
    part.dir = [Math.cos(rad(a)), Math.sin(rad(a))];
    return part;
  });

  const body = add([0, 0, 8]);
  block(body, ...rings(-19, -13, 19, 13, 8, 1.4), 0, 9);
  block(body, ...rings(-12, -8, 13, 8, 6, 1.2), 9, 14);

  const tx = spring(REST[0]), ty = spring(REST[1]), dx = spring(0), dy = spring(0);
  let drawn = "", lit = null;

  /** The rigid transform: lean (a, b) in degrees toward the direction it points, then hover at the drift. */
  function frame() {
    const a = tx.x, b = ty.x, th = rad(Math.hypot(a, b)), n = Math.hypot(a, b) || 1;
    const ux = -b / n, uy = a / n, c = Math.cos(th), s = Math.sin(th);
    const T = (x, y, z) => {
      const d = ux * x + uy * y;
      return [x * c + uy * z * s + ux * d * (1 - c) + dx.x, y * c - ux * z * s + uy * d * (1 - c) + dy.x, z * c + (ux * y - uy * x) * s + HOVER];
    };
    return { T, P: (x, y, z) => P0(...T(x, y, z)) };
  }

  function draw() {
    const key = [tx.x, ty.x, dx.x, dy.x].map((v) => v.toFixed(2)).join();
    if (key === drawn) return;
    drawn = key;
    const { T, P } = frame();
    shadow.setAttribute("d", poly(ringAt(P0, at(circ(20, 48), dx.x, dy.x), 0)));
    for (const part of parts) for (const it of part.items) put(it.s, prism(P, front, it.ring, it.inner, it.z0, it.z1));
    // Back to front by the depth of each part's centre: the lean can swap two corners.
    const order = parts.slice().sort((p, q) => depth(T(...p.c)) - depth(T(...q.c)));
    order.forEach((p, i) => { if (p.el.previousSibling !== (i ? order[i - 1].el : shadow)) (i ? order[i - 1].el : shadow).after(p.el); });
  }

  /** The leading rotor: the one whose arm points most along the lean's target, never its moving value. */
  function light() {
    const t = [tx.t, ty.t], best = corners.reduce((p, q) => (q.dir[0] * t[0] + q.dir[1] * t[1] > p.dir[0] * t[0] + p.dir[1] * t[1] ? q : p));
    if (best === lit) return;
    if (lit) lit.items[2].s.sil.classList.remove("hi");
    lit = best;
    lit.items[2].s.sil.classList.add("hi");
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const sp of [tx, ty, dx, dy]) if (stepS(sp, dt)) m = true;
    draw();
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    if (!over) {
      [tx.t, ty.t, dx.t, dy.t] = [REST[0], REST[1], 0, 0];
      read.textContent = "rest";
    } else {
      const d = Math.hypot(over[0], over[1]), f = clamp(d / REACH, 0, 1), ex = d ? over[0] / d : 0, ey = d ? over[1] / d : 0;
      tx.t = ex * MAX * f; ty.t = ey * MAX * f;
      dx.t = ex * DRIFT * f; dy.t = ey * DRIFT * f;
      read.textContent = `tilt ${Math.round(MAX * f)}°`;
    }
    light();
    B.wake();
  }
  light();
  draw();

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], HOVER); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { MAX = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "quadcopter",
  means: "A drone hovers over its pad and leans toward the pointer, the leading rotor dipping as it drifts after it.",
  rules: [1, 3, 5, 9],
  range: [8, 16, 26],
  tour: [[300, 140], [100, 130], [200, 215], null],
  mount,
});
