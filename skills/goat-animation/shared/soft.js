// The object library drawn solid (Stage, Collage): meshes get matte paint and rounded edges, open line parts become thin
// rods, and closed outlines on a face become flat inlays (dark on the body, light on a dark inlay). The new parts hang
// under the old line objects, so an object's acting still moves them.
import * as THREE from "three";
import { RoundedBoxGeometry } from "./three/addons/geometries/RoundedBoxGeometry.js";

const HIDE = new THREE.LineBasicMaterial({ visible: false });
const isHot = (o) => {
  for (let x = o; x; x = x.parent) if (x.userData.accent) return true;
  return false;
};

// line pieces (pairs of points) joined end to end into chains; a chain whose ends meet is closed
export function chains(arr) {
  const segs = [];
  for (let i = 0; i < arr.length; i += 6) segs.push([new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]), new THREE.Vector3(arr[i + 3], arr[i + 4], arr[i + 5])]);
  const used = segs.map(() => false), out = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const pts = [...segs[s]];
    for (let grew = true; grew;) {
      grew = false;
      for (let k = 0; k < segs.length; k++) {
        if (used[k]) continue;
        const end = pts.at(-1), [a, b] = segs[k];
        const next = a.distanceTo(end) < 1e-4 ? b : b.distanceTo(end) < 1e-4 ? a : null;
        if (next) pts.push(next), (used[k] = grew = true);
      }
    }
    const closed = pts.length > 3 && pts[0].distanceTo(pts.at(-1)) < 1e-4;
    if (closed) pts.pop();
    out.push({ pts, closed });
  }
  return out;
}

// a closed chain's plane (Newell's normal), or null when its points don't lie flat
function plane(pts) {
  const n = new THREE.Vector3(), c = new THREE.Vector3();
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n.x += (p.y - q.y) * (p.z + q.z);
    n.y += (p.z - q.z) * (p.x + q.x);
    n.z += (p.x - q.x) * (p.y + q.y);
    c.add(p);
  });
  if (n.length() < 1e-8) return null;
  n.normalize();
  c.divideScalar(pts.length);
  if (pts.some((p) => Math.abs(n.dot(p.clone().sub(c))) > 1e-3)) return null;
  const u = new THREE.Vector3().subVectors(pts[0], c).normalize(), v = new THREE.Vector3().crossVectors(n, u);
  return { n, c, u, v, flat: pts.map((p) => new THREE.Vector2(u.dot(p.clone().sub(c)), v.dot(p.clone().sub(c)))) };
}

function fillGeo(pts) {
  const pl = plane(pts);
  if (!pl) return null;
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pl.flat), 1), p = geo.attributes.position, w = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    w.copy(pl.c).addScaledVector(pl.u, p.getX(i)).addScaledVector(pl.v, p.getY(i));
    p.setXYZ(i, w.x, w.y, w.z);
  }
  geo.computeVertexNormals();
  return { geo, pl };
}

// a rod along an open chain: a cylinder per piece and a ball at each joint, in one geometry
function rodGeo(pts, r) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  pts.forEach((p, i) => {
    parts.push(new THREE.SphereGeometry(r, 10, 6).translate(p.x, p.y, p.z));
    const q = pts[i + 1];
    if (!q) return;
    const d = new THREE.Vector3().subVectors(q, p), len = d.length();
    if (len < 1e-6) return;
    const g = new THREE.CylinderGeometry(r, r, len, 10, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
    parts.push(g.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2));
  });
  return merge(parts);
}

function merge(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = flat.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let at = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, at * 3);
    nor.set(g.attributes.normal.array, at * 3);
    at += g.attributes.position.count;
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3)).setAttribute("normal", new THREE.BufferAttribute(nor, 3));
}

// rounder versions of the library's hard shapes
function rounder(geo) {
  const P = geo.parameters;
  if (geo.type === "BoxGeometry") return new RoundedBoxGeometry(P.width, P.height, P.depth, 3, Math.min(0.06, 0.25 * Math.min(P.width, P.height, P.depth)));
  if (geo.type === "ExtrudeGeometry" && !P.options.bevelEnabled) {
    const depth = P.options.depth, t = Math.min(0.35 * depth, 0.03);
    const g = new THREE.ExtrudeGeometry(P.shapes, { depth: Math.max(depth - 2 * t, 1e-3), bevelEnabled: true, bevelThickness: t, bevelSize: 0.8 * t, bevelOffset: -0.8 * t, bevelSegments: 3, curveSegments: 12 });
    return g.translate(0, 0, t - depth / 2);
  }
  if (geo.type === "LatheGeometry") return new THREE.LatheGeometry(P.points, 48);
  if (geo.type === "CylinderGeometry") return new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, Math.max(P.radialSegments, 40), 1);
  return geo;
}

// Draws object `g` (fresh from OBJECTS) solid, in place. colors: { body, ink, accent } (anything THREE.Color takes).
export function soften(g, { body, ink, accent, rod = 0.016, roughness = 0.62 }) {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const M = { body: mat(body), ink: mat(ink), accent: mat(accent) };
  M.body.polygonOffset = false;
  M.body.side = THREE.FrontSide;
  g.updateMatrixWorld(true);
  const lines = [], fills = [], rods = [];
  g.traverse((o) => {
    if (o.isMesh) {
      o.geometry = rounder(o.geometry);
      o.material = isHot(o) ? M.accent : M.body;
      o.castShadow = o.receiveShadow = true;
    } else if (o.isLineSegments) lines.push(o);
  });
  for (const o of lines) {
    o.material = HIDE;
    if (o.userData.edge) continue; // an outline Wireframe draws around a solid that's already there
    const hot = isHot(o), world = (pts) => pts.map((p) => p.clone().applyMatrix4(o.matrixWorld));
    for (const ch of chains(o.geometry.attributes.position.array)) {
      // an accent zigzag whose ends nearly meet (a flame) is filled like a closed outline
      const nearlyClosed = hot && ch.pts.length >= 4 && ch.pts[0].distanceTo(ch.pts.at(-1)) < 0.3;
      const f = (ch.closed || nearlyClosed) && fillGeo(ch.pts);
      if (f) {
        const area = Math.abs(THREE.ShapeUtils.area(f.pl.flat));
        // a big accent outline is a screen: dark glass, with what's drawn on it in light
        const screen = hot && area > 0.3, m = new THREE.Mesh(f.geo, hot && !screen ? M.accent : M.ink);
        m.castShadow = m.receiveShadow = true;
        o.add(m);
        if (!hot || screen) fills.push({ m, area, pts: world(ch.pts) });
      } else {
        const m = new THREE.Mesh(rodGeo(ch.pts, rod), hot ? M.accent : M.ink);
        m.castShadow = true;
        o.add(m);
        if (!hot) rods.push({ m, pts: world(ch.pts) });
      }
    }
  }
  // anything drawn on a dark inlay turns light, and anything on that turns dark again
  const layersUnder = (pts, self, area) => {
    const pf = self && plane(pts); // a rod has no plane of its own; only its middle has to sit on the inlay
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
    return fills.filter((h) => {
      if (h === self || h.area <= area) return false;
      const ph = plane(h.pts);
      if (!ph || Math.abs(ph.n.dot(c.clone().sub(ph.c))) > 0.03 || (pf && Math.abs(ph.n.dot(pf.n)) < 0.99)) return false;
      return inside(new THREE.Vector2(ph.u.dot(c.clone().sub(ph.c)), ph.v.dot(c.clone().sub(ph.c))), ph.flat);
    }).length;
  };
  for (const f of fills) if (layersUnder(f.pts, f, f.area) % 2) f.m.material = M.body;
  for (const r of rods) if (layersUnder(r.pts, null, 0) % 2) r.m.material = M.body;
  return g;
}

function inside(p, poly) {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inn = !inn;
  }
  return inn;
}
