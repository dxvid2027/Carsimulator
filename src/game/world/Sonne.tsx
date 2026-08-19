import { useMemo } from 'react';
import { AdditiveBlending, CanvasTexture } from 'three';
import { SONNE } from './SunLight';

/**
 * Die sichtbare Sonne am Himmel.
 *
 * Der prozedurale Himmel berechnet zwar die Aufhellung um die Sonne herum,
 * zeichnet aber keine Scheibe. Die kommt hier dazu: eine flache Fläche, die
 * immer zur Kamera zeigt, mit einem weichen Verlauf und additiver Mischung.
 * Durch das Bloom-Nachbearbeiten strahlt sie dann richtig.
 *
 * Sie steht sehr weit weg und hat `depthWrite` aus – so verdeckt sie nichts
 * und wird von nichts verdeckt außer dem Gelände.
 */

/** Entfernung der Sonnenscheibe. Muss innerhalb der Kamera-Weitsicht liegen. */
const ENTFERNUNG = 1500;
/** Größe der Scheibe. */
const GROESSE = 190;

/** Weicher runder Verlauf, im Code gezeichnet. */
function macheSonnenTextur() {
  const g = 128;
  const c = document.createElement('canvas');
  c.width = c.height = g;
  const ctx = c.getContext('2d')!;
  const verlauf = ctx.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
  verlauf.addColorStop(0, 'rgba(255, 252, 235, 1)');
  verlauf.addColorStop(0.12, 'rgba(255, 244, 200, 0.95)');
  verlauf.addColorStop(0.32, 'rgba(255, 214, 130, 0.42)');
  verlauf.addColorStop(0.62, 'rgba(255, 186, 96, 0.12)');
  verlauf.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = verlauf;
  ctx.fillRect(0, 0, g, g);
  return new CanvasTexture(c);
}

export function Sonne() {
  const textur = useMemo(() => macheSonnenTextur(), []);
  const position = useMemo(
    () => [SONNE.x * ENTFERNUNG, SONNE.y * ENTFERNUNG, SONNE.z * ENTFERNUNG] as const,
    [],
  );

  return (
    <sprite position={position} scale={[GROESSE, GROESSE, 1]}>
      <spriteMaterial
        map={textur}
        blending={AdditiveBlending}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </sprite>
  );
}
