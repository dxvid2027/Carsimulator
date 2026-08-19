import { useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { STRECKE, abstandZurStrecke, type Streckendaten } from './strecke';
import { hoeheBei, steigungBei, type Terraindaten } from './heightmap';

/**
 * Heuballen-Haufen neben der Strecke.
 *
 * Sie liegen bewusst in Gruppen, nicht einzeln: mehrere Ballen nebeneinander
 * und ein bis zwei obendrauf, wie auf einem Feld gestapelt. Da kann man
 * hineinfahren und sie auseinandertreiben.
 *
 * Die Ballen sind DYNAMISCHE Körper, keine festen Hindernisse – sie sollen ja
 * wegfliegen. Damit sie nicht dauerhaft Rechenzeit kosten, dürfen sie
 * einschlafen (`canSleep`): Solange sie ruhig liegen, rechnet die Physik sie
 * gar nicht mit und weckt sie erst bei einer Berührung wieder auf.
 */

export const HAUFEN = {
  /** Anzahl der Haufen entlang der Strecke. */
  anzahl: 14,
  /** Ballen je Haufen (untere Reihe). */
  proReiheMin: 3,
  proReiheMax: 5,
  /** Radius eines Ballens. */
  radius: 0.72,
  /** Länge eines Ballens (er liegt quer). */
  laenge: 1.25,
  /**
   * Masse in kg. Ein echter Rundballen wiegt eher 300 kg – hier bewusst
   * leichter, sonst bremst ein Haufen das Auto von 68 auf 5 km/h ab und
   * fühlt sich an wie eine Mauer. Mit 170 kg fliegen sie auseinander und
   * man kommt hindurch.
   */
  masse: 170,
  /** Abstand der Haufen von der Fahrbahnmitte. */
  abstandStrasse: STRECKE.breite / 2 + 2.6,
  /** Zufallskeim, damit die Haufen immer gleich liegen. */
  keim: 8123,
} as const;

function zufall(keim: number) {
  let a = keim >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Strohtextur im Code erzeugt: viele feine helle Striche auf gelbbraunem Grund.
 * Ohne Textur sähen die Ballen wie glatte gelbe Tonnen aus.
 */
function macheStrohTextur() {
  const groesse = 256;
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c8a955';
  ctx.fillRect(0, 0, groesse, groesse);

  // Halme: kurze Striche in leicht wechselnden Gelbtönen
  for (let i = 0; i < 2600; i++) {
    const helligkeit = 130 + Math.random() * 110;
    ctx.strokeStyle = `rgb(${helligkeit}, ${helligkeit * 0.82}, ${helligkeit * 0.44})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    const x = Math.random() * groesse;
    const y = Math.random() * groesse;
    // überwiegend waagerecht – so ist Stroh um den Ballen gewickelt
    const laenge = 6 + Math.random() * 22;
    const neigung = (Math.random() - 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + laenge, y + laenge * neigung);
    ctx.stroke();
  }

  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface Ballen {
  x: number;
  y: number;
  z: number;
  /** Drehung um die Hochachse. */
  gier: number;
  /** Leichte Größenstreuung. */
  groesse: number;
}

export function planeHaufen(terrain: Terraindaten, strecke: Streckendaten): Ballen[] {
  const rnd = zufall(HAUFEN.keim);
  const ballen: Ballen[] = [];
  const schritt = strecke.punkte.length / HAUFEN.anzahl;

  for (let h = 0; h < HAUFEN.anzahl; h++) {
    // Gleichmäßig verteilt, aber leicht verwürfelt
    const index = Math.floor((h + 0.25 + rnd() * 0.5) * schritt) % strecke.punkte.length;
    const p = strecke.punkte[index];
    const seite = rnd() > 0.5 ? 1 : -1;

    // Quer zur Fahrbahn nach außen
    const nx = -p.rz * seite;
    const nz = p.rx * seite;
    const basisX = p.x + nx * HAUFEN.abstandStrasse;
    const basisZ = p.z + nz * HAUFEN.abstandStrasse;

    // Auf einem Hang würde der Stapel sofort wegrollen
    if (steigungBei(terrain, basisX, basisZ) > 0.2) continue;
    // Nicht direkt in die Startzone bauen
    if (abstandZurStrecke(strecke, basisX, basisZ).distanz < STRECKE.breite / 2 + 1) continue;

    const proReihe =
      HAUFEN.proReiheMin +
      Math.floor(rnd() * (HAUFEN.proReiheMax - HAUFEN.proReiheMin + 1));
    // Ausrichtung des Stapels: längs zur Fahrbahn
    const gier = Math.atan2(p.rx, p.rz);
    const quer = { x: nx, z: nz };
    const laengs = { x: p.rx, z: p.rz };

    const untenY = hoeheBei(terrain, basisX, basisZ);

    // Untere Reihe nebeneinander
    for (let i = 0; i < proReihe; i++) {
      const versatz = (i - (proReihe - 1) / 2) * (HAUFEN.radius * 2 + 0.06);
      const x = basisX + laengs.x * versatz;
      const z = basisZ + laengs.z * versatz;
      ballen.push({
        x,
        y: hoeheBei(terrain, x, z) + HAUFEN.radius,
        z,
        gier,
        groesse: 0.94 + rnd() * 0.12,
      });
    }

    // Obere Reihe in die Lücken, eine weniger
    const obereAnzahl = Math.max(1, proReihe - 1);
    for (let i = 0; i < obereAnzahl; i++) {
      const versatz = (i - (obereAnzahl - 1) / 2) * (HAUFEN.radius * 2 + 0.06);
      const x = basisX + laengs.x * versatz + quer.x * 0.05;
      const z = basisZ + laengs.z * versatz + quer.z * 0.05;
      ballen.push({
        x,
        y: untenY + HAUFEN.radius * 2 + HAUFEN.radius * 0.72,
        z,
        gier,
        groesse: 0.94 + rnd() * 0.12,
      });
    }

    // Auf großen Haufen noch einer ganz oben
    if (proReihe >= 4) {
      ballen.push({
        x: basisX,
        y: untenY + HAUFEN.radius * 4.1,
        z: basisZ,
        gier,
        groesse: 0.94 + rnd() * 0.12,
      });
    }
  }
  return ballen;
}

interface HeuballenProps {
  terrain: Terraindaten;
  strecke: Streckendaten;
}

export function Heuballen({ terrain, strecke }: HeuballenProps) {
  const textur = useMemo(() => macheStrohTextur(), []);
  const ballen = useMemo(() => planeHaufen(terrain, strecke), [terrain, strecke]);

  return (
    <>
      {ballen.map((b, i) => (
        <RigidBody
          key={i}
          type="dynamic"
          colliders={false}
          position={[b.x, b.y, b.z]}
          rotation={[0, b.gier, Math.PI / 2]}
          mass={HAUFEN.masse}
          // Ballen rollen und rutschen, prallen aber kaum zurück
          friction={0.85}
          restitution={0.06}
          linearDamping={0.35}
          angularDamping={0.7}
          canSleep
        >
          {/*
            Der Zylinder liegt quer: Die Gruppe ist um Z gedreht, dadurch zeigt
            die Zylinderachse (normal Y) waagerecht – wie ein Rundballen,
            der auf dem Feld liegt.
          */}
          <CylinderCollider args={[(HAUFEN.laenge / 2) * b.groesse, HAUFEN.radius * b.groesse]} />
          <mesh castShadow receiveShadow scale={b.groesse}>
            <cylinderGeometry args={[HAUFEN.radius, HAUFEN.radius, HAUFEN.laenge, 16]} />
            <meshStandardMaterial map={textur} color="#d8bb72" roughness={0.98} metalness={0} />
          </mesh>
          {/* Stirnseiten etwas dunkler, damit die Rundung ablesbar ist */}
          {[HAUFEN.laenge / 2 + 0.01, -HAUFEN.laenge / 2 - 0.01].map((y) => (
            <mesh key={y} position={[0, y * b.groesse, 0]} scale={b.groesse}>
              <cylinderGeometry args={[HAUFEN.radius * 0.99, HAUFEN.radius * 0.99, 0.02, 16]} />
              <meshStandardMaterial color="#b89a52" roughness={1} />
            </mesh>
          ))}
        </RigidBody>
      ))}
    </>
  );
}
