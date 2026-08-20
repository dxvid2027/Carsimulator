# Carsimulator

3D-Open-World-Fahrspiel im Browser.

**Stand: Phase 6 – offene Welt mit Geländepisten, Sprungrampen, Felsenfeld, Dorf und optionalem Rennen.**

Grundzustand ist **freies Fahren**: keine Uhr, keine Vorgaben, fahr wohin du
willst. Wer mag, startet an einem markierten Tor auf der Straße ein Rennen über
zwei Runden.

Die Spieltexte sind auf Englisch, die Code-Kommentare auf Deutsch.

## Schnellstart

```bash
npm install
npm run dev
```

Dann die Adresse öffnen, die im Terminal steht (meist
`http://localhost:5173`), und **ins Bild klicken**, damit die Tastatur ankommt.

## Startbildschirm

Beim ersten Laden fragt das Spiel, ob du mit **Tastatur** oder per **Touch**
spielst. Dein Gerät wird vorausgewählt (Badge „detected"), entscheiden tust
aber du – so funktioniert die Seite auch auf einem Laptop mit Touchscreen
richtig. Die Wahl wird gemerkt und lässt sich im Pausemenü ändern.

Der Startbildschirm hat noch einen zweiten Zweck: Ein Browser gibt einer Seite
erst nach einem Klick zuverlässig Tastatur-Fokus.

## Steuerung (Tastatur)

| Taste | Funktion |
|---|---|
| `W` / `↑` | Gas |
| `S` / `↓` | Bremse, im Stand Rückwärtsgang |
| `A` `D` / `←` `→` | Lenken |
| `Leertaste` | Handbremse (Drift) |
| `C` | Kamera: Chase → Close → Cockpit → Overview |
| `T` | Auf der Stelle um 180° wenden |
| `R` | Auto zurücksetzen |
| `M` | Karte groß / wieder klein |
| `E` | Rennen starten (im Startbereich) |
| `Esc` / `P` | Pause |

Ein Gamepad wird automatisch erkannt: RT = Gas, LT = Bremse,
linker Stick = Lenken, A-Taste = Handbremse.

## Steuerung (iPad, Handy)

Auf Touchgeräten erscheinen automatisch Bedienelemente auf dem Bildschirm:

- **links unten** – Lenkzone. Wo du zuerst hintippst, ist die Mitte. Ziehst du
  von dort nach links oder rechts, lenkt das Auto entsprechend. Du musst also
  nicht zielen und kannst blind mit dem Daumen bedienen.
- **rechts unten** – Gas, Bremse, Handbremse zum Halten.
- **rechts oben** – Kamera, Reset und Pause.

Am besten im **Querformat** spielen. Hochkant besteht das halbe Bild aus Himmel.

Zum Ausprobieren am Rechner: `?touch` an die URL hängen erzwingt die
Touch-Bedienung, `?keyboard` erzwingt die Tastatur-Ansicht.

## Rennen starten (optional)

Auf der Straße steht ein leuchtendes Tor mit einem blauen Ring auf dem Asphalt.
Fahr hinein und werde langsam – dann erscheint die Einladung. Mit **`E`** oder
dem Knopf startet ein Rennen über zwei Runden.

- Zehn Kontrollpunkte müssen der Reihe nach passiert werden. Abkürzen zählt nicht.
- Während des Rennens sind nur das nächste und das übernächste Tor sichtbar,
  damit die Landschaft nicht zugestellt wird.
- `R` setzt dich im Rennen an den zuletzt passierten Kontrollpunkt zurück, nicht
  an den Start – ein Ausrutscher beendet das Rennen also nicht.
- Die beste Rundenzeit bleibt im Browser gespeichert.
- „Quit race" bzw. `E` im Ergebnis bringt dich zurück ins freie Fahren.

Das Tor liegt bewusst nicht am Startplatz, sondern rund 650 m die Strecke
entlang – man soll es beim Herumfahren entdecken.

## Pause

`Esc` oder `P`, auf dem Touchgerät der Knopf `❚❚` oben rechts. Während der
Pause steht die Physik still. Wechselst du den Tab oder legst das Gerät weg,
pausiert das Spiel von selbst.

## Ins Netz stellen (Cloudflare Pages)

Praktisch, wenn du kein Terminal hast – zum Beispiel auf dem iPad.

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create** → **Pages** → **Connect to Git**
2. GitHub verbinden und dieses Repository auswählen
3. Einstellungen:
   - **Production branch:** `claude/3d-open-world-racing-game-y5q7qt`
     (dieses Repo hat keinen `main`-Branch – der Branch muss von Hand
     ausgewählt werden, sonst findet Cloudflare nichts zum Bauen)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Framework preset: *None*
4. **Save and Deploy**

Die Node-Version steht in `.node-version` (22), die muss man nicht extra setzen.
Nach ein bis zwei Minuten gibt es eine Adresse wie `carsimulator.pages.dev`.
Jeder weitere Push auf den Branch baut die Seite automatisch neu.

## Zum Home-Bildschirm hinzufügen (iPhone, iPad)

Das Spiel lässt sich wie eine App aufs iPhone legen – mit eigenem Symbol und
ohne Browserleiste.

1. Die Seite in **Safari** öffnen (Chrome auf dem iPhone kann das nicht)
2. Unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben)
3. **Zum Home-Bildschirm** → **Hinzufügen**

Auf dem Home-Bildschirm steht dann „Carsimulator“ mit dem lila Auto als
Symbol. Beim Antippen startet es im Vollbild.

Damit das funktioniert, braucht die Seite drei Dinge, die alle im Projekt
liegen:

| Was | Datei | Wozu |
|---|---|---|
| Symbol als PNG | `public/apple-touch-icon.png` | iOS ignoriert SVG-Symbole und zeigt sonst einen Ausschnitt der Seite als Kachel |
| Vollbild-Schalter | `apple-mobile-web-app-capable` in `index.html` | ohne ihn öffnet sich das Spiel mit Browserleiste |
| Manifest | `public/manifest.webmanifest` | Name, Symbole und Ausrichtung – für Android und Chrome |

Die Vorlage für alle Symbole ist `public/icon.svg`, dieselbe Zeichnung wie das
Logo auf dem Startbildschirm. Nach einer Änderung daran:

```bash
npm run icons
```

Das rendert die PNGs (180, 192, 512 px) mit Chromium neu – so sieht das Symbol
garantiert genauso aus wie das Logo im Spiel.

## Was dieser Prototyp kann

- **Höhergelegte Limousine** auf Grobstollenreifen, mit Dachträger und
  Reserverad. 0,51 m Bodenfreiheit, Kippgrenze 1,53 g.
- **Raycast-Vehicle über Rapier** – kein Arcade-Würfel, sondern vier Räder mit
  echter Federung, Grip und Radlastverteilung.
- **Dosierbare Lenkung** mit gleichmäßiger Rate, schneller Rückstellung und
  Gegenlenk-Hilfe.
- **Drift** – zu viel Gas löst das Heck, die Handbremse blockiert die
  Hinterräder. Der Drift lässt sich in unter einer Sekunde abfangen.
- **1 × 1 km Terrain** aus einer im Code erzeugten Heightmap, mit passendem
  Kollisionskörper und Einfärbung nach Höhe und Steilheit.
- **Geschlossener Rundkurs** (ca. 2,2 km) mit Mittel- und Randmarkierung.
  Die Straße wird ins Terrain eingeschnitten, deshalb braucht sie keinen
  eigenen Kollisionskörper.
- **Unterschiedlicher Grip**: Auf Asphalt klebt das Auto, im Gras rutscht es.
- **Bäume und Leitplanken** als Instanced Meshes, beide mit Kollision.
  Leitplanken stehen nur dort, wo das Gelände neben der Fahrbahn abfällt.
- **Heuballen-Haufen** neben der Strecke: mehrere Rundballen nebeneinander und
  gestapelt. Sie sind bewegliche Körper – man fährt hindurch und treibt sie
  auseinander.
- **Karte** oben rechts, mit **M** groß aufklappbar: eingefärbtes Gelände,
  Rundkurs, Nebenstraßen, Geländepisten, Heuballen, Renn-Tor und Marker für
  alle Sehenswürdigkeiten (Stuntpark, Rampen, Tankstelle, Aussichtsturm,
  Dorf, Windmühle, Felsenfeld).
- **Gelände**: drei Schotterpisten, die dem Boden mit allen Bodenwellen folgen
  (bewusst nicht geglättet – genau das macht Offroad aus), Sprungrampen zum
  Abheben und ein Felsenfeld zum Drüberklettern.
- **Stuntpark** auf eingeebnetem Kiesplatz: Weitsprung über zwei einander
  zugewandte Rampen, eine große Rampe auf eine Holzplattform mit Abfahrt,
  drei Containerstapel zum Draufspringen, Reifenstapel und ein Schild.
  Alle Rampen sind echte Keile mit passgenauem Kollisionskörper – keine
  gekippten Quader, an deren Unterkante man hängen bleibt.
- **Drei Rampen direkt am Straßenrand**: von der Fahrbahn abbiegen, drüber
  springen, im Gelände landen.
- **Sehenswürdigkeiten**: Aussichtsturm mit Blinklicht, Felsentor zum
  Durchfahren, Tankstelle am Rundkurs und drei Heißluftballons am Himmel.
- **Bauernhof** in Sichtweite des Dorfes: Scheune mit Satteldach, Silo,
  Wasserturm und ein Weidezaun, durch den man hindurchfahren kann.
- **Landschaft**: Felsen, Büsche, ein kleines Dorf mit Häusern, eine Windmühle
  mit drehenden Flügeln als Wahrzeichen und eine sichtbare Sonne.
- **Zwei Nebenstraßen** quer über die Karte, ebenfalls ins Terrain geschnitten.
- **Optionales Rennen** mit Kontrollpunkten, Rundenzeiten und Bestzeit.
- **Luftlagen-Stabilisierung** – nach Sprüngen landet das Auto wieder auf den
  Rädern; bleibt es doch liegen, setzt es sich nach 3 s selbst zurück.
- **Weiche Verfolgerkamera** mit Nachlauf, Abstandsbegrenzung und
  tempoabhängigem Sichtfeld, vier Perspektiven.
- **Grafik**: tief stehende Abendsonne mit langen Schatten, warmes Sonnenlicht
  gegen blaue Schatten, exponentieller Dunst, HDRI-Umgebungslicht,
  prozeduraler Himmel, Umgebungsverschattung (N8AO), Bloom, ACES-Tonwertkurve,
  Farbabstimmung, Vignette und SMAA-Kantenglättung. Siehe „Wie die Grafik
  eingestellt ist".
- **Touch-Bedienung** für iPad und Handy, inklusive analogem Lenken.

## Wie die Grafik eingestellt ist

Ein paar wenige Werte bestimmen den Gesamteindruck. Sie stehen absichtlich
verstreut in den Dateien, zu denen sie gehören – hier die Übersicht.

| Was | Wo | Wert | Wirkt sich aus auf |
|---|---|---|---|
| Sonnenstand | `SONNE` in `world/SunLight.tsx` | ca. 22° über dem Horizont | Länge und Richtung aller Schatten |
| Sonnenfarbe/-stärke | `directionalLight` in `SunLight.tsx` | `#ffdcaf`, 2.5 | Wärme und Helligkeit des Bildes |
| Himmelslicht | `hemisphereLight` in `Scene.tsx` | `#86b2ff`, 0.55 | Farbe der Schattenseiten |
| Spiegelungen | `environmentIntensity` in `Scene.tsx` | 0.95 | Glanz auf Lack, Glas, Chrom |
| Dunst | `fogExp2` in `Scene.tsx` | Dichte 0.0013 | wie weit man sieht |
| Farbabstimmung | `BrightnessContrast` / `HueSaturation` in `Scene.tsx` | +0.14 / +0.2 | Biss und Farbkraft |

**Der wichtigste Gedanke dahinter:** warmes Sonnenlicht gegen kalte Schatten.
Nicht mehr Details machen ein Bild schön, sondern dieser Farbkontrast. Deshalb
ist die Sonne warm (`#ffdcaf`) und das Himmelslicht kräftig blau (`#86b2ff`).

**Wenn etwas nicht gefällt**, immer nur *einen* Wert ändern – sonst weiß man
hinterher nicht, was gewirkt hat:

- zu orange → Sonnenfarbe Richtung `#ffeed6`
- zu dunstig → Nebeldichte auf 0.0009
- zu knallig → `saturation` auf 0.1
- zu hell → `intensity` des Sonnenlichts senken

## Ordnerstruktur

```
src/
  main.tsx                  Einstiegspunkt
  App.tsx                   Canvas, HUD, Menüs, Tastenkürzel
  styles.css                Styling der gesamten Oberfläche
  game/
    Scene.tsx               Beleuchtung, Physikwelt, Zusammenbau
    telemetrie.ts           Anzeigewerte ohne React-Re-Render
    spielzustand.ts         Spielphase und gewählte Steuerung
    config/
      vehicleConfig.ts      ALLE Tuning-Werte des Autos
    input/
      useDrivingInput.ts    Tastatur + Gamepad + Touch zusammenführen
      touchInput.ts         Gemeinsamer Zustand der Touch-Bedienung
    vehicle/
      useRaycastVehicle.ts  Erzeugt Rapiers Fahrzeug-Controller
      fahrlogik.ts          Motor, Bremse, Lenkung, Drift, Luftlage
      Car.tsx               Physikkörper + sichtbare Räder
      CarModel.tsx          Karosserie aus einfachen Formen
    world/
      heightmap.ts          Prozedurale Höhendaten + Höhenabfrage
      strassennetz.ts       Kennt alle Fahrwege, hält sie frei
      Heuballen.tsx         Bewegliche Heuballen in Haufen
      Offroad.tsx           Schotterpisten, Sprungrampen, Felsenfeld
      Deko.tsx              Felsen, Büsche, Dorf, Windmühle
      orte.ts               Wo die Sehenswürdigkeiten stehen (eine Quelle
                            für 3D-Welt und Karte)
      Stuntpark.tsx         Rampen, Plattform, Container, Kiesplatz
      Attraktionen.tsx      Aussichtsturm, Felsentor, Tankstelle, Ballons
      Bauernhof.tsx         Scheune, Silo, Wasserturm, Weidezaun
      Sonne.tsx             Sichtbare Sonnenscheibe
      strecke.ts            Rundkurs erzeugen und ins Terrain einschneiden
      Terrain.tsx           Sichtbares Terrain (Kacheln) + Heightfield-Kollider
      Road.tsx              Sichtbares Straßenband
      Leitplanken.tsx       Instanced Meshes an Abhängen
      Baeume.tsx            Instanced Meshes
      SunLight.tsx          Sonnenlicht, dessen Schatten dem Auto folgt
      Weltgrenze.tsx        Unsichtbare Wände am Kartenrand
    race/
      rennen.ts             Zustand, Kontrollpunkte und Zeitmessung
      RaceZone.tsx          Startzone und Kontrollpunkt-Tore in 3D
    camera/
      ChaseCamera.tsx       Verfolgerkamera
    ui/
      Hud.tsx               Tacho-Overlay
      TouchControls.tsx     Bedienelemente für iPad und Handy
      StartScreen.tsx       Wahl der Steuerung beim Start
      PauseMenu.tsx         Pausemenü
      RaceHud.tsx           Einladung, Countdown, Rundenzeiten, Ergebnis
      Minimap.tsx           Karte oben rechts (2D-Canvas, nicht 3D)
      Logo.tsx              Spiel-Logo als SVG
public/
  venice_sunset_1k.hdr      HDRI fürs Umgebungslicht (CC0)
  icon.svg                  Vorlage für alle App-Symbole
  apple-touch-icon.png      Symbol für den iPhone-Home-Bildschirm (180 px)
  icon-192.png              Symbol für Android/Chrome
  icon-512.png              Symbol für Android/Chrome
  icon-maskable-512.png     Symbol, das Android beliebig zuschneiden darf
  manifest.webmanifest      Name, Symbole, Ausrichtung
  ASSETS.md                 Herkunft und Lizenz der Assets
tools/
  fahrphysik-test.ts        Headless-Test der Fahrphysik
  lenkung-test.ts           Headless-Test des Lenkverhaltens
  terrain-test.ts           Headless-Test des Terrains
  strecken-test.ts          Headless-Test des Rundkurses
  rennen-test.ts            Headless-Test der Rennlogik
  heuballen-test.ts         Headless-Test der Heuballen
  wege-test.ts              Prüft, ob alle Wege frei befahrbar sind
  orte-test.ts              Prüft die Bauplätze der Sehenswürdigkeiten
  icons-bauen.ts            Erzeugt die PNG-Symbole aus public/icon.svg
```

## Testen ohne Browser

Alle acht Tests starten die echte Physik bzw. Logik ohne Grafik und benutzen
dieselben Dateien wie das Spiel. Änderst du einen Wert in der Konfiguration,
siehst du die Auswirkung sofort in Zahlen.

### Fahrphysik

```bash
npm run physik
```

| Messung | Wert |
|---|---|
| 0–100 km/h | 5,78 s |
| Topspeed | 196 km/h |
| Bremsweg 100–0 km/h | 25,8 m (1,5 g) |
| Nicken beim Bremsen | 1,1°, Räder bleiben am Boden |
| Dauerkurve 80 km/h | stabil, kippt nicht |
| Handbremsen-Drift | bis 41°, fängt sich wieder |
| Luftlage nach Sprung | richtet sich auf, landet auf den Rädern |

### Lenkung

```bash
npm run lenkung
```

| Messung | Wert |
|---|---|
| Einschlag im Stand / bei 180 km/h | 24,0° / 14,2° |
| kurzes Antippen (0,1 s) | 5,6° Einschlag, Auto dreht sich 1° |
| Zeit bis Volleinschlag | 0,47 s |
| Rückstellung in die Mitte | 0,15 s |
| Überschwingen bei 60/120/180 km/h | 14 % / 12 % / 2 % |
| kleine Lenkbewegung bei 180 km/h | 25,7 °/s Drehrate (ruhig) |
| Drift abfangen | 0,4 s |

Drei Dinge machen das Fahrgefühl aus:

1. **Der Einschlag wächst gleichmäßig über die Zeit**, nicht exponentiell. Eine
   exponentielle Glättung bewegt die Räder am Anfang am schnellsten – ein
   kurzes Antippen erreichte damit über 60 % des Vollausschlags, und jede
   kleine Korrektur riss das Auto herum. Gleichmäßig heißt: halb so lange
   gedrückt = halber Einschlag.
2. **Zurückstellen geht schneller als Einlenken.** Beim Einlenken dosiert man,
   beim Zurückstellen will man sofort wieder geradeaus.
3. **Die Grip-Verteilung**, nicht nur die Lenkung: Hat die Hinterachse weniger
   Halt als die Vorderachse, dreht sich das Auto bei Tempo schon bei leichtem
   Einlenken weg. Deshalb hat die Hinterachse mehr Halt
   (`grip.hinten > grip.vorne`), wie bei jedem Serienauto.

Bricht das Heck aus, lenkt das Spiel automatisch ein Stück mit
(`lenkung.gegenlenkHilfe`). Mit der Tastatur gibt es nur „ganz links" oder
„ganz rechts" – fein dosiertes Gegenlenken wäre damit unmöglich.

### Terrain

```bash
npm run terrain
```

Prüft die wichtigste Fehlerquelle: ob Rapiers Kollisionskörper exakt zu den
Höhen passt, die auch das sichtbare Mesh benutzt. Stimmt das nicht, schwebt das
Auto über dem Boden oder versinkt darin – visuell übersieht man das leicht.

| Messung | Wert |
|---|---|
| Größe | 1000 × 1000 m, 257 × 257 Höhenpunkte (3,91 m je Zelle) |
| Kollider vs. Höhen-Array | 0,0000 m Fehler auf Gitterpunkten |
| Startbereich | flach im Radius 60 m |
| steilste Stelle | 21° |

### Strecke

```bash
npm run strecke
```

| Messung | Wert |
|---|---|
| Länge | ca. 2165 m, geschlossen |
| Fahrbahn | 12 m + 4 m Bankett je Seite |
| engster Kurvenradius | 153 m |
| steilste Stelle | 11° über 10 m |
| Selbstabstand | 137 m (der Kurs kreuzt sich nicht) |
| Kollider vs. Fahrbahn | max. 0,08 m Abweichung |

Kommt sich der Kurs zu nahe, überlagern sich beim Einschneiden zwei
verschiedene Fahrbahnhöhen und die Straße bekommt eine Stufe. Deshalb probiert
die Streckenerzeugung automatisch mehrere Zufallskeime durch, bis einer die
Vorgaben in `STRECKE` erfüllt.

### Wege

```bash
npm run wege
```

Prüft, ob Bäume, Felsen, Büsche und Heuballen von **allen** Fahrwegen
freibleiben – nicht nur vom Rundkurs. Genau das ging vorher schief: Die
Platzierung kannte nur den Rundkurs, deshalb wuchsen Büsche mitten auf den
Nebenstraßen und Leitplanken standen quer über den Einmündungen.

Alle Objekte fragen jetzt `src/game/world/strassennetz.ts`, das Rundkurs,
Nebenstraßen und Geländepisten zusammen kennt. Damit das bei zehntausenden
Abfragen schnell bleibt, liegen die Wegpunkte in einem Raster.

| Messung | Wert |
|---|---|
| Bäume / Felsen / Büsche / Heuballen | 620 / 260 / 420 / 88, keiner auf einer Fahrbahn |
| Wege | Rundkurs, 2 Nebenstraßen, 3 Geländepisten |
| steilste Stelle | 12° Straße, bis 28° Piste |

### Heuballen

```bash
npm run heu
```

Prüft, ob die Haufen sauber neben der Fahrbahn liegen, nicht im Boden stecken
und ob man wirklich hindurchfahren kann, statt gegen eine Mauer zu prallen.

| Messung | Wert |
|---|---|
| Ballen | 98 in 14 Haufen |
| Abstand zur Streckenmitte | mind. 8,6 m (Fahrbahn ist 6 m halbbreit) |
| Durchfahrt mit 68 km/h | alle Ballen fliegen weg, größter Versatz ca. 19 m |
| Ballen durch den Boden | keine |

Die Ballen wiegen bewusst 170 kg statt realistischer 300 kg. Mit dem echten
Gewicht bremst ein Haufen das Auto von 68 auf 5 km/h ab und fühlt sich an wie
eine Mauer.

### Rennen

```bash
npm run rennen
```

Prüft den Ablauf (freies Fahren → Einladung → Countdown → Runden → Ergebnis),
ob die Zeitmessung stimmt und ob sich das Rennen abkürzen lässt.

Ein Detail, das dabei aufgefallen ist: Die Rundenuhr darf **nicht** das
Frame-Delta der Grafik benutzen. Das ist gegen Sprünge nach einem Tab-Wechsel
begrenzt – auf einem langsamen Gerät liefe die Uhr dadurch zu langsam und die
Zeiten wären falsch. Sie misst deshalb echte Zeit (siehe `RennenTakt` in
`Scene.tsx`).

### Orte

```bash
npm run orte
```

Prüft die Bauplätze der Sehenswürdigkeiten. Der Stuntpark braucht ebenen
Boden: Rampen, Plattform und Container sind gerade Körper und würden im Hang
mit einer Ecke in der Luft hängen. `ebneFlaeche` in `heightmap.ts` ebnet die
Fläche deshalb ein – **bevor** der Kollisionskörper gebaut wird.

| Messung | Wert |
|---|---|
| Höhenabweichung im Park (Radius 52 m) | 0,000 m |
| Abstand des Parks zur nächsten Straße | 103 m (eingeebnet wird bis 88 m) |
| Höhenänderung auf dem Rundkurs | 0,0000 m (keine Straße verbogen) |
| Bauplätze am Straßenrand | 10–12 m neben der Fahrbahn, Front zur Straße |

Ein Fehler, den dieser Test gefunden hat: Nach dem Einebnen war die neue
flache Fläche der beste Platz für das **Dorf** – also verschob sich bei der
nächsten Suche der Stuntpark um 600 m, und die Kartenmarker zeigten ins Leere.
Seitdem merkt sich `orte.ts` jeden Ort pro Welt und sucht ihn nur einmal.

## Nützliche Hinweise

- **Achsen:** `+Z` ist die Fahrtrichtung, `+Y` ist oben, `+X` ist links.
- **Debug-Ansicht:** `?debug` an die URL hängen zeigt die Kollisionskörper als
  Drahtgitter.
- **Weniger Effekte** bei schwacher Grafikleistung: `?sparsam` an die URL
  hängen. Dann laufen nur noch Tonwertkurve und Kantenglättung.
- **Telemetrie in der Konsole:** im Dev-Modus `telemetrie` oder `rennen` in die
  Browser-Konsole tippen.
- **Fahrverhalten ändern:** `src/game/config/vehicleConfig.ts` – alles dort ist
  kommentiert.
- **Landschaft ändern:** `WELT` in `src/game/world/heightmap.ts`. `keim` ist der
  Zufallskeim, eine andere Zahl ergibt eine andere Landschaft.
- **Strecke ändern:** `STRECKE` in `src/game/world/strecke.ts`.
- **Rennen ändern:** `RENNEN_EINSTELLUNGEN` in `src/game/race/rennen.ts`
  (Rundenzahl, Anzahl Kontrollpunkte, Lage der Startzone).
- **Heuballen ändern:** `HAUFEN` in `src/game/world/Heuballen.tsx`
  (Anzahl der Haufen, Ballen je Haufen, Gewicht, Wiederaufbauzeit).
- **Gelände ändern:** `OFFROAD` und `PISTEN_WEGE()` in
  `src/game/world/Offroad.tsx` (Pistenverlauf, Rampen, Felsblöcke).
- **Landschaft ändern:** `DEKO` in `src/game/world/Deko.tsx`.
- **Logo ändern:** `src/game/ui/Logo.tsx` (SVG im Code) und das Tab-Symbol in
  `index.html`.

## Weitere Befehle

```bash
npm run build      # Produktions-Build
npm run preview    # Produktions-Build lokal ansehen
npm run typecheck  # TypeScript prüfen
npm run icons      # App-Symbole aus public/icon.svg neu erzeugen
```

## Nächste Schritte

- Weitere Aktivitäten in der offenen Welt (Zeitfahrten, Punkte fürs Springen)
- Cascaded Shadow Maps statt eines mitwandernden Schattenbereichs
- LOD für Terrain und Bäume in der Ferne
- Motorgeräusch und Reifenquietschen
