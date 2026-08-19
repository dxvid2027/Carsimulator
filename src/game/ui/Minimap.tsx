import { useEffect, useMemo, useRef } from 'react';
import { telemetrie } from '../telemetrie';
import { rennen } from '../race/rennen';
import { WELT, hoeheBei, type Terraindaten } from '../world/heightmap';
import { STRECKE, type Streckendaten } from '../world/strecke';
import { planeHaufen } from '../world/Heuballen';

/**
 * Karte – klein oben rechts oder groß über dem ganzen Bild (Taste M).
 *
 * Gezeichnet wird auf ein 2D-Canvas, nicht in 3D. Eine zweite 3D-Ansicht
 * würde die ganze Welt ein zweites Mal rendern und die Bildrate halbieren –
 * ein paar hundert Linien auf einem Canvas kosten dagegen fast nichts.
 *
 * Der Geländehintergrund wird EINMAL in ein kleines Zwischen-Canvas gemalt und
 * danach nur noch skaliert kopiert. Ihn jeden Frame neu zu zeichnen wäre bei
 * 257 × 257 Höhenwerten viel zu teuer.
 */

/** Kantenlänge der kleinen Karte in Bildpunkten. */
const KLEIN = 168;
/** Ausschnitt der kleinen Karte in Metern (kleiner = stärker gezoomt). */
const KLEIN_SICHT = 320;
/** Auflösung des vorgerenderten Geländebildes. */
const GELAENDE_PIXEL = 192;

interface MinimapProps {
  strecke: Streckendaten;
  /** Die offenen Nebenstraßen – werden schmaler und ohne Mittellinie gezeichnet. */
  nebenstrassen?: Streckendaten[];
  terrain: Terraindaten;
  /** Große Ansicht über dem ganzen Bild? */
  gross: boolean;
  /** Wird beim Klick auf die große Karte aufgerufen (zum Schließen). */
  onSchliessen?: () => void;
}

/** Malt das Gelände einmal in ein eigenes Canvas: grün in den Tälern, hell auf den Kuppen. */
function macheGelaendeBild(terrain: Terraindaten) {
  const c = document.createElement('canvas');
  c.width = c.height = GELAENDE_PIXEL;
  const ctx = c.getContext('2d')!;
  const bild = ctx.createImageData(GELAENDE_PIXEL, GELAENDE_PIXEL);
  const spanne = Math.max(1, terrain.maxHoehe - terrain.minHoehe);

  for (let py = 0; py < GELAENDE_PIXEL; py++) {
    for (let px = 0; px < GELAENDE_PIXEL; px++) {
      /*
        Bildpunkt -> Weltkoordinate.
        Die Karte zeigt +X nach links und +Z nach oben (wie die Sicht im Spiel),
        deshalb werden beide Achsen gespiegelt.
      */
      const wx = (0.5 - px / (GELAENDE_PIXEL - 1)) * WELT.groesse;
      const wz = (0.5 - py / (GELAENDE_PIXEL - 1)) * WELT.groesse;
      const h = hoeheBei(terrain, wx, wz);
      const t = (h - terrain.minHoehe) / spanne;

      // Von dunklem Talgrün über Wiesengrün zu hellem Kuppenton
      const r = 44 + t * 96;
      const g = 74 + t * 74;
      const b = 40 + t * 58;
      const i = (py * GELAENDE_PIXEL + px) * 4;
      bild.data[i] = r;
      bild.data[i + 1] = g;
      bild.data[i + 2] = b;
      bild.data[i + 3] = 255;
    }
  }
  ctx.putImageData(bild, 0, 0);
  return c;
}

export function Minimap({ strecke, nebenstrassen = [], terrain, gross, onSchliessen }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gelaende = useMemo(() => macheGelaendeBild(terrain), [terrain]);

  /** Streckenpunkte ausdünnen – 1082 Punkte sind zum Zeichnen zu viel. */
  const linie = useMemo(() => {
    const schritt = Math.max(1, Math.floor(strecke.punkte.length / 200));
    const liste: { x: number; z: number }[] = [];
    for (let i = 0; i < strecke.punkte.length; i += schritt) {
      liste.push({ x: strecke.punkte[i].x, z: strecke.punkte[i].z });
    }
    return liste;
  }, [strecke]);

  /** Dieselbe Ausdünnung für die Nebenstraßen. */
  const nebenLinien = useMemo(
    () =>
      nebenstrassen.map((n) => {
        const schritt = Math.max(1, Math.floor(n.punkte.length / 120));
        const liste: { x: number; z: number }[] = [];
        for (let i = 0; i < n.punkte.length; i += schritt) {
          liste.push({ x: n.punkte[i].x, z: n.punkte[i].z });
        }
        // Endpunkt nicht verlieren
        const letzter = n.punkte[n.punkte.length - 1];
        liste.push({ x: letzter.x, z: letzter.z });
        return liste;
      }),
    [nebenstrassen],
  );

  /** Mittelpunkte der Heuballen-Haufen, damit man sie ansteuern kann. */
  const heuHaufen = useMemo(() => {
    const ballen = planeHaufen(terrain, strecke);
    const gruppen: { x: number; z: number }[] = [];
    for (const b of ballen) {
      const nah = gruppen.find((g) => Math.hypot(g.x - b.x, g.z - b.z) < 12);
      if (!nah) gruppen.push({ x: b.x, z: b.z });
    }
    return gruppen;
  }, [terrain, strecke]);

  const groesse = gross ? Math.min(window.innerWidth, window.innerHeight) * 0.82 : KLEIN;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = groesse * dpr;
    canvas.height = groesse * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let id = 0;
    const mitte = groesse / 2;

    const tick = () => {
      const auto = telemetrie.position;

      // Groß: ganze Welt. Klein: Ausschnitt um das Auto.
      const sichtweite = gross ? WELT.groesse : KLEIN_SICHT;
      const massstab = groesse / sichtweite;
      const zentrumX = gross ? 0 : auto.x;
      const zentrumZ = gross ? 0 : auto.z;
      const kx = (wx: number) => mitte - (wx - zentrumX) * massstab;
      const kz = (wz: number) => mitte - (wz - zentrumZ) * massstab;

      ctx.clearRect(0, 0, groesse, groesse);

      // ----- Geländehintergrund -----
      const weltGroesseAufKarte = WELT.groesse * massstab;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        gelaende,
        kx(WELT.groesse / 2),
        kz(WELT.groesse / 2),
        weltGroesseAufKarte,
        weltGroesseAufKarte,
      );
      ctx.restore();

      // Außerhalb der Welt abdunkeln
      ctx.fillStyle = 'rgba(8, 12, 17, 0.86)';
      const l = kx(WELT.groesse / 2);
      const o = kz(WELT.groesse / 2);
      ctx.fillRect(0, 0, groesse, Math.max(0, o));
      ctx.fillRect(0, o + weltGroesseAufKarte, groesse, groesse);
      ctx.fillRect(0, Math.max(0, o), Math.max(0, l), weltGroesseAufKarte);
      ctx.fillRect(l + weltGroesseAufKarte, Math.max(0, o), groesse, weltGroesseAufKarte);

      // ----- Straße: erst breit dunkel, dann heller Kern -----
      const zeichneLinie = (
        punkte: { x: number; z: number }[],
        breite: number,
        farbe: string,
        schliessen: boolean,
      ) => {
        ctx.strokeStyle = farbe;
        ctx.lineWidth = breite;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        punkte.forEach((p, i) => {
          const x = kx(p.x);
          const y = kz(p.z);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (schliessen) ctx.closePath();
        ctx.stroke();
      };

      // Nebenstraßen zuerst, damit der Rundkurs oben liegt
      const nebenBreite = Math.max(2, STRECKE.breite * 0.7 * massstab);
      for (const n of nebenLinien) {
        zeichneLinie(n, nebenBreite + 2, 'rgba(24, 30, 38, 0.8)', false);
        zeichneLinie(n, nebenBreite, '#5d646e', false);
      }

      const strassenBreite = Math.max(3, STRECKE.breite * massstab);
      zeichneLinie(linie, strassenBreite + 2.5, 'rgba(24, 30, 38, 0.9)', true);
      zeichneLinie(linie, strassenBreite, '#7c8692', true);
      zeichneLinie(linie, Math.max(1, strassenBreite * 0.16), 'rgba(255, 255, 255, 0.8)', true);

      // ----- Heuballen-Haufen -----
      ctx.fillStyle = '#e0bd63';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      for (const h of heuHaufen) {
        ctx.beginPath();
        ctx.arc(kx(h.x), kz(h.z), gross ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // ----- Renn-Tor bzw. nächster Kontrollpunkt -----
      const imRennen = rennen.phase === 'laeuft' || rennen.phase === 'countdown';
      const ziel = imRennen
        ? rennen.checkpoints[rennen.naechsterCheckpoint]
        : rennen.checkpoints[0];
      if (ziel) {
        const r = gross ? 8 : 6;
        const takt = (Math.sin(performance.now() / 400) + 1) / 2;
        ctx.beginPath();
        ctx.arc(kx(ziel.x), kz(ziel.z), r + takt * 3, 0, Math.PI * 2);
        ctx.fillStyle = imRennen ? 'rgba(255, 179, 0, 0.28)' : 'rgba(79, 195, 247, 0.28)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(kx(ziel.x), kz(ziel.z), r * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = imRennen ? '#ffb300' : '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // ----- Das Auto -----
      ctx.save();
      ctx.translate(kx(auto.x), kz(auto.z));
      ctx.rotate(telemetrie.richtung);
      const s = gross ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.lineTo(5.6 * s, 6.5 * s);
      ctx.lineTo(0, 3.6 * s);
      ctx.lineTo(-5.6 * s, 6.5 * s);
      ctx.closePath();
      ctx.fillStyle = '#ff5a3c';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [gross, groesse, gelaende, linie, nebenLinien, heuHaufen]);

  if (gross) {
    return (
      <div className="karte-gross" onClick={onSchliessen}>
        <div className="karte-gross-rahmen">
          <canvas ref={canvasRef} style={{ width: groesse, height: groesse }} />
          <div className="karte-legende">
            <span><i className="punkt strasse" /> Road</span>
            <span><i className="punkt tor" /> Race gate</span>
            <span><i className="punkt heu" /> Hay bales</span>
            <span><i className="punkt auto" /> You</span>
          </div>
          <div className="karte-hinweis">M or click to close</div>
        </div>
      </div>
    );
  }

  return (
    <div className="minimap">
      <canvas ref={canvasRef} style={{ width: groesse, height: groesse }} />
      <div className="minimap-norden">N</div>
      <div className="minimap-taste">M</div>
    </div>
  );
}
