import { useEffect, useRef } from 'react';
import { telemetrie } from '../telemetrie';
import { rennen } from '../race/rennen';
import { WELT } from '../world/heightmap';
import type { Streckendaten } from '../world/strecke';

/**
 * Minikarte oben rechts.
 *
 * Gezeichnet wird auf ein 2D-Canvas, nicht in 3D. Eine zweite 3D-Ansicht
 * würde die ganze Welt ein zweites Mal rendern und die Bildrate halbieren –
 * ein paar Linien auf einem kleinen Canvas kosten dagegen praktisch nichts.
 *
 * Die Karte dreht sich NICHT mit dem Auto. Eine feste Nordausrichtung ist
 * leichter zu lesen: Man erkennt wieder, wo man schon war. Stattdessen dreht
 * sich der Pfeil in der Mitte.
 */

/** Kantenlänge der Karte in Bildpunkten. */
const GROESSE = 152;
/**
 * Die Karte zeigt immer die ganze Welt, nicht nur einen Ausschnitt.
 *
 * Für eine offene Welt ist das die nützlichere Darstellung: Man sieht auf
 * einen Blick, wo man ist, wo die Strecke verläuft und wo das Renn-Tor liegt.
 * Ein mitwandernder Ausschnitt wäre zwar detaillierter, aber man verliert
 * dabei ständig die Orientierung.
 */
const WELTRAND = 40; // Bildpunkte Rand um die Weltkarte herum

interface MinimapProps {
  strecke: Streckendaten;
}

export function Minimap({ strecke }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Streckenpunkte einmal ausdünnen – 1082 Punkte sind zum Zeichnen zu viel. */
  const linie = useRef<{ x: number; z: number }[]>([]);
  if (linie.current.length === 0) {
    const schritt = Math.max(1, Math.floor(strecke.punkte.length / 160));
    for (let i = 0; i < strecke.punkte.length; i += schritt) {
      linie.current.push({ x: strecke.punkte[i].x, z: strecke.punkte[i].z });
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = GROESSE * dpr;
    canvas.height = GROESSE * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    let id = 0;
    const mitte = GROESSE / 2;
    /** Meter -> Bildpunkte, so dass die ganze Welt aufs Kärtchen passt. */
    const massstab = (GROESSE - WELTRAND) / WELT.groesse;

    /**
     * Weltkoordinaten in Kartenkoordinaten.
     * Der Bildschirm wächst nach rechts (+x) und nach unten (+y).
     * In der Welt ist +X links und +Z vorwärts – deshalb wird X gespiegelt
     * und Z nach oben gezeichnet, damit die Karte zur Sicht passt.
     */
    const kx = (wx: number) => mitte - wx * massstab;
    const kz = (wz: number) => mitte - wz * massstab;

    const tick = () => {
      const auto = telemetrie.position;

      ctx.clearRect(0, 0, GROESSE, GROESSE);

      // Hintergrund
      ctx.fillStyle = 'rgba(12, 18, 26, 0.72)';
      ctx.fillRect(0, 0, GROESSE, GROESSE);

      // Kartenrand der Welt (damit man merkt, wo die Karte endet)
      const rand = WELT.groesse / 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(kx(-rand), kz(rand), rand * 2 * massstab, rand * 2 * massstab);

      // Strecke
      ctx.strokeStyle = 'rgba(214, 226, 236, 0.9)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      linie.current.forEach((p, i) => {
        const x = kx(p.x);
        const y = kz(p.z);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      // Startzone bzw. nächster Kontrollpunkt
      const imRennen = rennen.phase === 'laeuft' || rennen.phase === 'countdown';
      const ziel = imRennen
        ? rennen.checkpoints[rennen.naechsterCheckpoint]
        : rennen.checkpoints[0];
      if (ziel) {
        ctx.beginPath();
        ctx.arc(kx(ziel.x), kz(ziel.z), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = imRennen ? '#ffb300' : '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Das Auto: ein Dreieck, das in Fahrtrichtung zeigt
      ctx.save();
      ctx.translate(kx(auto.x), kz(auto.z));
      /*
        telemetrie.richtung ist der Winkel um die Hochachse, 0 = Nase nach +Z.
        Auf der Karte zeigt +Z nach oben. Ein Winkel dreht auf dem Canvas im
        Uhrzeigersinn, in der Welt gegen den Uhrzeigersinn – daher das
        Minuszeichen nicht nötig, weil wir X ohnehin gespiegelt zeichnen.
      */
      ctx.rotate(telemetrie.richtung);
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.6, 5.5);
      ctx.lineTo(0, 3);
      ctx.lineTo(-4.6, 5.5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} style={{ width: GROESSE, height: GROESSE }} />
      <div className="minimap-norden">N</div>
    </div>
  );
}
