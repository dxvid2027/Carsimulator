/**
 * Erzeugt die PNG-Symbole aus `public/icon.svg`.
 *
 * Warum PNG, wo doch SVG schärfer ist? Weil iOS beim "Zum Home-Bildschirm
 * hinzufügen" ausschließlich PNG akzeptiert – ein SVG ignoriert es und zeigt
 * stattdessen einen Bildschirmausschnitt der Seite.
 *
 * Gerendert wird mit demselben Chromium, das auch die Seite anzeigt. Damit
 * sieht das Symbol garantiert so aus wie das Logo im Spiel.
 *
 * Aufruf:  npm run icons
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

const quelle = readFileSync('public/icon.svg', 'utf8');

/**
 * iOS rundet die Ecken selbst ab. Ein Symbol, das schon abgerundet ist,
 * bekäme dadurch einen dunklen Rand – deshalb für iOS ein volles Quadrat.
 */
const eckig = quelle.replace('rx="27"', 'rx="0"');

interface Auftrag {
  datei: string;
  groesse: number;
  svg: string;
  /** Durchsichtig außerhalb der abgerundeten Ecken? */
  transparent: boolean;
}

const auftraege: Auftrag[] = [
  { datei: 'public/apple-touch-icon.png', groesse: 180, svg: eckig, transparent: false },
  { datei: 'public/icon-192.png', groesse: 192, svg: quelle, transparent: true },
  { datei: 'public/icon-512.png', groesse: 512, svg: quelle, transparent: true },
  // Maskierbares Symbol für Android: Der Inhalt muss innerhalb eines Kreises
  // liegen, weil das System beliebig zuschneidet – deshalb ohne Rundung.
  { datei: 'public/icon-maskable-512.png', groesse: 512, svg: eckig, transparent: false },
];

async function bauen(browser: Browser, a: Auftrag) {
  const seite = await browser.newPage({
    viewport: { width: a.groesse, height: a.groesse },
    deviceScaleFactor: 1,
  });
  await seite.setContent(
    `<!doctype html><html><body style="margin:0">${a.svg.replace(
      /width="120" height="120"/,
      `width="${a.groesse}" height="${a.groesse}"`,
    )}</body></html>`,
  );
  const bild = await seite.screenshot({ omitBackground: a.transparent });
  writeFileSync(a.datei, bild);
  await seite.close();
  console.log(`   ${a.datei.padEnd(34)} ${a.groesse} x ${a.groesse} px`);
}

console.log('\n=== App-Symbole erzeugen ===\n');
/*
  Normalerweise findet Playwright seinen Browser selbst. In Umgebungen, in
  denen ein fertiges Chromium woanders liegt, kann der Pfad über die
  Umgebungsvariable CHROMIUM_PFAD gesetzt werden.
*/
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
for (const a of auftraege) await bauen(browser, a);
await browser.close();
console.log('\nFertig. Die Dateien liegen in public/.\n');
