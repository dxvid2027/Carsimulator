import { useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { STRECKE, type Streckendaten } from './strecke';
import { hoeheBei, type Terraindaten } from './heightmap';

/** Länge einer Texturkachel entlang der Fahrbahn in Metern. */
const TEXTUR_LAENGE = 16;

/**
 * Asphalt-Textur im Code erzeugt: dunkler Belag, durchgezogene Randlinien,
 * gestrichelte Mittellinie. Die Linien sind Teil der Textur statt eigener
 * Geometrie – das spart Dreiecke und sieht bei Tempo genauso gut aus.
 *
 * Die Textur wird quer (u) über die Fahrbahnbreite und längs (v) alle
 * TEXTUR_LAENGE Meter wiederholt.
 */
function macheAsphaltTextur() {
  const breite = 256; // entspricht der Fahrbahnbreite
  const laenge = 512; // entspricht TEXTUR_LAENGE Metern
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = laenge;
  const ctx = c.getContext('2d')!;

  // Grundfarbe
  ctx.fillStyle = '#3a3b3e';
  ctx.fillRect(0, 0, breite, laenge);

  // Körnung des Belags
  const bild = ctx.getImageData(0, 0, breite, laenge);
  for (let i = 0; i < breite * laenge; i++) {
    const rauschen = (Math.random() - 0.5) * 26;
    bild.data[i * 4] = Math.max(0, Math.min(255, bild.data[i * 4] + rauschen));
    bild.data[i * 4 + 1] = Math.max(0, Math.min(255, bild.data[i * 4 + 1] + rauschen));
    bild.data[i * 4 + 2] = Math.max(0, Math.min(255, bild.data[i * 4 + 2] + rauschen));
  }
  ctx.putImageData(bild, 0, 0);

  // Etwas Verfärbung, damit der Belag nicht wie eine graue Fläche wirkt
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#8a8d92';
    ctx.beginPath();
    const r = 12 + Math.random() * 45;
    const x = Math.random() * breite;
    const y = Math.random() * laenge;
    // umlaufend zeichnen, damit die Kacheln nahtlos aneinanderpassen
    for (const dy of [-laenge, 0, laenge]) {
      ctx.beginPath();
      ctx.arc(x, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Randlinien (durchgezogen)
  ctx.fillStyle = '#e8e6df';
  const randBreite = breite * 0.022;
  const randAbstand = breite * 0.055;
  ctx.fillRect(randAbstand, 0, randBreite, laenge);
  ctx.fillRect(breite - randAbstand - randBreite, 0, randBreite, laenge);

  // Mittellinie (gestrichelt): 6 m Strich, 6 m Lücke bei 16 m Kachellänge
  const strichBreite = breite * 0.02;
  const x0 = breite / 2 - strichBreite / 2;
  const strich = (laenge / TEXTUR_LAENGE) * 4; // 4 m Strich
  const luecke = (laenge / TEXTUR_LAENGE) * 4; // 4 m Lücke
  for (let y = 0; y < laenge; y += strich + luecke) {
    ctx.fillRect(x0, y, strichBreite, Math.min(strich, laenge - y));
  }

  const tex = new CanvasTexture(c);
  // Nur längs wiederholen; quer soll die Textur genau einmal passen
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

interface RoadProps {
  strecke: Streckendaten;
  terrain: Terraindaten;
  /** Geschlossener Rundkurs (Ende trifft Anfang) oder offene Straße? */
  geschlossen?: boolean;
  /** Breite abweichend vom Rundkurs, z. B. für schmalere Nebenstraßen. */
  breite?: number;
}

/**
 * Das sichtbare Straßenband.
 *
 * Es braucht bewusst KEINEN eigenen Kollisionskörper: Das Terrain wurde
 * entlang der Strecke eingeschnitten (siehe strecke.ts), das Auto fährt also
 * schon auf der richtigen Höhe. Ein zweiter Kollisionskörper würde nur
 * Rechenzeit kosten und könnte an den Rändern haken.
 *
 * Damit das Band nicht im Boden verschwindet oder darüber schwebt, wird seine
 * Höhe an jedem Punkt direkt aus der Heightmap gelesen und um wenige
 * Zentimeter angehoben.
 */
export function Road({ strecke, terrain, geschlossen = true, breite }: RoadProps) {
  const textur = useMemo(() => macheAsphaltTextur(), []);

  const geometrie = useMemo(() => {
    const punkte = strecke.punkte;
    const n = punkte.length;
    const halb = (breite ?? STRECKE.breite) / 2;

    /*
      Der Kurs ist geschlossen: Nach dem letzten Querschnitt kommt wieder der
      erste. Die Texturkoordinate muss dort also von einer GANZEN Zahl auf 0
      springen, sonst wird die Textur im Schlussstück gestaucht – sichtbar als
      durchgezogener Strich statt gestrichelter Mittellinie genau an der
      Start-/Ziellinie.

      Dafür strecken wir die Kachellänge minimal, bis die Gesamtlänge glatt
      aufgeht. Aus 16,00 m werden z. B. 16,04 m – das sieht niemand.
      Die 0,5 im Nenner sorgen dafür, dass wir korrekt runden.
    */
    const kacheln = Math.max(1, Math.round(strecke.laenge / TEXTUR_LAENGE));
    // Nur beim geschlossenen Kurs muss die Länge glatt aufgehen
    const kachelLaenge = geschlossen ? strecke.laenge / kacheln : TEXTUR_LAENGE;

    // Pro Stützpunkt zwei Eckpunkte (links und rechts). Ring schließen:
    // der letzte Querschnitt wird mit dem ersten verbunden.
    const positionen = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const normalen = new Float32Array(n * 2 * 3);

    for (let i = 0; i < n; i++) {
      const p = punkte[i];
      // Quer zur Fahrtrichtung
      const nx = -p.rz;
      const nz = p.rx;

      const lx = p.x + nx * halb;
      const lz = p.z + nz * halb;
      const rx = p.x - nx * halb;
      const rz = p.z - nz * halb;

      // Höhe vom Terrain ablesen -> Straße liegt garantiert auf dem Boden
      const ly = hoeheBei(terrain, lx, lz) + STRECKE.ueberhoehung;
      const ry = hoeheBei(terrain, rx, rz) + STRECKE.ueberhoehung;

      positionen[i * 6] = lx;
      positionen[i * 6 + 1] = ly;
      positionen[i * 6 + 2] = lz;
      positionen[i * 6 + 3] = rx;
      positionen[i * 6 + 4] = ry;
      positionen[i * 6 + 5] = rz;

      const v = p.distanz / kachelLaenge;
      uvs[i * 4] = 0;
      uvs[i * 4 + 1] = v;
      uvs[i * 4 + 2] = 1;
      uvs[i * 4 + 3] = v;

      // Normale aus dem Terrain: Straße und Boden werden gleich beleuchtet
      const d = 1.5;
      const hL = hoeheBei(terrain, p.x - d, p.z);
      const hR = hoeheBei(terrain, p.x + d, p.z);
      const hV = hoeheBei(terrain, p.x, p.z - d);
      const hH = hoeheBei(terrain, p.x, p.z + d);
      const gx = -(hR - hL) / (2 * d);
      const gz = -(hH - hV) / (2 * d);
      const len = Math.hypot(gx, 1, gz);
      for (const k of [0, 3]) {
        normalen[i * 6 + k] = gx / len;
        normalen[i * 6 + k + 1] = 1 / len;
        normalen[i * 6 + k + 2] = gz / len;
      }
    }

    // Dreiecke: je Abschnitt zwei. Beim Rundkurs schließt der letzte den Ring.
    const abschnitte = geschlossen ? n : n - 1;
    const indizes = new Uint32Array(abschnitte * 6);
    for (let i = 0; i < abschnitte; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const naechster = ((i + 1) % n) * 2;
      const c = naechster;
      const d = naechster + 1;

      indizes[i * 6] = a;
      indizes[i * 6 + 1] = c;
      indizes[i * 6 + 2] = b;
      indizes[i * 6 + 3] = b;
      indizes[i * 6 + 4] = c;
      indizes[i * 6 + 5] = d;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positionen, 3));
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new BufferAttribute(normalen, 3));
    geo.setIndex(new BufferAttribute(indizes, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [strecke, terrain, geschlossen, breite]);

  return (
    <mesh geometry={geometrie} receiveShadow>
      <meshStandardMaterial
        map={textur}
        roughness={0.72}
        metalness={0.02}
        // Verhindert Z-Fighting mit dem Terrain darunter
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}
