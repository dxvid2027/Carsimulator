import { useMemo } from 'react';
import { HeightfieldCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from 'three';
import { WELT, ZELLE, type Terraindaten } from './heightmap';

/**
 * Anzahl Kacheln pro Kante. Das Terrain wird in einzelne Meshes zerlegt,
 * damit three.js Kacheln außerhalb des Sichtfelds überspringen kann
 * (Frustum Culling). Ein einziges großes Mesh wäre entweder ganz sichtbar
 * oder ganz unsichtbar – Culling würde also nichts bringen.
 */
const KACHELN = 4;

/**
 * Kantenlänge einer Detailtextur-Kachel in Metern.
 * Muss die Kachelgröße (groesse / KACHELN = 250 m) glatt teilen,
 * sonst entstehen sichtbare Nähte.
 */
const DETAIL_METER = 10;

/**
 * Boden-Detailtextur, im Code erzeugt (kein Download).
 *
 * Die Einfärbung über Vertex-Farben ist großflächig – aus der Nähe sähe der
 * Boden ohne diese Textur wie eine glatte grüne Fläche aus. Die Textur wird
 * mit der Vertex-Farbe multipliziert, deshalb liegen ihre Helligkeiten nahe
 * bei 1: Sie moduliert nur, statt eine eigene Farbe zu setzen.
 *
 * Sie wird auf mehreren Größenstufen aufgebaut – grobe Flecken für die
 * Struktur aus der Ferne, feine Halme für den Nahbereich. Eine einzige
 * Rauschstufe sieht immer nach Fernsehrauschen aus.
 *
 * Gleichzeitig entsteht eine passende Normal Map: Sie täuscht der Beleuchtung
 * kleine Unebenheiten vor, ohne dass dafür Dreiecke nötig wären. Erst dadurch
 * bekommt der Boden im Streiflicht Tiefe.
 */
function macheBodenTexturen() {
  const groesse = 512;
  const c = document.createElement('canvas');
  c.width = c.height = groesse;
  const ctx = c.getContext('2d')!;

  // Grundton
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(0, 0, groesse, groesse);

  /** Zeichnet einen Fleck neunmal, damit die Kachel nahtlos aneinanderpasst. */
  const umlaufend = (zeichne: (dx: number, dy: number) => void) => {
    for (const dx of [-groesse, 0, groesse]) {
      for (const dy of [-groesse, 0, groesse]) zeichne(dx, dy);
    }
  };

  // Grobe Flecken: Struktur, die man auch aus 50 m noch sieht
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    const r = 26 + Math.random() * 70;
    const x = Math.random() * groesse;
    const y = Math.random() * groesse;
    umlaufend((dx, dy) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Mittlere Büschel
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = Math.random() > 0.45 ? '#3a4a2a' : '#e8f0d8';
    const r = 5 + Math.random() * 15;
    const x = Math.random() * groesse;
    const y = Math.random() * groesse;
    umlaufend((dx, dy) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Feine Halme
  ctx.globalAlpha = 0.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const hell = Math.random() > 0.5;
    ctx.strokeStyle = hell ? 'rgba(232, 240, 212, 0.5)' : 'rgba(48, 60, 34, 0.5)';
    ctx.lineWidth = 0.7 + Math.random() * 1.1;
    const x = Math.random() * groesse;
    const y = Math.random() * groesse;
    const laenge = 3 + Math.random() * 8;
    const winkel = Math.random() * Math.PI * 2;
    umlaufend((dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + Math.cos(winkel) * laenge, y + dy + Math.sin(winkel) * laenge);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;

  const farbe = new CanvasTexture(c);
  farbe.wrapS = farbe.wrapT = RepeatWrapping;
  farbe.colorSpace = SRGBColorSpace;
  farbe.anisotropy = 8;

  /*
    Normal Map aus der Helligkeit der Farbtextur ableiten.

    Dunkle Stellen werden als Vertiefung gelesen, helle als Erhebung. Das ist
    physikalisch nicht exakt, sieht bei Gras und Erde aber überzeugend aus und
    kostet nichts, weil das Bild ohnehin schon da ist.
  */
  const quelle = ctx.getImageData(0, 0, groesse, groesse);
  const nc = document.createElement('canvas');
  nc.width = nc.height = groesse;
  const nctx = nc.getContext('2d')!;
  const ziel = nctx.createImageData(groesse, groesse);
  const hell = (x: number, y: number) => {
    const xi = ((x % groesse) + groesse) % groesse;
    const yi = ((y % groesse) + groesse) % groesse;
    return quelle.data[(yi * groesse + xi) * 4] / 255;
  };
  const staerke = 2.6;
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const dx = (hell(x + 1, y) - hell(x - 1, y)) * staerke;
      const dy = (hell(x, y + 1) - hell(x, y - 1)) * staerke;
      // Normale aus dem Gefälle, dann von -1..1 auf 0..255 bringen
      const laenge = Math.hypot(-dx, -dy, 1);
      const i = (y * groesse + x) * 4;
      ziel.data[i] = ((-dx / laenge) * 0.5 + 0.5) * 255;
      ziel.data[i + 1] = ((-dy / laenge) * 0.5 + 0.5) * 255;
      ziel.data[i + 2] = ((1 / laenge) * 0.5 + 0.5) * 255;
      ziel.data[i + 3] = 255;
    }
  }
  nctx.putImageData(ziel, 0, 0);
  const normal = new CanvasTexture(nc);
  normal.wrapS = normal.wrapT = RepeatWrapping;
  normal.anisotropy = 8;

  const kachelMeter = WELT.groesse / KACHELN;
  const wiederholungen = Math.round(kachelMeter / DETAIL_METER);
  farbe.repeat.set(wiederholungen, wiederholungen);
  normal.repeat.set(wiederholungen, wiederholungen);

  return { farbe, normal };
}

/** Farben nach Höhe und Steilheit. */
const FARBEN = {
  /** Feuchte Senken: dunkles, sattes Grün. */
  tal: new Color('#3d5228'),
  /** Wiese in mittlerer Lage. */
  wiese: new Color('#5a7034'),
  /** Trockeneres Gras an den Hängen. */
  hang: new Color('#7d7a48'),
  /** Nackter Fels an steilen Stellen. */
  fels: new Color('#6a6259'),
  /** Ausgeblichene Kuppen. */
  gipfel: new Color('#948a6c'),
  /** Erde, wo Gras nicht mehr wächst. */
  erde: new Color('#6b5439'),
};

/**
 * Baut die Geometrie einer Kachel.
 *
 * Der entscheidende Punkt: Die sichtbare Fläche muss exakt dieselben Höhen
 * benutzen wie der Kollisionskörper. Deshalb lesen wir die Höhe nicht neu aus
 * dem Noise, sondern greifen über die Weltposition jedes Eckpunkts direkt in
 * dasselbe Höhen-Array. Sonst würde das Auto sichtbar schweben oder einsinken.
 */
function baueKachel(daten: Terraindaten, kachelX: number, kachelZ: number) {
  const { hoehen, aufloesung, groesse, minHoehe, maxHoehe } = daten;
  const punkte = aufloesung + 1;
  const segmenteProKachel = aufloesung / KACHELN;
  const kachelGroesse = groesse / KACHELN;

  const geo = new PlaneGeometry(
    kachelGroesse,
    kachelGroesse,
    segmenteProKachel,
    segmenteProKachel,
  );
  // Die Ebene liegt zunächst senkrecht (XY). Drehen, damit sie flach liegt (XZ).
  geo.rotateX(-Math.PI / 2);

  // Mittelpunkt dieser Kachel in Weltkoordinaten
  const versatzX = (kachelX + 0.5) * kachelGroesse - groesse / 2;
  const versatzZ = (kachelZ + 0.5) * kachelGroesse - groesse / 2;

  const pos = geo.attributes.position as BufferAttribute;
  const farben = new Float32Array(pos.count * 3);
  const normalen = new Float32Array(pos.count * 3);
  const farbe = new Color();
  const spanne = Math.max(1, maxHoehe - minHoehe);

  /** Höhe an einem Gitterpunkt, am Rand wird der Randwert wiederholt. */
  const hoeheAn = (ix: number, iz: number) =>
    hoehen[
      Math.min(punkte - 1, Math.max(0, iz)) + Math.min(punkte - 1, Math.max(0, ix)) * punkte
    ];

  for (let i = 0; i < pos.count; i++) {
    const weltX = pos.getX(i) + versatzX;
    const weltZ = pos.getZ(i) + versatzZ;

    // Weltposition -> Gitterindex. Die Eckpunkte liegen exakt auf Gitterpunkten,
    // deshalb genügt Runden (kein Interpolieren nötig).
    const ix = Math.round((weltX / groesse + 0.5) * aufloesung);
    const iz = Math.round((weltZ / groesse + 0.5) * aufloesung);
    const ixK = Math.min(punkte - 1, Math.max(0, ix));
    const izK = Math.min(punkte - 1, Math.max(0, iz));

    const h = hoeheAn(ixK, izK);
    pos.setY(i, h);

    // ----- Normale direkt aus der Heightmap -----
    /*
      Wichtig: NICHT geo.computeVertexNormals() benutzen!
      Das mittelt nur über die Dreiecke der jeweiligen Kachel. Ein Punkt auf
      der Kachelkante bekäme dadurch von links und rechts unterschiedliche
      Normalen – und man sieht ein Gitternetz aus Lichtkanten im Boden.

      Hier lesen wir die Nachbarhöhen aus dem GEMEINSAMEN Höhen-Array, das über
      alle Kacheln hinweg gilt. Dadurch ist die Normale an der Kante von beiden
      Seiten identisch und die Kachelgrenzen verschwinden.
    */
    const links = hoeheAn(ixK - 1, izK);
    const rechts = hoeheAn(ixK + 1, izK);
    const vorne = hoeheAn(ixK, izK - 1);
    const hinten = hoeheAn(ixK, izK + 1);

    const nx = -(rechts - links) / (2 * ZELLE);
    const nz = -(hinten - vorne) / (2 * ZELLE);
    const laenge = Math.hypot(nx, 1, nz);
    normalen[i * 3] = nx / laenge;
    normalen[i * 3 + 1] = 1 / laenge;
    normalen[i * 3 + 2] = nz / laenge;

    // ----- Einfärbung nach Höhe und Steilheit -----
    const neigung = Math.hypot(rechts - links, hinten - vorne) / (2 * ZELLE);
    const steil = Math.min(1, neigung / 1.1);

    const hoehenAnteil = (h - minHoehe) / spanne;

    if (hoehenAnteil < 0.42) {
      farbe.copy(FARBEN.tal).lerp(FARBEN.wiese, hoehenAnteil / 0.42);
    } else if (hoehenAnteil < 0.72) {
      farbe.copy(FARBEN.wiese).lerp(FARBEN.hang, (hoehenAnteil - 0.42) / 0.3);
    } else {
      farbe.copy(FARBEN.hang).lerp(FARBEN.gipfel, (hoehenAnteil - 0.72) / 0.28);
    }
    /*
      Steilere Stellen: erst wird das Gras dünner und die Erde kommt durch,
      ganz steil steht nackter Fels. Der Zwischenschritt über die Erdfarbe ist
      der Unterschied zwischen "grün mit grauen Flecken" und einer Landschaft,
      die man glaubt.
    */
    if (steil < 0.5) {
      farbe.lerp(FARBEN.erde, (steil / 0.5) * 0.55);
    } else {
      farbe.copy(farbe).lerp(FARBEN.erde, 0.55).lerp(FARBEN.fels, (steil - 0.5) / 0.5);
    }

    farben[i * 3] = farbe.r;
    farben[i * 3 + 1] = farbe.g;
    farben[i * 3 + 2] = farbe.b;
  }

  geo.setAttribute('color', new BufferAttribute(farben, 3));
  geo.setAttribute('normal', new BufferAttribute(normalen, 3));
  geo.computeBoundingSphere();

  return { geo, versatzX, versatzZ };
}

interface TerrainProps {
  daten: Terraindaten;
}

export function Terrain({ daten }: TerrainProps) {
  const detail = useMemo(() => macheBodenTexturen(), []);
  /** Einmal erzeugen – three.js erwartet hier einen Vector2. */
  const normalStaerke = useMemo(() => new Vector2(0.85, 0.85), []);

  const kacheln = useMemo(() => {
    const liste: { geo: PlaneGeometry; versatzX: number; versatzZ: number; key: string }[] = [];
    for (let kx = 0; kx < KACHELN; kx++) {
      for (let kz = 0; kz < KACHELN; kz++) {
        const { geo, versatzX, versatzZ } = baueKachel(daten, kx, kz);
        liste.push({ geo, versatzX, versatzZ, key: `${kx}-${kz}` });
      }
    }
    return liste;
  }, [daten]);

  return (
    <RigidBody type="fixed" friction={1.1} colliders={false}>
      {/*
        Der Kollisionskörper: ein einziges Heightfield über das ganze Terrain.
        scale.y = 1, weil in `hoehen` bereits echte Meter stehen.

        Der Cast ist nötig, weil @react-three/rapier hier `number[]` als Typ
        angibt. Rapier selbst erwartet aber ein Float32Array und verarbeitet es
        auch so – ein echtes Array wäre nur unnötig groß (66.000 Zahlen).
      */}
      <HeightfieldCollider
        args={[
          daten.aufloesung,
          daten.aufloesung,
          daten.hoehen as unknown as number[],
          { x: WELT.groesse, y: 1, z: WELT.groesse },
        ]}
      />

      {kacheln.map(({ geo, versatzX, versatzZ, key }) => (
        <mesh
          key={key}
          geometry={geo}
          position={[versatzX, 0, versatzZ]}
          receiveShadow
          /*
            Das Terrain wirft bewusst KEINE Schatten.
            Der Schattenbereich der Sonne ist nur ca. 110 m groß und wandert mit
            dem Auto mit. Würde sich das Terrain selbst beschatten, sähe man
            genau an dieser Grenze eine rechteckige Kante im Boden.
            Der Wagenschatten (der wichtige) bleibt erhalten, und es spart
            zusätzlich Rechenzeit. Richtige Geländeschatten kommen später mit
            Cascaded Shadow Maps.
          */
          castShadow={false}
        >
          <meshStandardMaterial
            map={detail.farbe}
            normalMap={detail.normal}
            // Stärke der vorgetäuschten Unebenheiten
            normalScale={normalStaerke}
            vertexColors
            roughness={0.98}
            metalness={0}
          />
        </mesh>
      ))}
    </RigidBody>
  );
}
