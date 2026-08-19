import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Euler,
  Matrix4,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { WELT, hoeheBei, steigungBei, type Terraindaten } from './heightmap';
import { abstandZurStrecke, type Streckendaten } from './strecke';

/**
 * Alles fürs Gelände: Schotterpisten, Sprungrampen und ein Felsenfeld.
 *
 * Die Pisten sind bewusst KEINE eingeschnittenen Straßen wie der Rundkurs.
 * Sie folgen dem Gelände mit allen Bodenwellen – genau das macht Offroad aus.
 * Sie sind reine Optik: gefahren wird auf dem Terrain darunter, nur der Grip
 * ist dort etwas anders (siehe `istPiste`).
 */

export const OFFROAD = {
  /** Breite einer Schotterpiste. */
  pistenBreite: 5.5,
  /** Abtastung entlang der Piste. */
  abtastung: 3,
  /** Wie weit die Piste über dem Boden schwebt (gegen Z-Fighting). */
  ueberhoehung: 0.05,
  /** Anzahl Sprungrampen. */
  rampen: 6,
  /** Anzahl großer Felsblöcke im Felsenfeld. */
  felsbloecke: 34,
  keim: 5150,
} as const;

/**
 * Die Verläufe der Geländepisten als Stützpunkte.
 *
 * Als eigene Funktion, damit auch die Karte sie zeichnen kann, ohne die
 * ganze 3D-Komponente zu laden.
 */
export function PISTEN_WEGE(): { x: number; z: number }[][] {
  const rand = WELT.groesse / 2 - 60;
  return [
    [
      { x: -rand * 0.9, z: rand * 0.2 },
      { x: -rand * 0.35, z: rand * 0.62 },
      { x: rand * 0.2, z: rand * 0.35 },
      { x: rand * 0.62, z: rand * 0.78 },
    ],
    [
      { x: rand * 0.85, z: -rand * 0.15 },
      { x: rand * 0.3, z: -rand * 0.55 },
      { x: -rand * 0.25, z: -rand * 0.3 },
      { x: -rand * 0.75, z: -rand * 0.7 },
    ],
    [
      { x: -rand * 0.15, z: -rand * 0.85 },
      { x: rand * 0.1, z: -rand * 0.2 },
      { x: -rand * 0.2, z: rand * 0.3 },
      { x: rand * 0.05, z: rand * 0.85 },
    ],
  ];
}

function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Schotter-/Erdtextur mit Steinchen und Fahrspuren. */
function macheSchotterTextur() {
  const g = 256;
  const c = document.createElement('canvas');
  c.width = c.height = g;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a7351';
  ctx.fillRect(0, 0, g, g);

  const umlaufend = (zeichne: (dx: number, dy: number) => void) => {
    for (const dx of [-g, 0, g]) for (const dy of [-g, 0, g]) zeichne(dx, dy);
  };

  // Steinchen
  for (let i = 0; i < 2400; i++) {
    const hell = 90 + Math.random() * 110;
    ctx.fillStyle = `rgba(${hell}, ${hell * 0.9}, ${hell * 0.72}, 0.75)`;
    const r = 0.6 + Math.random() * 2.4;
    const x = Math.random() * g;
    const y = Math.random() * g;
    umlaufend((dx, dy) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Zwei ausgefahrene Spurrillen längs
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#5f4c33';
  for (const mitte of [g * 0.3, g * 0.7]) {
    ctx.fillRect(mitte - g * 0.075, 0, g * 0.15, g);
  }
  ctx.globalAlpha = 1;

  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface Pistenpunkt {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  distanz: number;
}

/**
 * Legt eine Piste durchs Gelände.
 *
 * Anders als die Asphaltstraße wird die Höhe NICHT geglättet: Die Piste folgt
 * jeder Kuppe und Senke. Das ist der ganze Reiz – man wird durchgeschüttelt.
 */
export function machePiste(
  terrain: Terraindaten,
  stuetzpunkte: { x: number; z: number }[],
): Pistenpunkt[] {
  const punkte: Pistenpunkt[] = [];
  let distanz = 0;

  for (let seg = 0; seg < stuetzpunkte.length - 1; seg++) {
    const a = stuetzpunkte[seg];
    const b = stuetzpunkte[seg + 1];
    const laenge = Math.hypot(b.x - a.x, b.z - a.z);
    const schritte = Math.max(2, Math.round(laenge / OFFROAD.abtastung));
    for (let i = 0; i < schritte; i++) {
      const t = i / schritte;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const rx = (b.x - a.x) / laenge;
      const rz = (b.z - a.z) / laenge;
      if (punkte.length > 0) {
        const v = punkte[punkte.length - 1];
        distanz += Math.hypot(x - v.x, z - v.z);
      }
      punkte.push({ x, y: hoeheBei(terrain, x, z), z, rx, rz, distanz });
    }
  }
  return punkte;
}

/** Baut das sichtbare Band einer Piste. */
function bauePistenGeometrie(terrain: Terraindaten, punkte: Pistenpunkt[]) {
  const n = punkte.length;
  const halb = OFFROAD.pistenBreite / 2;
  const positionen = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const normalen = new Float32Array(n * 2 * 3);

  for (let i = 0; i < n; i++) {
    const p = punkte[i];
    const nx = -p.rz;
    const nz = p.rx;
    const lx = p.x + nx * halb;
    const lz = p.z + nz * halb;
    const rx = p.x - nx * halb;
    const rz = p.z - nz * halb;

    positionen[i * 6] = lx;
    positionen[i * 6 + 1] = hoeheBei(terrain, lx, lz) + OFFROAD.ueberhoehung;
    positionen[i * 6 + 2] = lz;
    positionen[i * 6 + 3] = rx;
    positionen[i * 6 + 4] = hoeheBei(terrain, rx, rz) + OFFROAD.ueberhoehung;
    positionen[i * 6 + 5] = rz;

    const v = p.distanz / 6;
    uvs[i * 4] = 0;
    uvs[i * 4 + 1] = v;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = v;

    // Normale aus dem Gelände, damit Piste und Boden gleich beleuchtet werden
    const d = 1.2;
    const gx = -(hoeheBei(terrain, p.x + d, p.z) - hoeheBei(terrain, p.x - d, p.z)) / (2 * d);
    const gz = -(hoeheBei(terrain, p.x, p.z + d) - hoeheBei(terrain, p.x, p.z - d)) / (2 * d);
    const len = Math.hypot(gx, 1, gz);
    for (const k of [0, 3]) {
      normalen[i * 6 + k] = gx / len;
      normalen[i * 6 + k + 1] = 1 / len;
      normalen[i * 6 + k + 2] = gz / len;
    }
  }

  const indizes = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indizes.set([a, c, b, b, c, d], i * 6);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positionen, 3));
  geo.setAttribute('uv', new BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new BufferAttribute(normalen, 3));
  geo.setIndex(new BufferAttribute(indizes, 1));
  geo.computeBoundingSphere();
  return geo;
}

interface OffroadProps {
  terrain: Terraindaten;
  strecke: Streckendaten;
}

export function Offroad({ terrain, strecke }: OffroadProps) {
  const schotter = useMemo(() => macheSchotterTextur(), []);

  /** Drei Pisten, die kreuz und quer durchs Gelände führen. */
  const pisten = useMemo(
    () =>
      PISTEN_WEGE().map((w) => {
        const punkte = machePiste(terrain, w);
        return { punkte, geometrie: bauePistenGeometrie(terrain, punkte) };
      }),
    [terrain],
  );

  /** Sprungrampen aus Erde, verteilt neben den Pisten. */
  const rampen = useMemo(() => {
    const rnd = zufall(OFFROAD.keim);
    const liste: {
      x: number;
      y: number;
      z: number;
      gier: number;
      breite: number;
      laenge: number;
      hoehe: number;
    }[] = [];
    const alle = pisten.flatMap((p) => p.punkte);
    let versuche = 0;
    while (liste.length < OFFROAD.rampen && versuche < 600) {
      versuche++;
      const p = alle[Math.floor(rnd() * alle.length)];
      if (!p) break;
      if (steigungBei(terrain, p.x, p.z) > 0.22) continue;
      if (abstandZurStrecke(strecke, p.x, p.z).distanz < 40) continue;
      if (liste.some((r) => Math.hypot(r.x - p.x, r.z - p.z) < 90)) continue;
      liste.push({
        x: p.x,
        y: hoeheBei(terrain, p.x, p.z),
        z: p.z,
        gier: Math.atan2(p.rx, p.rz),
        breite: 7 + rnd() * 3,
        laenge: 9 + rnd() * 5,
        hoehe: 1.5 + rnd() * 1.1,
      });
    }
    return liste;
  }, [pisten, terrain, strecke]);

  /** Felsenfeld: große Blöcke zum Drüberklettern. */
  const felsenfeld = useMemo(() => {
    const rnd = zufall(OFFROAD.keim + 99);
    // Eine Stelle abseits der Straße suchen
    let mitte = { x: 0, z: 0 };
    let beste = -Infinity;
    for (let i = 0; i < 700; i++) {
      const x = (rnd() - 0.5) * (WELT.groesse - 240);
      const z = (rnd() - 0.5) * (WELT.groesse - 240);
      const d = abstandZurStrecke(strecke, x, z).distanz;
      if (d < 70) continue;
      const punktzahl = steigungBei(terrain, x, z) * 2 + d / 400;
      if (punktzahl > beste) {
        beste = punktzahl;
        mitte = { x, z };
      }
    }
    const bloecke: {
      x: number;
      y: number;
      z: number;
      gier: number;
      groesse: number;
      neigung: number;
    }[] = [];
    for (let i = 0; i < OFFROAD.felsbloecke; i++) {
      const winkel = rnd() * Math.PI * 2;
      const radius = Math.sqrt(rnd()) * 42;
      const x = mitte.x + Math.cos(winkel) * radius;
      const z = mitte.z + Math.sin(winkel) * radius;
      const groesse = 1.3 + rnd() * 2.6;
      bloecke.push({
        x,
        y: hoeheBei(terrain, x, z) + groesse * 0.28,
        z,
        gier: rnd() * Math.PI * 2,
        groesse,
        neigung: (rnd() - 0.5) * 0.5,
      });
    }
    return { mitte, bloecke };
  }, [terrain, strecke]);

  const felsMatrizen = useMemo(() => {
    const q = new Quaternion();
    return felsenfeld.bloecke.map((b) => {
      q.setFromEuler(new Euler(b.neigung, b.gier, b.neigung * 0.7));
      return new Matrix4().compose(
        new Vector3(b.x, b.y, b.z),
        q,
        new Vector3(b.groesse, b.groesse * 0.72, b.groesse * 1.15),
      );
    });
  }, [felsenfeld]);

  return (
    <>
      {/* ---------- Schotterpisten ---------- */}
      {pisten.map((p, i) => (
        <mesh key={i} geometry={p.geometrie} receiveShadow>
          <meshStandardMaterial
            map={schotter}
            roughness={1}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}

      {/* ---------- Sprungrampen ---------- */}
      {rampen.map((r, i) => (
        <group key={i} position={[r.x, r.y, r.z]} rotation={[0, r.gier, 0]}>
          {/*
            Die Rampe ist ein Keil: ein Quader, um die Querachse gekippt, so
            dass die Vorderkante im Boden steckt und die Hinterkante hoch steht.
            Der Kollisionskörper ist derselbe Keil – man fährt also wirklich
            hinauf und hebt am Ende ab.
          */}
          <mesh
            position={[0, r.hoehe / 2 - 0.35, 0]}
            rotation={[Math.atan2(r.hoehe, r.laenge), 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[r.breite, 0.7, Math.hypot(r.laenge, r.hoehe)]} />
            <meshStandardMaterial map={schotter} color="#a08560" roughness={1} />
          </mesh>
          <RigidBody type="fixed" colliders={false} friction={1}>
            <CuboidCollider
              args={[r.breite / 2, 0.35, Math.hypot(r.laenge, r.hoehe) / 2]}
              position={[r.x, r.y + r.hoehe / 2 - 0.35, r.z]}
              rotation={[Math.atan2(r.hoehe, r.laenge), r.gier, 0]}
            />
          </RigidBody>
        </group>
      ))}

      {/* ---------- Felsenfeld ---------- */}
      <instancedMesh
        args={[undefined, undefined, felsMatrizen.length]}
        castShadow
        receiveShadow
        ref={(mesh) => {
          if (!mesh) return;
          felsMatrizen.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8a8177" roughness={0.95} metalness={0.03} flatShading />
      </instancedMesh>

      {/* Kollision der großen Blöcke: nur ein Quader je Fels, das reicht */}
      <RigidBody type="fixed" colliders={false} friction={0.9}>
        {felsenfeld.bloecke.map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.groesse * 0.72, b.groesse * 0.52, b.groesse * 0.82]}
            position={[b.x, b.y, b.z]}
            rotation={[b.neigung, b.gier, b.neigung * 0.7]}
          />
        ))}
      </RigidBody>
    </>
  );
}
