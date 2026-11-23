// The object library: each object is a Group of plain three.js shapes. Styles draw them their own way
// (Wireframe: the shapes' edges, plus the extra lines added here). Sizes are loose; styles fit them.
import * as THREE from "three";

const MAT = new THREE.MeshBasicMaterial();
const group = (...kids) => {
  const g = new THREE.Group();
  kids.flat(Infinity).forEach((k) => g.add(k));
  return g;
};
const mesh = (geo, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) => {
  const m = new THREE.Mesh(geo, MAT);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
};
const box = (w, h, d, at, rot) => mesh(new THREE.BoxGeometry(w, h, d), at, rot);
const cyl = (r, h, n, at, rot) => mesh(new THREE.CylinderGeometry(r, r, h, n), at, rot);
// lines: a list of [x, y, z] points, taken two at a time
const lines = (pts) => new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)));
const path = (pts, closed = false) => lines(pts.flatMap((p, i) => (i + 1 < pts.length ? [p, pts[i + 1]] : closed ? [p, pts[0]] : [])));
const circle = (r, [cx, cy, z] = [0, 0, 0], n = 28) =>
  path(Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n), z]), true);
const rect = (w, h, [cx, cy, z] = [0, 0, 0]) => path([[cx - w / 2, cy - h / 2, z], [cx + w / 2, cy - h / 2, z], [cx + w / 2, cy + h / 2, z], [cx - w / 2, cy + h / 2, z]], true);
// a flat shape cut out of a board `depth` thick, centred on z = 0
const slab = (shape, depth, at, rot) => {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return mesh(geo, at, rot);
};
function pill(w, h, r, tail = 0) { // rounded rectangle, with a speech tail at the bottom left (1) or right (-1)
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  if (tail) {
    const tx = tail > 0 ? x + r + 0.08 : x + w - r - 0.08;
    s.lineTo(Math.min(tx, tx + 0.16 * tail), y);
    s.lineTo(tx - 0.12 * tail, y - 0.18);
    s.lineTo(Math.max(tx, tx + 0.16 * tail), y);
  }
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const place = (o, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) => {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};
// a box with rounded front corners: its two outlines and four depth lines (three.js finds no edges on a smooth
// RoundedBoxGeometry, and its stepped corners draw as bundles of lines)
const rbox = (w, h, d, r, at, rot) => {
  const c = r * (1 - Math.SQRT1_2), x = w / 2 - c, y = h / 2 - c;
  const edges = [[-x, -y], [x, -y], [x, y], [-x, y]].map(([a, b]) => path([[a, b, -d / 2], [a, b, d / 2]]));
  edges.forEach((e) => (e.userData.edge = true)); // outline only: solid finishes skip it
  return place(group(slab(pill(w, h, r), d), edges), at, rot);
};
const zee = (x, y, s) => path([[x, y + s, 0], [x + s, y + s, 0], [x, y, 0], [x + s, y, 0]]);
const lathe = (pts, n, at, rot) => mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n), at, rot);
const arc = (r, a0, a1, [cx, cy, z] = [0, 0, 0], n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(a0 + ((a1 - a0) * i) / n), cy + r * Math.sin(a0 + ((a1 - a0) * i) / n), z]);
const shape = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
function wedge(r, a0, a1) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, r, a0, a1, false);
  s.lineTo(0, 0);
  return s;
}
// Acting: an object can set `userData.act = (t) => …`, t = seconds since it landed. It moves its own parts (never the
// root group, whose rest pose sets the object's size) and must be at rest at t = 0, where the morph leaves it.
const wave = (t, f, ph = 0) => Math.sin(2 * Math.PI * (f * t + ph));
const pulse = (t, f, ph = 0) => Math.max(0, wave(t, f, ph));
const springIn = (t, at) => (t <= at ? 0 : 1 - Math.exp(-7 * (t - at)) * Math.cos(11 * (t - at)));
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const swell = (t, f) => 0.5 - 0.5 * Math.cos(2 * Math.PI * f * t); // 0 at t = 0, up to 1 and back, f times a second
const bump = (x) => (x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0); // one hump over x = 0 … 1
// a looping part that travels off and comes back: 0 until `delay`, then [how far along, its size] every `period` s;
// it shrinks out at the far end and grows back in at the start, so the jump back is never seen
const away = (t, period, delay = 0) => {
  const f = t < delay ? 0 : ((t - delay) / period) % 1;
  return f < 0.75 ? [smooth(f / 0.75), Math.max(1e-3, 1 - smooth((f - 0.45) / 0.3))] : [0, Math.max(1e-3, smooth((f - 0.75) / 0.25))];
};
// parts that turn around point p (a shoulder, a neck, a hinge)
const pivot = (objs, p) => {
  const inner = group(objs);
  inner.position.set(-p[0], -p[1], -p[2]);
  return place(group(inner), p);
};
const acted = (g, act) => ((g.userData.act = act), g);
// the object's key part, drawn in the brand's accent colour (the notification, the circled day, the robot's eyes)
const hot = (o) => ((o.userData.accent = true), o);

// a person icon standing on y = 0: a round head and a shoulders shape, `h` tall
const person = (h = 1, at, rot) => {
  const k = h / 1.0, sh = new THREE.Shape();
  sh.moveTo(-0.34 * k, 0);
  sh.lineTo(-0.34 * k, 0.28 * k);
  sh.quadraticCurveTo(-0.34 * k, 0.55 * k, 0, 0.56 * k);
  sh.quadraticCurveTo(0.34 * k, 0.55 * k, 0.34 * k, 0.28 * k);
  sh.lineTo(0.34 * k, 0);
  sh.lineTo(-0.34 * k, 0);
  const body = slab(sh, 0.12 * k), head = group(path(arc(0.17 * k, 0, 2 * Math.PI, [0, 0.8 * k, 0.04 * k], 24)),
    path(arc(0.17 * k, 0, 2 * Math.PI, [0, 0.8 * k, -0.04 * k], 24)));
  const g = place(group(body, head), at, rot);
  g.userData.parts = { body, head, y0: g.position.y };
  return g;
};

export const OBJECTS = {
  calendar: () => {
    // the circled day hops along the grid: days going by
    const CELLS = [[0.125, -0.135], [0.375, -0.135], [-0.375, -0.43], [-0.125, -0.43], [0.125, -0.43], [0.375, -0.43], [-0.375, 0.155]];
    const day = place(circle(0.1, [0, 0, 0]), [...CELLS[0], 0.052]);
    const rings = [-0.25, 0.25].map((x) => place(circle(0.07, [0, 0, 0], 16), [x, 0.575, 0], [0, Math.PI / 2, 0]));
    return acted(group(
      rbox(1.0, 1.15, 0.1, 0.04),
      path([[-0.5, 0.3, 0.051], [0.5, 0.3, 0.051]]),
      [-0.25, 0, 0.25].map((x) => path([[x, -0.575, 0.051], [x, 0.3, 0.051]])),
      [0.01, -0.28].map((y) => path([[-0.5, y, 0.051], [0.5, y, 0.051]])),
      rings, hot(day),
    ), (t) => {
      const step = t / 0.6, n = Math.floor(step), f = smooth((step - n - 0.55) / 0.45);
      const a = CELLS[n % CELLS.length], b = CELLS[(n + 1) % CELLS.length];
      day.position.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + 0.06 * Math.sin(Math.PI * f), 0.052);
      rings.forEach((r, i) => (r.rotation.x = 0.25 * wave(t, 0.7, i * 0.2)));
    });
  },
  bed: () => {
    // the Zs drift up and fade one after another, and the blanket rises and falls with each breath
    const Z = [[-0.55, 0.95, 0.14], [-0.3, 1.18, 0.2]];
    const zs = Z.map(([x, y, s]) => hot(pivot(zee(x, y, s), [x + s / 2, y + s / 2, 0])));
    const blanket = box(1.1, 0.05, 1.14, [0.38, 0.6, 0]);
    return acted(group(
      box(2.0, 0.22, 1.2, [0, 0.25, 0]),
      rbox(1.9, 0.22, 1.1, 0.06, [0.02, 0.47, 0]),
      rbox(0.1, 0.95, 1.2, 0.04, [-1.0, 0.6, 0]),
      rbox(0.42, 0.13, 0.75, 0.05, [-0.68, 0.64, 0]),
      blanket,
      [[-0.95, -0.55], [-0.95, 0.55], [0.95, -0.55], [0.95, 0.55]].map(([x, z]) => box(0.08, 0.16, 0.08, [x, 0.06, z])),
      zs,
    ), (t) => {
      blanket.position.y = 0.6 + 0.025 * swell(t, 0.35);
      zs.forEach((z, i) => {
        const [x, y, s] = Z[i], [up, size] = away(t, 2.2, i * 0.6);
        z.position.set(x + s / 2 + 0.1 * up, y + s / 2 + 0.3 * up, 0);
        z.scale.setScalar(size);
      });
    });
  },
  phone: () => {
    // a notification pops in at the top, the phone jolts, and the like on the second post pulses
    // (the notification the morph drew shrinks away first, so it doesn't blink out on the landing frame)
    const notif = place(group(rect(0.54, 0.15, [0, 0, 0.05]), circle(0.04, [-0.19, 0, 0.051], 12),
      path([[-0.1, 0.025, 0.051], [0.2, 0.025, 0.051]]), path([[-0.1, -0.025, 0.051], [0.08, -0.025, 0.051]])), [0, 0.52, 0]);
    const like = place(circle(0.06, [0, 0, 0]), [-0.18, -0.25, 0.042]);
    const body = group(
      rbox(0.75, 1.5, 0.08, 0.035),
      rect(0.66, 1.34, [0, 0, 0.041]),
      path([[-0.08, 0.62, 0.041], [0.08, 0.62, 0.041]]),
      rect(0.54, 0.34, [0, 0.27, 0.042]),
      path([[-0.05, 0.34, 0.042], [0.07, 0.27, 0.042], [-0.05, 0.2, 0.042]], true),
      path([[-0.27, 0.04, 0.042], [0.2, 0.04, 0.042]]),
      rect(0.54, 0.34, [0, -0.25, 0.042]), like,
      path([[-0.27, -0.48, 0.042], [0.2, -0.48, 0.042]]),
      hot(notif),
    );
    return acted(group(body), (t) => {
      notif.scale.setScalar(Math.max(1e-3, t < 0.35 ? 1 - smooth(t / 0.15) : springIn(t, 0.35)));
      const d = t - 0.35;
      body.rotation.z = d > 0 ? 0.07 * Math.exp(-4 * d) * Math.sin(18 * d) : 0;
      like.scale.setScalar(1 + 0.45 * pulse(t, 1.1, -0.3));
    });
  },
  chat: () => {
    // the typing dots bounce one after another, and the reply bubble nods in
    const dots = [-0.25, -0.05, 0.15].map((x) => place(circle(0.06, [0, 0, 0], 16), [x - 0.15, 0.3, 0.036]));
    const reply = place(group(slab(pill(1.0, 0.5, 0.18, -1), 0.07),
      path([[-0.35, 0.06, 0.036], [0.32, 0.06, 0.036]]), path([[-0.35, -0.06, 0.036], [0.1, -0.06, 0.036]])), [0.3, -0.42, 0.12]);
    return acted(group(slab(pill(1.25, 0.62, 0.2, 1), 0.07, [-0.15, 0.3, 0]), dots.map(hot), reply), (t) => {
      dots.forEach((d, i) => (d.position.y = 0.3 + 0.06 * pulse(t, 1.6, -i * 0.15)));
      reply.rotation.z = 0.05 * wave(t, 0.8);
      reply.scale.setScalar(1 + 0.04 * pulse(t, 0.8, 0.25));
    });
  },
  bowl: () => {
    // the steam curls sway and stretch up, and the chopsticks dip in for a bite
    const steam = [-0.22, 0, 0.22].map((x, k) =>
      hot(pivot(path(Array.from({ length: 9 }, (_, i) => [x + 0.05 * Math.sin(i * 1.3 + k), 0.3 + i * 0.07, 0])), [x, 0.3, 0])));
    const sticks = pivot([path([[-0.5, -0.05, 0.1], [0.75, 0.62, -0.05]]), path([[-0.4, -0.08, 0.2], [0.8, 0.55, 0.12]])], [0.78, 0.6, 0]);
    return acted(group(
      mesh(new THREE.LatheGeometry([[0, -0.4], [0.28, -0.4], [0.3, -0.36], [0.52, -0.12], [0.62, 0.12], [0.6, 0.14]].map(([x, y]) => new THREE.Vector2(x, y)), 14)),
      sticks, steam,
    ), (t) => {
      steam.forEach((s, k) => {
        s.rotation.z = 0.15 * wave(t, 0.5 + 0.15 * k);
        s.scale.y = 1 + 0.25 * swell(t, 0.7 + 0.2 * k);
      });
      sticks.rotation.z = 0.12 * swell(t, 0.6);
    });
  },
  coins: () => {
    // the top coin hops and flips; the standing coin spins
    const coin = (i) => {
      const x = -0.3 + [0, 0.03, -0.02, 0.04, 0.01][i];
      return place(group(cyl(0.5, 0.1, 24), Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * 2 * Math.PI;
        return path([[0.5 * Math.cos(a), -0.05, 0.5 * Math.sin(a)], [0.5 * Math.cos(a), 0.05, 0.5 * Math.sin(a)]]);
      })), [x, -0.4 + i * 0.11, 0]);
    };
    const stack = [0, 1, 2, 3, 4].map(coin), top = hot(stack[4]);
    const standing = place(group(cyl(0.42, 0.09, 24, [0, 0, 0], [Math.PI / 2, 0, 0]), circle(0.3, [0, 0, 0.046])), [0.62, -0.03, 0.1], [0, 0.3, 0]);
    return acted(group(stack, standing), (t) => {
      const h = (t / 1.2) % 1, up = Math.sin(Math.PI * smooth(h / 0.6)) * (h < 0.6 ? 1 : 0);
      top.position.y = 0.04 + 0.35 * up;
      top.rotation.x = h < 0.6 ? 2 * Math.PI * smooth(h / 0.6) : 0;
      standing.rotation.y = 0.3 + 2.2 * t;
    });
  },
  robot: () => {
    // waves with its right arm, tilts its head, blinks, and its antenna ball bobs
    const eyes = [-0.18, 0.18].map((x) => hot(place(circle(0.09, [0, 0, 0], 18), [x, 0.98, 0.301])));
    const ball = hot(place(circle(0.06, [0, 0, 0], 16), [0, 1.53, 0]));
    const head = pivot([rbox(0.8, 0.6, 0.6, 0.1, [0, 0.95, 0]), eyes, path([[-0.1, 0.8, 0.301], [0.1, 0.8, 0.301]]),
      path([[0, 1.25, 0], [0, 1.47, 0]]), ball], [0, 0.62, 0]);
    const arm = (s) => pivot(mesh(new THREE.CapsuleGeometry(0.08, 0.45, 3, 8), [0.6 * s, 0.12, 0], [0, 0, 0.25 * s]), [0.52 * s, 0.4, 0]);
    const armR = arm(1), armL = arm(-1);
    return acted(group(
      head, cyl(0.1, 0.1, 24, [0, 0.6, 0]),
      rbox(0.95, 0.8, 0.55, 0.1, [0, 0.15, 0]),
      rect(0.5, 0.3, [0, 0.22, 0.276]), circle(0.05, [-0.12, -0.05, 0.276], 14), circle(0.05, [0.12, -0.05, 0.276], 14),
      armR, armL,
      [-1, 1].map((s) => box(0.2, 0.35, 0.25, [0.22 * s, -0.45, 0])),
    ), (t) => {
      const up = 0.5 - 0.5 * Math.cos(2 * Math.PI * 0.4 * t);
      armR.rotation.z = up * (2.1 + 0.3 * wave(t, 2.2));
      armL.rotation.z = -0.08 * wave(t, 0.8);
      head.rotation.z = 0.09 * wave(t, 0.45);
      ball.position.y = 1.53 + 0.04 * wave(t, 1.8);
      const blink = (t % 2.6) > 2.45;
      eyes.forEach((e) => (e.scale.y = blink ? 0.15 : 1));
    });
  },
  clock: () => {
    // the minute hand ticks round a step at a time, and the hour hand creeps after it
    const hour = hot(path([[0, 0, 0.052], [0.2, 0.17, 0.052]])), minute = hot(path([[0, 0, 0.052], [-0.05, 0.4, 0.052]]));
    return acted(group(
      cyl(0.6, 0.1, 32, [0, 0, 0], [Math.PI / 2, 0, 0]),
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI, r0 = i % 3 ? 0.47 : 0.42;
        return path([[r0 * Math.cos(a), r0 * Math.sin(a), 0.051], [0.54 * Math.cos(a), 0.54 * Math.sin(a), 0.051]]);
      }),
      hour, minute,
      circle(0.035, [0, 0, 0.052], 12),
    ), (t) => {
      const step = t / 0.3, n = Math.floor(step), turn = (n + smooth((step - n) / 0.4)) / 12;
      minute.rotation.z = -2 * Math.PI * turn;
      hour.rotation.z = (-2 * Math.PI * turn) / 12;
    });
  },
  hourglass: () => {
    // turns over every 2.6 s
    const glass = pivot([
      cyl(0.45, 0.07, 24, [0, 0.66, 0]), cyl(0.45, 0.07, 24, [0, -0.66, 0]),
      lathe([[0.36, -0.62], [0.32, -0.3], [0.06, 0], [0.32, 0.3], [0.36, 0.62]], 10),
      [0, 1, 2].map((i) => {
        const a = (i / 3) * 2 * Math.PI + 0.5;
        return path([[0.41 * Math.cos(a), -0.62, 0.41 * Math.sin(a)], [0.41 * Math.cos(a), 0.62, 0.41 * Math.sin(a)]]);
      }),
      hot(path([[-0.22, -0.6, 0], [0, -0.48, 0], [0.22, -0.6, 0]])),
    ], [0, 0, 0]);
    return acted(group(glass), (t) => {
      const n = Math.floor(t / 2.6), f = smooth(((t % 2.6) - 1.9) / 0.7);
      glass.rotation.z = Math.PI * (n + f);
    });
  },
  laptop: () => {
    // the page on the screen scrolls up line by line; a line leaving the top shrinks away and comes back in at the bottom
    const rows = [0.6, 0.9, 0.75, 0.5].map((w, i) => place(path([[-w / 2, 0, 0], [w / 2, 0, 0]]), [-0.5 + w / 2, 0.24 - i * 0.16, 0.027]));
    return acted(group(
      box(1.4, 0.05, 0.95, [0, -0.3, 0.1]),
      place(group(rbox(1.4, 0.9, 0.05, 0.05), hot(rect(1.24, 0.76, [0, 0, 0.026])), rows), [0, 0.15, -0.4], [-0.22, 0, 0]),
      [-0.12, 0.02, 0.16].map((z) => path([[-0.55, -0.27, z], [0.55, -0.27, z]])),
      [-0.33, -0.11, 0.11, 0.33].map((x) => path([[x, -0.27, -0.19], [x, -0.27, 0.16]])),
      place(rect(0.4, 0.2), [0, -0.274, 0.4], [-Math.PI / 2, 0, 0]),
    ), (t) => rows.forEach((r, i) => {
      const y = ((0.56 - i * 0.16 + 0.12 * t) % 0.64) - 0.32;
      r.position.y = y;
      r.scale.x = Math.max(1e-3, smooth((0.32 - Math.abs(y)) / 0.08));
    }));
  },
  mail: () => {
    // the flap flips open and a letter slides up out of the envelope, then bobs there
    const flap = hot(pivot(path([[-0.65, 0.42, 0.031], [0, -0.02, 0.031], [0.65, 0.42, 0.031]]), [0, 0.42, 0.031]));
    const letter = group(rect(1.0, 0.6), [0.12, 0, -0.12].map((y) => path([[-0.35, y, 0], [0.35, y, 0]])));
    letter.scale.setScalar(1e-3); // inside the envelope until it opens; lines show through, so it starts folded to nothing
    return acted(group(
      slab(shape([[-0.65, -0.42], [0.65, -0.42], [0.65, 0.42], [-0.65, 0.42]]), 0.06),
      flap,
      path([[-0.65, -0.42, 0.031], [-0.16, 0.08, 0.031]]), path([[0.65, -0.42, 0.031], [0.16, 0.08, 0.031]]),
      letter,
    ), (t) => {
      flap.rotation.x = -2.5 * smooth((t - 0.15) / 0.35);
      const out = smooth((t - 0.45) / 0.45);
      letter.scale.setScalar(Math.max(1e-3, smooth(out / 0.3)));
      letter.position.y = 0.4 * out + 0.03 * out * wave(t, 0.6);
    });
  },
  wallet: () => {
    // the card slides up out of the wallet and back
    const card = hot(slab(shape([[-0.45, 0.4], [0.35, 0.4], [0.35, 0.58], [-0.45, 0.58]]), 0.03, [0, 0, -0.02]));
    const strap = rbox(0.42, 0.32, 0.22, 0.08, [0.45, 0.02, 0]);
    return acted(group(rbox(1.2, 0.8, 0.18, 0.12), card, strap, circle(0.05, [0.5, 0.02, 0.112], 14)), (t) => {
      card.position.y = 0.16 * pulse(t, 0.55);
    });
  },
  card: () => {
    // the card taps, tipping forward and back, and the contactless waves beside the chip pulse out after each tap
    const waves = [0.06, 0.1, 0.14].map((r) => hot(path(arc(r, -0.7, 0.7, [0, 0, 0], 8))));
    const body = group(
      slab(pill(1.4, 0.88, 0.08), 0.03),
      hot(rect(0.22, 0.17, [-0.42, 0.08, 0.016])),
      path([[-0.53, 0.08, 0.016], [-0.31, 0.08, 0.016]]),
      [-0.45, -0.15, 0.15, 0.45].map((x) => path([[x - 0.1, -0.18, 0.016], [x + 0.1, -0.18, 0.016]])),
      path([[-0.55, -0.32, 0.016], [-0.15, -0.32, 0.016]]),
      circle(0.09, [0.45, 0.25, 0.016], 16), circle(0.09, [0.55, 0.25, 0.016], 16),
      place(group(waves), [-0.24, 0.08, 0.016]),
    );
    return acted(group(body), (t) => {
      const p = t % 1.4;
      body.rotation.x = 0.4 * bump(p / 0.4);
      waves.forEach((w, i) => w.scale.setScalar(1 + 0.4 * bump((p - 0.25 - i * 0.08) / 0.35)));
    });
  },
  bars: () => {
    // the bars grow taller one after another, with a springy overshoot, the last and tallest one the most
    const bars = [0.4, 0.7, 0.55, 1.0].map((h, i) =>
      pivot((i === 3 ? hot : (o) => o)(box(0.24, h, 0.24, [-0.54 + i * 0.36, -0.5 + h / 2, 0])), [-0.54 + i * 0.36, -0.5, 0]));
    return acted(group(
      bars,
      path([[-0.8, -0.5, 0.2], [0.8, -0.5, 0.2]]), path([[-0.8, -0.5, 0.2], [-0.8, 0.62, 0.2]]),
    ), (t) => bars.forEach((b, i) => (b.scale.y = 1 + [0.1, 0.12, 0.2, 0.3][i] * springIn(t, 0.2 + 0.15 * i))));
  },
  "line-chart": () => {
    // a pulse runs along the line from point to point, and the arrow nudges on up the trend
    const pts = [[-0.55, -0.3], [-0.28, -0.12], [-0.02, -0.2], [0.24, 0.1], [0.5, 0.32]];
    const dots = pts.map(([x, y]) => hot(pivot(circle(0.035, [x, y, 0.027], 12), [x, y, 0.027])));
    const head = hot(pivot(path([[0.42, 0.33, 0.027], [0.5, 0.32, 0.027], [0.47, 0.24, 0.027]]), [0.5, 0.32, 0.027]));
    return acted(group(
      rbox(1.5, 1.05, 0.05, 0.06),
      path([[-0.62, -0.38, 0.026], [0.65, -0.38, 0.026]]), path([[-0.62, -0.38, 0.026], [-0.62, 0.42, 0.026]]),
      hot(path(pts.map(([x, y]) => [x, y, 0.027]))),
      dots, head,
    ), (t) => {
      const p = t % 1.6, k = bump((p - 0.7) / 0.4);
      dots.forEach((d, i) => d.scale.setScalar(1 + 1.2 * bump((p - 0.15 * i) / 0.3)));
      head.position.set(0.5 + 0.05 * k, 0.32 + 0.04 * k, 0.027);
    });
  },
  pie: () => {
    // the accent slice slides out of the pie toward the viewer and back, as if being served
    const A = 0.45, slice = hot(place(slab(wedge(0.62, 0, 0.9), 0.14), [0.09 * Math.cos(A), 0.09 * Math.sin(A), 0]));
    return acted(group(
      slab(wedge(0.62, 0.9, 2 * Math.PI), 0.14),
      slice,
      path([[0, 0, 0.071], [0.62 * Math.cos(3.6), 0.62 * Math.sin(3.6), 0.071]]),
    ), (t) => {
      const s = swell(t, 0.5), out = 0.09 + 0.14 * s;
      slice.position.set(out * Math.cos(A), out * Math.sin(A), 0.1 * s);
    });
  },
  gauge: () => {
    // the needle revs up toward the top of the scale, shaking there, and drops back
    const sh = new THREE.Shape();
    sh.moveTo(-0.75, 0);
    sh.absarc(0, 0, 0.75, Math.PI, 0, true);
    sh.lineTo(-0.75, 0);
    const needle = hot(path([[0, 0, 0.042], [0.42 * Math.cos(0.6), 0.42 * Math.sin(0.6), 0.042]]));
    return acted(group(
      slab(sh, 0.08),
      path(arc(0.6, Math.PI, 0, [0, 0, 0.041], 28)),
      Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI - (i / 8) * Math.PI;
        return path([[0.5 * Math.cos(a), 0.5 * Math.sin(a), 0.041], [0.6 * Math.cos(a), 0.6 * Math.sin(a), 0.041]]);
      }),
      needle,
      circle(0.06, [0, 0, 0.042], 14),
    ), (t) => {
      const rev = swell(t, 0.45);
      needle.rotation.z = -0.5 * rev + 0.04 * rev * Math.sin(37 * t);
    });
  },
  rocket: () => {
    // hovers with a small shake while its flame flickers
    const flame = hot(pivot(path([[-0.12, -0.5, 0], [-0.06, -0.72, 0], [0, -0.58, 0], [0.06, -0.8, 0], [0.12, -0.5, 0]]), [0, -0.5, 0]));
    const body = group(
      lathe([[0.02, 0.95], [0.12, 0.8], [0.24, 0.5], [0.27, 0.1], [0.25, -0.35], [0.18, -0.45]], 10),
      [0, 1, 2].map((i) => place(slab(shape([[0.2, -0.05], [0.48, -0.45], [0.48, -0.55], [0.2, -0.4]]), 0.03), [0, 0, 0], [0, (i / 3) * 2 * Math.PI, 0])),
      circle(0.09, [0, 0.35, 0.265], 16), flame,
    );
    return acted(group(body), (t) => {
      body.position.set(0.006 * Math.sin(41 * t), 0.05 * wave(t, 0.7), 0);
      flame.scale.y = 0.8 + 0.5 * Math.abs(Math.sin(13 * t) * Math.cos(7 * t));
    });
  },
  bulb: () => {
    // the rays pulse out and the filament flickers
    const rays = hot(pivot([0.5, 1.2, 1.95, 2.65].map((a) => path([[0.55 * Math.cos(a), 0.4 + 0.55 * Math.sin(a), 0], [0.7 * Math.cos(a), 0.4 + 0.7 * Math.sin(a), 0]])), [0, 0.4, 0]));
    const filament = pivot(path([[-0.07, -0.05, 0], [-0.07, 0.3, 0], [-0.03, 0.4, 0], [0.01, 0.3, 0], [0.05, 0.4, 0], [0.07, 0.3, 0], [0.07, -0.05, 0]]), [0, -0.05, 0]);
    return acted(group(
      lathe([[0.15, -0.2], [0.2, -0.05], [0.33, 0.15], [0.42, 0.4], [0.4, 0.62], [0.28, 0.8], [0.1, 0.86], [0.02, 0.87]], 12),
      [-0.24, -0.32, -0.4].map((y) => cyl(0.16, 0.06, 24, [0, y, 0])),
      filament, rays,
    ), (t) => {
      rays.scale.setScalar(1 + 0.3 * pulse(t, 1.3));
      filament.scale.y = 0.92 + 0.08 * Math.sin(27 * t);
    });
  },
  target: () => {
    // the arrow quivers in the centre, the rings ripple out from the hit, then it pulls back and strikes again
    const back = new THREE.Vector3(0.55, 0.5, 0.5).normalize();
    const rings = [0.44, 0.26, 0.09].map((r) => circle(r, [0, 0, 0.041], 28));
    const arrow = hot(group(path([[0, 0, 0.041], [0.55, 0.5, 0.5]]),
      path([[0.55, 0.5, 0.5], [0.62, 0.62, 0.52], [0.68, 0.5, 0.58]]), path([[0.55, 0.5, 0.5], [0.66, 0.46, 0.5]])));
    return acted(group(cyl(0.62, 0.08, 32, [0, 0, 0], [Math.PI / 2, 0, 0]), rings, arrow), (t) => {
      const p = t % 2.4, pull = p < 1.6 ? 0 : p < 2.2 ? smooth((p - 1.6) / 0.6) : 1 - (p - 2.2) / 0.2;
      arrow.position.copy(back).multiplyScalar(0.5 * pull);
      const q = 0.07 * Math.exp(-5 * p) * Math.sin(30 * p);
      arrow.rotation.set(q, -q, 0);
      rings.forEach((r, i) => r.scale.setScalar(1 + 0.12 * bump((p - 0.05 * (2 - i)) / 0.35)));
    });
  },
  magnet: () => {
    // little people fly up into the poles one after another, and the magnet sways as it pulls them in
    const u = new THREE.Shape();
    u.moveTo(-0.6, -0.5);
    u.lineTo(-0.6, 0);
    u.absarc(0, 0, 0.6, Math.PI, 0, true);
    u.lineTo(0.6, -0.5);
    u.lineTo(0.3, -0.5);
    u.lineTo(0.3, 0);
    u.absarc(0, 0, 0.3, 0, Math.PI, false);
    u.lineTo(-0.3, -0.5);
    u.lineTo(-0.6, -0.5);
    const FEET = [[-0.45, -0.92], [0.45, -0.92], [-0.17, -1.02], [0.17, -1.02]];
    const leads = FEET.map(([x, y]) => hot(person(0.2, [x, y, 0])));
    const body = group(
      slab(u, 0.24),
      path([[-0.6, -0.3, 0.121], [-0.3, -0.3, 0.121]]), path([[0.3, -0.3, 0.121], [0.6, -0.3, 0.121]]),
    );
    return acted(group(body, leads), (t) => {
      body.rotation.z = 0.05 * wave(t, 0.4);
      leads.forEach((b, i) => {
        const [x, y] = FEET[i], [go, size] = away(t, 1.5, i * 0.3);
        b.position.set(x + (Math.sign(x) * 0.45 - x) * go, y + (-0.72 - y) * go, 0);
        b.scale.setScalar(size);
      });
    });
  },
  trophy: () => {
    // it hops on the spot, and two sparkles twinkle beside it
    const star = (x, y, s) => hot(place(group(path([[-s, 0, 0], [s, 0, 0]]), path([[0, -s, 0], [0, s, 0]])), [x, y, 0.1]));
    const sparkles = [star(0.55, 0.95, 0.09), star(-0.55, 0.2, 0.06)];
    const cup = group(
      lathe([[0.08, 0.05], [0.2, 0.15], [0.36, 0.4], [0.42, 0.75], [0.43, 0.78]], 12),
      hot(path(arc(0.16, Math.PI / 2, -Math.PI / 2, [0.45, 0.55, 0], 14))), hot(path(arc(0.16, Math.PI / 2, 3 * Math.PI / 2, [-0.45, 0.55, 0], 14))),
      cyl(0.06, 0.25, 12, [0, -0.08, 0]),
      box(0.55, 0.12, 0.4, [0, -0.26, 0]), box(0.42, 0.14, 0.3, [0, -0.39, 0]),
    );
    return acted(group(cup, sparkles), (t) => {
      cup.position.y = 0.06 * Math.abs(Math.sin(Math.PI * 0.9 * t));
      sparkles.forEach((s, i) => {
        const k = Math.max(0, t - i * 0.4);
        s.scale.setScalar(1 - 0.75 * swell(k, 1.1));
        s.rotation.z = 1.5 * k;
      });
    });
  },
  gift: () => {
    // the lid pops up and tips open, and the bow wobbles
    const bow = [hot(place(circle(0.14, [0, 0, 0], 18), [-0.14, 0.45, 0], [0, 0, 0.5])), hot(place(circle(0.14, [0, 0, 0], 18), [0.14, 0.45, 0], [0, 0, -0.5]))];
    const lid = pivot([box(1.0, 0.18, 1.0, [0, 0.24, 0]), path([[0, 0.33, -0.5], [0, 0.33, 0.5]]), path([[-0.5, 0.33, 0], [0.5, 0.33, 0]]), bow], [-0.5, 0.15, 0]);
    return acted(group(box(0.9, 0.7, 0.9, [0, -0.2, 0]), path([[0, 0.15, 0.451], [0, -0.55, 0.451]]), lid), (t) => {
      const o = springIn(t, 0.45);
      lid.position.y = 0.15 + 0.12 * o;
      lid.rotation.z = 0.32 * o;
      bow.forEach((b, i) => (b.rotation.z = (i ? -0.5 : 0.5) + 0.15 * wave(t, 1.4, i * 0.5)));
    });
  },
  shop: () => {
    // the awning flutters and the sign glows in and out
    const awning = place(group(box(1.55, 0.04, 0.5), [-0.6, -0.3, 0, 0.3, 0.6].map((x) => path([[x, 0.021, -0.25], [x, 0.021, 0.25]]))), [0, 0.32, 0.45], [0.45, 0, 0]);
    const sign = hot(place(slab(shape([[-0.5, -0.11], [0.5, -0.11], [0.5, 0.11], [-0.5, 0.11]]), 0.04), [0, 0.61, 0.1]));
    return acted(group(
      box(1.4, 0.85, 0.8, [0, -0.2, 0]), awning, sign,
      rect(0.32, 0.6, [-0.3, -0.33, 0.401]),
      rect(0.5, 0.35, [0.3, -0.2, 0.401]), path([[0.3, -0.375, 0.401], [0.3, -0.025, 0.401]]),
    ), (t) => {
      awning.rotation.x = 0.45 + 0.06 * wave(t, 0.9);
      sign.scale.setScalar(1 + 0.06 * pulse(t, 0.8));
    });
  },
  box: () => {
    // the box hops, and its flaps, hinged on the top edges, flap up with each hop
    const flaps = [1, -1].map((s) => place(pivot(box(1.0, 0.02, 0.36, [0, 0.21, 0.58 * s]), [0, 0.21, 0.4 * s]), [0, 0.21, 0.4 * s], [-0.5 * s, 0, 0]));
    const body = group(
      box(1.0, 0.72, 0.8, [0, -0.15, 0]),
      flaps,
      path([[-0.5, 0.21, 0], [0.5, 0.21, 0]]),
      hot(path([[-0.2, 0.211, 0.4], [-0.2, -0.1, 0.401]])), hot(path([[0.2, 0.211, 0.4], [0.2, -0.1, 0.401]])),
    );
    return acted(group(body), (t) => {
      const h = Math.abs(Math.sin(Math.PI * 0.8 * t));
      body.position.y = 0.07 * h;
      flaps.forEach((f, i) => (f.rotation.x = (i ? 1 : -1) * (0.5 + 0.4 * h)));
    });
  },
  truck: () => {
    // the wheels roll, the body bounces, and the road dashes rush past underneath
    const wheel = (x, z) => place(group(cyl(0.17, 0.1, 24, [0, 0, 0], [Math.PI / 2, 0, 0]),
      path([[-0.15, 0, 0.051], [0.15, 0, 0.051]]), path([[0, -0.15, 0.051], [0, 0.15, 0.051]])), [x, -0.32, z]);
    const wheels = [[-0.65, 0.36], [0.62, 0.36], [-0.65, -0.36], [0.62, -0.36]].map(([x, z]) => wheel(x, z));
    const body = group(box(1.3, 0.75, 0.7, [-0.25, 0.1, 0]), rbox(0.5, 0.55, 0.7, 0.08, [0.68, 0.0, 0]), rect(0.26, 0.2, [0.72, 0.1, 0.351]));
    const dashes = Array.from({ length: 6 }, (_, i) => hot(place(path([[-0.09, 0, 0], [0.09, 0, 0]]), [-1.1 + i * 0.44, -0.5, 0.55])));
    return acted(group(body, wheels, dashes), (t) => {
      wheels.forEach((w) => (w.rotation.z = -6 * t));
      body.position.y = 0.02 * pulse(t, 3.2);
      const off = (t * 1.6) % 0.44;
      dashes.forEach((d, i) => (d.position.x = -1.1 + ((i * 0.44 - off + 2.64) % 2.64)));
    });
  },
  person: () => {
    // breathes, nods and sways a little
    const p = person(1.1, [0, -0.5, 0]), { body, head } = p.userData.parts;
    hot(head);
    return acted(group(p), (t) => {
      body.scale.y = 1 + 0.03 * wave(t, 0.45);
      head.position.y = 0.025 * wave(t, 0.45, 0.1) - 0.02 * pulse(t, 0.9, 0.3);
      p.rotation.z = 0.03 * wave(t, 0.3);
    });
  },
  people: () => {
    // the three hop out of step with each other
    const crowd = [person(1.15, [0, -0.6, 0.15]), person(0.9, [-0.55, -0.6, -0.15]), person(0.9, [0.55, -0.6, -0.15])];
    hot(crowd[0].userData.parts.head);
    return acted(group(crowd), (t) => crowd.forEach((p, i) => (p.position.y = p.userData.parts.y0 + 0.07 * pulse(t, 1.1, [0, 0.33, 0.66][i]))));
  },
  megaphone: () => {
    // the sound waves pulse out one after another and the horn kicks with them
    const arcs = [0.62, 0.78, 0.94].map((r) => hot(path(arc(r, -0.5, 0.5, [0, 0, 0], 12))));
    const horn = group(
      lathe([[0.1, -0.35], [0.14, -0.2], [0.3, 0.2], [0.42, 0.4], [0.43, 0.42]], 10, [0, 0, 0], [0, 0, -Math.PI / 2]),
      box(0.1, 0.32, 0.12, [-0.1, -0.24, 0], [0, 0, 0.15]),
    );
    return acted(group(horn, arcs), (t) => {
      arcs.forEach((a, i) => a.scale.setScalar(1 + 0.16 * pulse(t, 1.3, -i / 6)));
      horn.rotation.z = 0.06 * pulse(t, 1.3);
    });
  },
  // a spiral notebook with ruled lines and a pen across it: writing, notes, a list, "write it down"
  notebook: () => {
    // the pen writes along the page, back and forth, with small quick strokes
    const pen = hot(place(group(cyl(0.035, 0.9, 6), mesh(new THREE.ConeGeometry(0.035, 0.11, 6), [0, -0.505, 0], [Math.PI, 0, 0])), [0.22, -0.05, 0.12], [0, 0, 0.62]));
    return acted(group(
      slab(pill(0.9, 1.15, 0.05), 0.08),
      Array.from({ length: 7 }, (_, i) => place(circle(0.065, [0, 0, 0], 14), [-0.45, 0.45 - i * 0.15, 0], [Math.PI / 2, 0, 0])),
      Array.from({ length: 6 }, (_, i) => path([[-0.3, 0.36 - i * 0.14, 0.041], [0.38, 0.36 - i * 0.14, 0.041]])),
      pen,
    ), (t) => pen.position.set(0.22 - 0.2 * swell(t, 0.5), -0.05 + 0.02 * Math.sin(2 * Math.PI * 4 * t), 0.12));
  },
  // the comment box at the end: the CTA word is typed into it by the style, at userData.anchor
  comment: () => {
    // once the word is typed, the send arrow nudges forward as if about to send
    const send = hot(group(path([[0.82, -0.1, 0.036], [1.06, 0, 0.036], [0.82, 0.1, 0.036], [0.87, 0, 0.036]], true)));
    const g = acted(group(slab(pill(2.4, 0.5, 0.25), 0.07), circle(0.16, [-0.92, 0, 0.036], 22), send),
      (t) => (send.position.x = t > 0.7 ? 0.06 * pulse(t - 0.7, 1.2) : 0));
    g.userData.anchor = [-0.66, 0, 0.036];
    g.userData.front = true;
    return g;
  },
  // a terminal window; the style types the beat's "lines" into it from userData.anchor (the text area's top left).
  // It is drawn a little larger (1.25) so 30 characters of 30 px mono fit, and faces the viewer like the comment box.
  terminal: () => {
    const g = group(
      slab(pill(1.7, 1.1, 0.08), 0.06),
      path([[-0.85, 0.36, 0.031], [0.85, 0.36, 0.031]]),
      [-0.72, -0.6, -0.48].map((x) => hot(circle(0.035, [x, 0.43, 0.031], 12))),
    );
    Object.assign(g.userData, { anchor: [-0.74, 0.27, 0.031], front: true, size: 1.25 });
    return g;
  },
};
