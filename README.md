# Carsimulator

3D-Open-World-Fahrspiel im Browser (Prototyp im Stil von Forza Horizon).

**Stand: Phase 2 – fahrbares Auto auf 1 × 1 km Hügel-Terrain, spielbar auch auf dem iPad.**

## Schnellstart

```bash
npm install
npm run dev
```

Dann `http://localhost:5173` im Browser öffnen und ins Bild klicken, damit die
Tastatureingaben ankommen.

## Steuerung (Tastatur)

| Taste | Funktion |
|---|---|
| `W` / `↑` | Gas |
| `S` / `↓` | Bremse, im Stand Rückwärtsgang |
| `A` `D` / `←` `→` | Lenken |
| `Leertaste` | Handbremse (Drift) |
| `C` | Kamera umschalten: Verfolger → Nah → Cockpit → Übersicht |
| `R` | Auto zurücksetzen |

Ein Gamepad wird automatisch erkannt: RT = Gas, LT = Bremse,
linker Stick = Lenken, A-Taste = Handbremse.

## Steuerung (iPad, Handy)

Auf Touchgeräten erscheinen automatisch Bedienelemente auf dem Bildschirm:

- **links unten** – Lenkzone. Wo du zuerst hintippst, ist die Mitte. Ziehst du
  von dort nach links oder rechts, lenkt das Auto entsprechend. Du musst also
  nicht zielen und kannst blind bedienen.
- **rechts unten** – Gas, Bremse, Handbremse zum Halten.
- **rechts oben** – Kamera umschalten und Reset.

Am besten im **Querformat** spielen. Hochkant besteht das halbe Bild aus Himmel.

Zum Ausprobieren am Rechner: `?touch` an die URL hängen erzwingt die
Touch-Bedienung, `?keyboard` erzwingt die Tastatur-Ansicht.

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

Die Node-Version steht in der Datei `.node-version` (22), darum muss man sie
in Cloudflare nicht extra einstellen.

Nach ein bis zwei Minuten bekommst du eine Adresse wie
`https://carsimulator.pages.dev`. Jeder weitere Push auf den Branch baut die
Seite automatisch neu.

## Was dieser Prototyp kann

- **Raycast-Vehicle über Rapier** – kein Arcade-Würfel, sondern vier Räder mit
  echter Federung, Grip und Radlastverteilung.
- **Drift** – zu viel Gas löst das Heck, die Handbremse blockiert die Hinterräder.
  Eine Gegenlenk-Hilfe macht Drifts auch mit der Tastatur abfangbar.
- **Weiche Verfolgerkamera** mit Nachlauf und tempoabhängigem Sichtfeld.
- **HUD** mit Tacho, Gang, Drehzahlbalken und Drift-Anzeige.

## Ordnerstruktur

```
src/
  main.tsx                  Einstiegspunkt
  App.tsx                   Canvas, HUD, Touch-Bedienung
  styles.css                HUD- und Touch-Styling
  game/
    Scene.tsx               Beleuchtung, Physikwelt, Zusammenbau
    telemetrie.ts           Anzeigewerte ohne React-Re-Render
    config/
      vehicleConfig.ts      ALLE Tuning-Werte des Autos
    input/
      useDrivingInput.ts    Tastatur + Gamepad + Touch zusammenführen
      touchInput.ts         Gemeinsamer Zustand der Touch-Bedienung
    vehicle/
      useRaycastVehicle.ts  Erzeugt Rapiers Fahrzeug-Controller
      fahrlogik.ts          Motor, Bremse, Lenkung, Drift, Luftlage
      Car.tsx               Physikkörper + sichtbare Räder
      CarModel.tsx          Provisorische Karosserie
    world/
      heightmap.ts          Prozedurale Höhendaten + Höhenabfrage
      Terrain.tsx           Sichtbares Terrain (Kacheln) + Heightfield-Kollider
      SunLight.tsx          Sonnenlicht, dessen Schatten dem Auto folgt
      Weltgrenze.tsx        Unsichtbare Wände am Kartenrand
    camera/
      ChaseCamera.tsx       Verfolgerkamera
    ui/
      Hud.tsx               Tacho-Overlay
      TouchControls.tsx     Bedienelemente für iPad und Handy
tools/
  fahrphysik-test.ts        Headless-Test der Fahrphysik
  lenkung-test.ts           Headless-Test des Lenkverhaltens
  terrain-test.ts           Headless-Test des Terrains
```

## Fahrphysik testen ohne zu fahren

```bash
npm run physik
```

Das startet die echte Rapier-Physik ohne Browser und misst Beschleunigung,
Topspeed, Bremsweg, Kurvenstabilität, Drift und die Symmetrie der Lenkung.
Es benutzt **dieselbe** `fahrlogik.ts` und `vehicleConfig.ts` wie das Spiel –
wenn du also einen Wert in `vehicleConfig.ts` änderst, siehst du die Auswirkung
sofort in Zahlen.

Aktuelle Messwerte:

| Messung | Wert |
|---|---|
| 0–100 km/h | 4,97 s |
| Topspeed | 192 km/h |
| Bremsweg 100–0 km/h | 17,9 m |
| Dauerkurve 80 km/h | stabil, kippt nicht |
| Handbremsen-Drift | bis 43°, fängt sich wieder |
| Luftlage nach Sprung | richtet sich auf, landet auf den Rädern |

## Lenkung testen

```bash
npm run lenkung
```

Misst Ansprechzeit, Rückstellung, Überschwingen, Spurwechsel und wie gut sich
ein Drift abfangen lässt.

| Messung | Wert |
|---|---|
| Einschlag im Stand / bei 180 km/h | 31,5° / 17,5° |
| Ansprechzeit im Stand | 0,23 s |
| Rückstellung in die Mitte | 0,13 s |
| Überschwingen bei 60/120/180 km/h | 1 % / 2 % / 2 % |
| kleine Lenkbewegung bei 180 km/h | 25,9 °/s Drehrate (ruhig) |
| Drift abfangen | 1,4 s |

Die Lenkung ist bewusst asymmetrisch: **Einlenken geht langsamer als
Zurückstellen.** Beim Einlenken dosiert man, beim Zurückstellen will man sofort
wieder geradeaus - das ist der größte Unterschied zwischen "schwammig" und
"direkt". Zusätzlich werden bei hohem Tempo sowohl der Einschlag als auch die
Einlenkgeschwindigkeit reduziert.

Bricht das Heck aus, lenkt das Spiel automatisch ein Stück mit
(`lenkung.gegenlenkHilfe`). Mit der Tastatur gibt es nur "ganz links" oder
"ganz rechts" - fein dosiertes Gegenlenken wäre damit unmöglich.

**Wichtig fürs Fahrgefühl ist auch die Grip-Verteilung**, nicht nur die Lenkung
selbst: Hat die Hinterachse weniger Halt als die Vorderachse, dreht sich das
Auto bei Tempo schon bei leichtem Einlenken weg. Deshalb hat die Hinterachse
hier mehr Halt (`grip.hinten > grip.vorne`), wie bei jedem Serienauto.

## Terrain testen

```bash
npm run terrain
```

Prüft die wichtigste Fehlerquelle beim Terrain: ob Rapiers Kollisionskörper
exakt zu den Höhen passt, die auch das sichtbare Mesh benutzt. Stimmt das
nicht, schwebt das Auto über dem Boden oder versinkt darin – visuell übersieht
man das leicht.

| Messung | Wert |
|---|---|
| Größe | 1000 × 1000 m, 257 × 257 Höhenpunkte (3,91 m je Zelle) |
| Höhenbereich | −20,8 m bis +22,6 m |
| Kollider vs. Höhen-Array | 0,0000 m Fehler auf Gitterpunkten |
| Startbereich | flach im Radius 60 m |
| steilste Stelle | 21° |

## Nützliche Hinweise

- **Achsen:** `+Z` ist die Fahrtrichtung, `+Y` ist oben, `+X` ist links.
- **Landschaft ändern:** die Werte in `WELT` in `src/game/world/heightmap.ts`.
  `keim` ist der Zufallskeim – eine andere Zahl ergibt eine andere Landschaft.
- **Debug-Ansicht:** `http://localhost:5173/?debug` zeigt die Kollisionskörper
  als Drahtgitter.
- **Telemetrie in der Konsole:** im Dev-Modus einfach `telemetrie` in die
  Browser-Konsole tippen.
- **Tuning:** Fast alles Fahrverhalten steckt in `src/game/config/vehicleConfig.ts`
  und ist dort kommentiert.

## Weitere Befehle

```bash
npm run build      # Produktions-Build
npm run preview    # Produktions-Build lokal ansehen
npm run typecheck  # TypeScript prüfen
```

## Nächste Schritte

- 1 × 1 km Terrain aus einer Heightmap
- Asphaltstraße als geschlossener Rundkurs
- Bäume und Leitplanken als Instanced Meshes
- HDRI-Environment, Cascaded Shadows, Postprocessing (Bloom, SSAO)
- Rundenzeit im HUD
- LOD und Frustum Culling
