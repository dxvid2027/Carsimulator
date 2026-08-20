/**
 * Zutrittskontrolle für die Seite – der Teil, den Server und Anmeldeseite
 * gemeinsam brauchen.
 *
 * Warum überhaupt auf dem Server? Ein Passwort, das nur im Browser geprüft
 * wird, ist keine Sperre: Wer die Seite öffnet, hat den Prüfcode schon
 * heruntergeladen und kann ihn lesen oder umgehen. Außerdem müsste jedes
 * Gerät sein eigenes Passwort festlegen – "der Erste bestimmt es" gäbe es
 * dann gar nicht.
 *
 * Hier läuft die Prüfung deshalb in einer Cloudflare Pages Function, und das
 * Passwort liegt in einem KV-Speicher. Der Browser bekommt nur ein Ticket
 * (Cookie), mit dem er die Seiten abrufen darf.
 */

/**
 * Der kleinste Teil eines Cloudflare-KV-Speichers, den wir brauchen.
 *
 * Eigener Typ statt der Abhängigkeit `@cloudflare/workers-types`: Das Projekt
 * bleibt dadurch ohne zusätzliches Paket, und für drei Methoden lohnt sich
 * das nicht.
 */
export interface KvSpeicher {
  get(schluessel: string): Promise<string | null>;
  put(schluessel: string, wert: string): Promise<void>;
}

/** Die Bindungen, die Cloudflare der Function mitgibt. */
export interface Umgebung {
  /** KV-Namespace, in den Passwort und Cookie-Geheimnis geschrieben werden. */
  PASSWORT?: KvSpeicher;
}

/** Name des Tickets im Browser. */
export const COOKIE_NAME = 'cs_zutritt';
/** So lange bleibt man angemeldet. */
const GUELTIG_SEKUNDEN = 60 * 60 * 24 * 30;
/** Mindestlänge, damit niemand "1" als Passwort setzt. */
export const MIN_LAENGE = 4;

const SCHLUESSEL_PASSWORT = 'passwort';
const SCHLUESSEL_GEHEIMNIS = 'cookie-geheimnis';

/*
  Wie oft das Passwort durch die Hashfunktion geschickt wird.

  Mehr Runden machen das Ausprobieren von Passwörtern teurer. Gleichzeitig hat
  eine Cloudflare-Function nur wenig Rechenzeit pro Aufruf – 12.000 Runden sind
  der Mittelweg: für einen Angreifer teuer, für einen Anmeldevorgang schnell.
*/
const RUNDEN = 12000;

interface GespeichertesPasswort {
  salz: string;
  hash: string;
}

/** Bytes als Hex-Text. */
function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Zufälliger Hex-Text mit `anzahl` Bytes. */
function zufallHex(anzahl: number): string {
  const b = new Uint8Array(anzahl);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Vergleich, der immer gleich lange dauert.
 *
 * Ein normaler Vergleich mit `===` bricht beim ersten falschen Zeichen ab.
 * Aus der Antwortzeit ließe sich dann Zeichen für Zeichen erraten, wie der
 * richtige Wert anfängt.
 */
function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

/**
 * Passwort zu einem Hash rechnen (PBKDF2).
 *
 * Gespeichert wird nie das Passwort selbst, sondern nur dieser Wert. Aus ihm
 * lässt sich das Passwort nicht zurückrechnen. Das Salz sorgt dafür, dass
 * gleiche Passwörter trotzdem verschiedene Hashes ergeben.
 */
async function hashRechnen(passwort: string, salz: string): Promise<string> {
  const schluessel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passwort),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salz),
      iterations: RUNDEN,
      hash: 'SHA-256',
    },
    schluessel,
    256,
  );
  return hex(bits);
}

/** Liest das gespeicherte Passwort, oder null, wenn noch keines gesetzt ist. */
export async function passwortLesen(kv: KvSpeicher): Promise<GespeichertesPasswort | null> {
  const roh = await kv.get(SCHLUESSEL_PASSWORT);
  if (!roh) return null;
  try {
    return JSON.parse(roh) as GespeichertesPasswort;
  } catch {
    return null;
  }
}

/** Ist überhaupt schon ein Passwort gesetzt? */
export async function passwortGesetzt(kv: KvSpeicher): Promise<boolean> {
  return (await passwortLesen(kv)) !== null;
}

/**
 * Setzt das Passwort – aber nur, wenn noch keines existiert.
 *
 * Genau das ist die Regel "der Erste bestimmt das Passwort". Danach kommt
 * niemand mehr an diesen Weg heran.
 */
export async function passwortSetzen(kv: KvSpeicher, passwort: string): Promise<boolean> {
  if (await passwortGesetzt(kv)) return false;
  const salz = zufallHex(16);
  const hash = await hashRechnen(passwort, salz);
  await kv.put(SCHLUESSEL_PASSWORT, JSON.stringify({ salz, hash }));
  return true;
}

/** Prüft ein eingegebenes Passwort gegen das gespeicherte. */
export async function passwortStimmt(kv: KvSpeicher, passwort: string): Promise<boolean> {
  const gespeichert = await passwortLesen(kv);
  if (!gespeichert) return false;
  const hash = await hashRechnen(passwort, gespeichert.salz);
  return gleich(hash, gespeichert.hash);
}

/**
 * Das Geheimnis, mit dem die Tickets unterschrieben werden.
 *
 * Es wird beim ersten Bedarf erzeugt und dann behalten. Ohne Unterschrift
 * könnte sich jeder selbst ein gültiges Ticket ausstellen.
 */
async function geheimnis(kv: KvSpeicher): Promise<string> {
  const vorhanden = await kv.get(SCHLUESSEL_GEHEIMNIS);
  if (vorhanden) return vorhanden;
  const neu = zufallHex(32);
  await kv.put(SCHLUESSEL_GEHEIMNIS, neu);
  return neu;
}

/** Unterschrift über den Ablaufzeitpunkt. */
async function unterschrift(kv: KvSpeicher, ablauf: number): Promise<string> {
  const schluessel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(await geheimnis(kv)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    schluessel,
    new TextEncoder().encode(`v1|${ablauf}`),
  );
  return hex(sig);
}

/** Stellt ein Ticket aus (Ablaufzeit + Unterschrift). */
export async function ticketErzeugen(kv: KvSpeicher): Promise<string> {
  const ablauf = Math.floor(Date.now() / 1000) + GUELTIG_SEKUNDEN;
  return `${ablauf}.${await unterschrift(kv, ablauf)}`;
}

/** Prüft ein Ticket: richtige Unterschrift und noch nicht abgelaufen? */
export async function ticketGueltig(kv: KvSpeicher, ticket: string): Promise<boolean> {
  const punkt = ticket.indexOf('.');
  if (punkt < 1) return false;
  const ablauf = Number(ticket.slice(0, punkt));
  if (!Number.isFinite(ablauf) || ablauf < Math.floor(Date.now() / 1000)) return false;
  return gleich(ticket.slice(punkt + 1), await unterschrift(kv, ablauf));
}

/** Der fertige Set-Cookie-Kopfzeilenwert für ein Ticket. */
export function cookieKopf(ticket: string): string {
  /*
    HttpOnly: JavaScript im Browser kommt nicht an das Ticket heran.
    Secure:   wird nur über HTTPS mitgeschickt.
    SameSite: verhindert, dass fremde Seiten es mitschicken lassen.
  */
  return `${COOKIE_NAME}=${ticket}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${GUELTIG_SEKUNDEN}`;
}

/** Liest einen Cookie aus der Anfrage. */
export function cookieLesen(request: Request, name: string): string | null {
  const kopf = request.headers.get('Cookie');
  if (!kopf) return null;
  for (const teil of kopf.split(';')) {
    const trennung = teil.indexOf('=');
    if (trennung < 0) continue;
    if (teil.slice(0, trennung).trim() === name) return teil.slice(trennung + 1).trim();
  }
  return null;
}

/** Darf diese Anfrage die Seite sehen? */
export async function zutrittErlaubt(request: Request, kv: KvSpeicher): Promise<boolean> {
  const ticket = cookieLesen(request, COOKIE_NAME);
  if (!ticket) return false;
  return ticketGueltig(kv, ticket);
}
