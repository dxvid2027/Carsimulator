/**
 * Das optionale Rennen.
 *
 * Grundzustand des Spiels ist freies Fahren – die Welt gehört dir, es läuft
 * keine Uhr. Nur wer in die markierte Startzone fährt und bestätigt, startet
 * ein Rennen über mehrere Runden. Danach geht es wieder zurück ins freie
 * Fahren.
 *
 * Wie die Telemetrie ist das hier ein einfaches Objekt statt React-State:
 * Die Werte ändern sich 60-mal pro Sekunde, ein Render pro Frame wäre zu teuer.
 * Die Oberfläche liest die Werte in ihrer eigenen Animationsschleife.
 */
import { STRECKE, type Streckendaten } from '../world/strecke';

export type RennPhase =
  /** Freies Fahren, keine Uhr läuft. */
  | 'frei'
  /** Auto steht in der Startzone, warten auf Bestätigung. */
  | 'bereit'
  /** 3 – 2 – 1 – los. */
  | 'countdown'
  /** Rennen läuft. */
  | 'laeuft'
  /** Ziel erreicht, Ergebnis wird angezeigt. */
  | 'beendet';

/** Ein Kontrollpunkt entlang der Strecke. */
export interface Checkpoint {
  x: number;
  y: number;
  z: number;
  /** Richtung der Fahrbahn an dieser Stelle. */
  rx: number;
  rz: number;
}

export const RENNEN_EINSTELLUNGEN = {
  /** Wie viele Runden ein Rennen dauert. */
  runden: 2,
  /** Anzahl der Kontrollpunkte pro Runde (inklusive Start/Ziel). */
  checkpoints: 10,
  /** Wie nah man einem Kontrollpunkt kommen muss, damit er zählt. */
  checkpointRadius: 22,
  /** Radius der Startzone. */
  zonenRadius: 14,
  /** Bis zu diesem Tempo (km/h) gilt man als "stehend" in der Zone. */
  startTempo: 25,
  /** Dauer des Countdowns in Sekunden. */
  countdown: 3,
  /**
   * Wo auf der Strecke die Startzone liegt (0 = am Startpunkt des Autos).
   *
   * Bewusst nicht bei 0: Das Auto würde sonst direkt in der Zone stehen und
   * die Renn-Einladung wäre schon beim Laden zu sehen. Das Spiel ist aber in
   * erster Linie ein freies Fahren – das Tor soll man beim Herumfahren
   * entdecken.
   */
  startzonenAnteil: 0.3,
} as const;

/** Schlüssel für die Bestzeit im Browser-Speicher. */
const BESTZEIT_SCHLUESSEL = 'carsim.bestzeit';

function ladeBestzeit(): number {
  try {
    const wert = Number(localStorage.getItem(BESTZEIT_SCHLUESSEL));
    return Number.isFinite(wert) && wert > 0 ? wert : 0;
  } catch {
    return 0;
  }
}

function speichereBestzeit(zeit: number) {
  try {
    localStorage.setItem(BESTZEIT_SCHLUESSEL, String(zeit));
  } catch {
    // localStorage kann gesperrt sein – dann eben ohne Bestzeit
  }
}

export const rennen = {
  phase: 'frei' as RennPhase,
  /** Aktuelle Runde, 1-basiert. */
  runde: 0,
  /** Laufende Zeit der aktuellen Runde in Sekunden. */
  rundenzeit: 0,
  /** Gesamtzeit seit dem Start in Sekunden. */
  gesamtzeit: 0,
  /** Zeit der zuletzt beendeten Runde. */
  letzteRunde: 0,
  /** Beste Rundenzeit dieser Sitzung. */
  besteRunde: 0,
  /** Beste je gefahrene Rundenzeit (bleibt gespeichert). */
  bestzeit: 0,
  /** Index des Kontrollpunkts, der als Nächstes zählt. */
  naechsterCheckpoint: 0,
  /** Restliche Countdown-Sekunden. */
  countdownRest: 0,
  /** Steht das Auto gerade in der Startzone? */
  inZone: false,
  /** Ist das Auto langsam genug zum Starten? */
  langsamGenug: false,
  /** Kontrollpunkte der aktuellen Strecke. */
  checkpoints: [] as Checkpoint[],
  /** Zähler, der bei jeder Zustandsänderung hochgeht – die UI erkennt daran Änderungen. */
  version: 0,
};

/** Verteilt Kontrollpunkte gleichmäßig über die Streckenlänge. */
export function erzeugeCheckpoints(strecke: Streckendaten): Checkpoint[] {
  const anzahl = RENNEN_EINSTELLUNGEN.checkpoints;
  const liste: Checkpoint[] = [];
  const versatz = RENNEN_EINSTELLUNGEN.startzonenAnteil * strecke.laenge;
  for (let i = 0; i < anzahl; i++) {
    // Kontrollpunkt 0 ist die Start-/Ziellinie und liegt beim Versatz
    const zielDistanz = (versatz + (i / anzahl) * strecke.laenge) % strecke.laenge;
    // Den Stützpunkt suchen, der dieser Distanz am nächsten kommt
    let besterIndex = 0;
    let besteDifferenz = Infinity;
    for (let j = 0; j < strecke.punkte.length; j++) {
      const d = Math.abs(strecke.punkte[j].distanz - zielDistanz);
      if (d < besteDifferenz) {
        besteDifferenz = d;
        besterIndex = j;
      }
    }
    const p = strecke.punkte[besterIndex];
    liste.push({ x: p.x, y: p.y, z: p.z, rx: p.rx, rz: p.rz });
  }
  return liste;
}

/** Bereitet das Rennen für eine Strecke vor. Einmal beim Laden aufrufen. */
export function rennenVorbereiten(strecke: Streckendaten) {
  rennen.checkpoints = erzeugeCheckpoints(strecke);
  rennen.bestzeit = ladeBestzeit();
  rennen.phase = 'frei';
  rennen.version++;
}

/** Die Startzone liegt am ersten Kontrollpunkt. */
export function startzone(): Checkpoint | null {
  return rennen.checkpoints[0] ?? null;
}

/**
 * Wird jeden Frame aufgerufen und pflegt den Zustand.
 *
 * `dt` ist die tatsächlich vergangene Zeit in Sekunden. Wichtig: NICHT das
 * begrenzte Frame-Delta der Grafik übergeben. Das ist gegen Sprünge nach einem
 * Tab-Wechsel gedeckelt – auf einem langsamen Gerät liefe die Rundenzeit
 * dadurch zu langsam und wäre schlicht falsch. Eine Stoppuhr muss echte Zeit
 * messen, unabhängig von der Bildrate. Wer die Uhr aufruft, ist dafür
 * zuständig (siehe `RennenTakt` in Scene.tsx).
 *
 * Position des Autos in Weltkoordinaten, Tempo in km/h.
 */
export function rennenAktualisieren(
  dt: number,
  auto: { x: number; y: number; z: number },
  tempoKmh: number,
) {
  const zone = startzone();
  if (!zone) return;

  // --- In der Startzone? ---
  const abstandZone = Math.hypot(auto.x - zone.x, auto.z - zone.z);
  const warInZone = rennen.inZone;
  rennen.inZone = abstandZone < RENNEN_EINSTELLUNGEN.zonenRadius;
  rennen.langsamGenug = tempoKmh < RENNEN_EINSTELLUNGEN.startTempo;
  if (warInZone !== rennen.inZone) rennen.version++;

  switch (rennen.phase) {
    case 'frei':
      // In der Zone und langsam genug -> Angebot zum Starten
      if (rennen.inZone && rennen.langsamGenug) {
        rennen.phase = 'bereit';
        rennen.version++;
      }
      break;

    case 'bereit':
      // Wieder weggefahren -> Angebot zurückziehen
      if (!rennen.inZone) {
        rennen.phase = 'frei';
        rennen.version++;
      }
      break;

    case 'countdown':
      rennen.countdownRest -= dt;
      if (rennen.countdownRest <= 0) {
        rennen.phase = 'laeuft';
        rennen.runde = 1;
        rennen.rundenzeit = 0;
        rennen.gesamtzeit = 0;
        rennen.naechsterCheckpoint = 1;
        rennen.version++;
      }
      break;

    case 'laeuft': {
      rennen.rundenzeit += dt;
      rennen.gesamtzeit += dt;

      const ziel = rennen.checkpoints[rennen.naechsterCheckpoint];
      if (!ziel) break;
      const d = Math.hypot(auto.x - ziel.x, auto.z - ziel.z);
      if (d < RENNEN_EINSTELLUNGEN.checkpointRadius) {
        rennen.naechsterCheckpoint =
          (rennen.naechsterCheckpoint + 1) % rennen.checkpoints.length;

        // Wieder bei Kontrollpunkt 0 angekommen = Runde voll
        if (rennen.naechsterCheckpoint === 1) {
          rennen.letzteRunde = rennen.rundenzeit;
          if (rennen.besteRunde === 0 || rennen.rundenzeit < rennen.besteRunde) {
            rennen.besteRunde = rennen.rundenzeit;
          }
          if (rennen.bestzeit === 0 || rennen.rundenzeit < rennen.bestzeit) {
            rennen.bestzeit = rennen.rundenzeit;
            speichereBestzeit(rennen.bestzeit);
          }
          rennen.rundenzeit = 0;

          if (rennen.runde >= RENNEN_EINSTELLUNGEN.runden) {
            rennen.phase = 'beendet';
          } else {
            rennen.runde++;
          }
        }
        rennen.version++;
      }
      break;
    }

    case 'beendet':
      // Bleibt stehen, bis der Spieler bestätigt
      break;
  }
}

/** Startet den Countdown. Wird vom Startknopf bzw. der Taste E ausgelöst. */
export function rennenStarten() {
  if (rennen.phase !== 'bereit') return;
  rennen.phase = 'countdown';
  rennen.countdownRest = RENNEN_EINSTELLUNGEN.countdown;
  rennen.runde = 0;
  rennen.rundenzeit = 0;
  rennen.gesamtzeit = 0;
  rennen.letzteRunde = 0;
  rennen.besteRunde = 0;
  rennen.naechsterCheckpoint = 0;
  rennen.version++;
}

/** Bricht ein laufendes Rennen ab oder schließt das Ergebnis. */
export function rennenBeenden() {
  rennen.phase = 'frei';
  rennen.runde = 0;
  rennen.rundenzeit = 0;
  rennen.version++;
}

/** Position, an die ein Reset während des Rennens zurücksetzt. */
export function letzterCheckpoint(): Checkpoint | null {
  if (rennen.phase !== 'laeuft') return null;
  const index =
    (rennen.naechsterCheckpoint - 1 + rennen.checkpoints.length) % rennen.checkpoints.length;
  return rennen.checkpoints[index] ?? null;
}

/** Formatiert Sekunden als m:ss.mmm – so wie man Rundenzeiten schreibt. */
export function zeitText(sekunden: number): string {
  if (sekunden <= 0) return '--:--.---';
  const min = Math.floor(sekunden / 60);
  const sek = Math.floor(sekunden % 60);
  const ms = Math.floor((sekunden % 1) * 1000);
  return `${min}:${String(sek).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** Länge der Strecke – nur zur Anzeige. */
export function streckenLaenge(strecke: Streckendaten) {
  return strecke.laenge;
}

/** Breite der Fahrbahn – für die Größe der sichtbaren Tore. */
export const TOR_BREITE = STRECKE.breite;
