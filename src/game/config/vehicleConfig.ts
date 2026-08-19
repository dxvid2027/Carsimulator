/**
 * Alle Tuning-Werte des Autos an einem Ort.
 *
 * Wichtig zum Verständnis der Achsen:
 *   +Z = Fahrtrichtung "vorwärts"   (die Nase des Autos zeigt nach +Z)
 *   +Y = oben
 *   +X = links (aus Fahrersicht), weil wir in einem rechtshändigen System sind
 *
 * Die Zahlen unten sind nicht geraten, sondern in einer Physik-Simulation
 * gemessen (siehe tools/fahrphysik-test.mjs). Gemessene Ergebnisse:
 *   0–100 km/h in ca. 5,0 s | Topspeed ca. 192 km/h
 *   Bremsweg 100–0 km/h ca. 18 m
 *   80-km/h-Kurve: bleibt stabil, kippt nicht
 *   Handbremse: Drift bis ca. 63°, fängt sich danach wieder
 */

/** Feste Schrittweite der Physik (muss zu <Physics timeStep> passen). */
export const PHYSIK_DT = 1 / 60;

export const FAHRZEUG = {
  // ---------- Karosserie ----------
  /** Halbe Abmessungen des Kollisions-Quaders in Metern (also 1,7 × 0,64 × 4,0 m). */
  halbeGroesse: { x: 0.85, y: 0.32, z: 2.0 },
  /** Gesamtmasse in kg. */
  masse: 1200,
  /**
   * Schwerpunkt relativ zur Fahrzeugmitte. Negatives Y = tiefer.
   * Ein tiefer Schwerpunkt ist der wichtigste Trick gegen Umkippen.
   */
  schwerpunkt: { x: 0, y: -0.25, z: 0 },
  /** Trägheitsmoment um X/Y/Z. Großes Y = das Auto dreht sich träger um die Hochachse. */
  traegheit: { x: 1000, y: 1300, z: 550 },
  /** Startposition beim Laden und beim Reset (Taste R). */
  startPosition: [0, 1.2, 0] as [number, number, number],

  // ---------- Räder ----------
  rad: {
    radius: 0.36,
    breite: 0.25,
    /** Abstand der Räder von der Mittelachse nach links/rechts. */
    spurweite: 0.85,
    /** Abstand der Vorder-/Hinterachse von der Fahrzeugmitte. */
    radstand: 1.35,
    /** Höhe des Aufhängungspunkts relativ zur Fahrzeugmitte. */
    anbauHoehe: -0.32,
  },

  // ---------- Federung ----------
  federung: {
    /** Länge der Feder in Ruhe (unbelastet) in Metern. */
    ruhelaenge: 0.35,
    /** Härte der Feder. Höher = strafferes Fahrwerk, weniger Wanken. */
    haerte: 40,
    /** Dämpfung beim Einfedern. */
    daempfungDruck: 1.4,
    /** Dämpfung beim Ausfedern. Sollte größer als daempfungDruck sein. */
    daempfungZug: 2.4,
    /** Maximaler Federweg in Metern. */
    maxWeg: 0.28,
    /** Obergrenze der Federkraft in Newton (verhindert Katapult-Effekte). */
    maxKraft: 30000,
  },

  // ---------- Reifengrip ----------
  grip: {
    /**
     * Grip vorne und hinten.
     *
     * Entscheidend ist das VERHÄLTNIS, nicht der Absolutwert:
     * Hat die Hinterachse WENIGER Halt als die Vorderachse, bricht bei Tempo
     * das Heck aus, sobald man nur leicht einlenkt – das Auto dreht sich weg,
     * statt der Kurve zu folgen. Bei 180 km/h reichten dafür 4° Einschlag.
     *
     * Deshalb hat die Hinterachse hier mehr Halt (untersteuernde Auslegung,
     * wie bei jedem Serienauto). Gemessen: aus 86°/s Drehrate bei leichtem
     * Einlenken wurden 26°/s, aus 81 % Überschwingen wurden 2 %.
     *
     * Zum Driften wird der Hinterrad-Grip gezielt abgesenkt – siehe `drift`.
     */
    vorne: 2.4,
    hinten: 2.8,
    /** Seitenführungskraft. 1 = voller Seitenhalt, 0 = das Rad rutscht seitlich weg. */
    seite: 1.0,
    /**
     * Grip-Faktor im Gelände (Wiese, Schotter) gegenüber Asphalt.
     * 0,72 heißt: neben der Strecke hat man knapp drei Viertel des Grips –
     * spürbar rutschiger, aber noch kontrollierbar.
     */
    gelaende: 0.72,
  },

  // ---------- Antrieb ----------
  antrieb: {
    /** Maximale Antriebskraft pro angetriebenem Rad in Newton (Heckantrieb: 2 Räder). */
    maxMotorkraft: 4500,
    /**
     * Geschwindigkeit in m/s, bei der die Motorkraft auf 0 fällt.
     * Das ersetzt eine echte Drehmomentkurve und begrenzt den Topspeed.
     */
    maxGeschwindigkeit: 65,
    /** Anteil der Motorkraft beim Rückwärtsfahren. */
    rueckwaertsAnteil: 0.45,
    /** Bremskraft der Betriebsbremse. */
    bremskraft: 1600,
    /** Bremskraft der Handbremse (wirkt nur hinten). */
    handbremskraft: 900,
    /** Leichtes Bremsen beim Ausrollen ohne Gas (Motorbremse + Rollwiderstand). */
    rollwiderstand: 25,
    /** Bremskraft-Verteilung vorne/hinten (vorne bremst stärker, wie im echten Auto). */
    bremseVorne: 0.6,
    bremseHinten: 0.4,
  },

  // ---------- Lenkung ----------
  lenkung: {
    /**
     * Maximaler Radeinschlag in Radiant (0,42 rad ≈ 24°). Gilt im Stand.
     * Damit fährt das Auto im Stand einen Wendekreis von rund 12 m –
     * eng genug zum Rangieren, aber nicht mehr so giftig wie zuvor.
     */
    maxEinschlag: 0.42,

    /**
     * Zeit in Sekunden von der Mitte bis zum vollen Einschlag.
     *
     * Der Einschlag wächst GLEICHMÄSSIG über diese Zeit, nicht exponentiell.
     * Das ist der wichtigste Unterschied fürs Fahrgefühl: Eine exponentielle
     * Glättung bewegt die Räder am Anfang am schnellsten – ein kurzes
     * Antippen erreichte damit schon 63 % des Vollausschlags, und das Auto
     * zuckte bei jeder kleinen Korrektur.
     *
     * Gleichmäßig heißt: halb so lange gedrückt = halber Einschlag. Damit
     * lässt sich auch mit der Tastatur fein dosieren.
     */
    einlenkZeit: 0.55,

    /**
     * Zeit in Sekunden vom vollen Einschlag zurück in die Mitte.
     * Bewusst viel kürzer als das Einlenken: Beim Einlenken dosiert man,
     * beim Zurückstellen will man sofort wieder geradeaus.
     */
    rueckstellZeit: 0.18,

    /**
     * Um diesen Faktor dauert das Einlenken bei Höchstgeschwindigkeit länger.
     * Bei Tempo reißt niemand das Lenkrad herum.
     */
    tempoEinlenkFaktor: 1.7,

    /**
     * Wie stark der Einschlag bei Höchstgeschwindigkeit reduziert wird (0–1).
     * 0,72 heißt: bei Topspeed sind nur noch 28 % Einschlag möglich.
     */
    tempoDaempfung: 0.72,

    /**
     * Krümmung der Tempo-Kurve.
     * 1 wäre linear – dann fehlt schon bei Stadttempo spürbar Einschlag.
     * Werte über 1 lassen den Einschlag bei langsamer Fahrt fast voll und
     * nehmen ihn erst bei hohem Tempo deutlich zurück.
     */
    tempoKurve: 1.4,

    /**
     * Kennlinie für analoge Eingaben (Gamepad-Stick, Touch-Lenkzone).
     * Werte über 1 machen kleine Auslenkungen feiner und lassen den vollen
     * Ausschlag erst am Anschlag zu. Für die Tastatur ohne Wirkung, weil
     * dort der Wert immer 0 oder 1 ist.
     */
    analogKurve: 1.6,

    /** Lenkeinschlag-Faktor während die Handbremse gezogen ist. */
    handbremsFaktor: 0.85,

    // ----- Gegenlenk-Hilfe -----
    /**
     * Wenn das Heck ausbricht, lenkt das Spiel automatisch ein Stück mit.
     * Ohne diese Hilfe muss man in Sekundenbruchteilen exakt gegenlenken –
     * mit Tastatur (nur ganz oder gar nicht) ist das kaum zu schaffen.
     * 0 schaltet die Hilfe ab.
     */
    gegenlenkHilfe: 0.55,
    /** Ab diesem Schräglaufwinkel (Grad) greift die Hilfe. */
    gegenlenkAb: 8,
    /** Obergrenze der Hilfe in Radiant, damit sie nie selbst lenkt. */
    gegenlenkMax: 0.3,
  },

  // ---------- Drift ----------
  drift: {
    /** Hinterrad-Grip bei Vollgas (statt grip.hinten) – lässt das Heck kommen. */
    gripVollgas: 1.5,
    /** Seitenführung hinten bei Vollgas. */
    seiteVollgas: 0.55,
    /**
     * Hinterrad-Grip bei gezogener Handbremse.
     * Diese Werte hängen an `grip.hinten`: Wird die Hinterachse dort
     * griffiger gemacht, muss die Handbremse stärker absenken, damit der
     * Drift gleich bleibt. Gemessen: 49° Drift, in 1,4 s wieder abgefangen.
     */
    gripHandbremse: 0.55,
    /** Seitenführung hinten bei gezogener Handbremse. */
    seiteHandbremse: 0.45,
  },

  // ---------- Fahrhilfen & Aerodynamik ----------
  aero: {
    /** Luftwiderstandsbeiwert × Stirnfläche (cw · A). Begrenzt den Topspeed mit. */
    cwMalFlaeche: 0.42 * 2.2,
    /** Abtrieb: drückt das Auto mit steigendem Tempo auf die Straße. */
    abtrieb: 3.0,
    /** Luftdichte in kg/m³. */
    luftdichte: 1.225,
  },
  hilfen: {
    /**
     * Sanfte Gegenlenk-Hilfe: bremst die Drehung ab, wenn der Schräglaufwinkel
     * (Winkel zwischen Blickrichtung und tatsächlicher Fahrtrichtung) zu groß wird.
     * Ohne das dreht sich das Auto beim Handbremsen endlos im Kreis.
     */
    stabilisierung: 0.45,
    /**
     * Ab diesem Schräglaufwinkel (Grad) greift die Hilfe.
     * Früher (12° statt 20°) einzugreifen halbiert die Zeit, die man zum
     * Abfangen eines Drifts braucht – der Drift selbst bleibt erhalten.
     */
    abSchraeglauf: 12,
    /** Faktor der Hilfe während der Handbremse (>1 = stärker, damit kein Endlos-Spin). */
    handbremsFaktor: 1.3,
    /**
     * Wie stark die Stabilisierung mit dem Tempo zunimmt.
     * Bei 190 km/h wirkt sie damit gut doppelt so stark wie im Stand – genau
     * dort, wo ein Ausbrecher sonst nicht mehr einzufangen ist.
     */
    tempoVerstaerkung: 1.4,
    /** Dämpfung der Drehbewegung durch Rapier selbst. */
    winkelDaempfung: 0.6,
    /**
     * Luftlage: Wie stark sich das Auto ohne Bodenkontakt wieder waagerecht
     * dreht. Ohne diese Hilfe landet man nach jedem Sprung auf dem Dach.
     */
    luftAusrichtung: 3.0,
    /** Dämpfung der Drehbewegung in der Luft (verhindert wildes Trudeln). */
    luftDaempfung: 1.6,
    /**
     * Liegt das Auto so lange kopfüber und steht still, setzt es sich selbst
     * zurück. 0 schaltet die Automatik ab (dann hilft nur noch Taste R).
     */
    autoResetSekunden: 3,
  },

  // ---------- Anzeige (nur HUD, keine Physik) ----------
  getriebe: {
    /** Obergrenze jedes Gangs in km/h. Nur für die Gang-/Drehzahlanzeige. */
    gangGrenzen: [55, 95, 135, 170, 200, 240],
    leerlaufDrehzahl: 900,
    maxDrehzahl: 7200,
  },
} as const;

/**
 * Position der 4 Räder im Fahrzeug-Koordinatensystem.
 * Reihenfolge ist wichtig: 0/1 = vorne (lenken), 2/3 = hinten (angetrieben).
 */
export const RAD_POSITIONEN = [
  { x: FAHRZEUG.rad.spurweite, y: FAHRZEUG.rad.anbauHoehe, z: FAHRZEUG.rad.radstand }, // 0 vorne rechts
  { x: -FAHRZEUG.rad.spurweite, y: FAHRZEUG.rad.anbauHoehe, z: FAHRZEUG.rad.radstand }, // 1 vorne links
  { x: FAHRZEUG.rad.spurweite, y: FAHRZEUG.rad.anbauHoehe, z: -FAHRZEUG.rad.radstand }, // 2 hinten rechts
  { x: -FAHRZEUG.rad.spurweite, y: FAHRZEUG.rad.anbauHoehe, z: -FAHRZEUG.rad.radstand }, // 3 hinten links
] as const;

/** Indizes der gelenkten bzw. angetriebenen Räder. */
export const VORDERRAEDER = [0, 1] as const;
export const HINTERRAEDER = [2, 3] as const;
