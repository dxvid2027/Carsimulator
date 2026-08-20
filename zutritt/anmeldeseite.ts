import { MIN_LAENGE } from './gemeinsam';

/**
 * Die Anmeldeseite.
 *
 * Sie ist absichtlich eine einzelne, in sich geschlossene HTML-Seite und
 * nicht Teil des Spiels: Wer kein Passwort hat, soll gar nichts vom Spiel
 * geliefert bekommen – auch keine JavaScript-Dateien und keine Bilder.
 *
 * Der Text ist englisch wie der Rest der Oberfläche, die Kommentare deutsch.
 */
export function anmeldeSeite(gesetzt: boolean): string {
  const titel = gesetzt ? 'Password required' : 'Set the password';
  const hinweis = gesetzt
    ? 'This page is private. Enter the password to play.'
    : 'Nobody has set a password yet. You are first — the password you choose here is the one everyone will need from now on.';
  const knopf = gesetzt ? 'Enter' : 'Set password and enter';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Carsimulator</title>
<link rel="icon" type="image/svg+xml" href="/icon.svg" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center;
    background: #0b0e13; color: #e8edf4; padding: 24px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .karte {
    width: min(420px, 100%); background: #151b24; border: 1px solid #253040;
    border-radius: 18px; padding: 28px 26px 24px; text-align: center;
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }
  h1 { font-size: 22px; margin: 14px 0 6px; }
  p { color: #9fb0c4; font-size: 14px; line-height: 1.5; margin: 0 0 18px; }
  input {
    width: 100%; padding: 13px 14px; font-size: 16px; border-radius: 11px;
    border: 1px solid #2c3a4d; background: #0d1219; color: #e8edf4;
    margin-bottom: 10px;
  }
  input:focus { outline: 2px solid #4fb0f7; outline-offset: 1px; }
  button {
    width: 100%; padding: 14px; font-size: 16px; font-weight: 600;
    border: 0; border-radius: 11px; background: #4fb0f7; color: #06111c;
    cursor: pointer; margin-top: 4px;
  }
  button:disabled { opacity: 0.6; cursor: default; }
  .fehler { color: #ff8f7a; font-size: 14px; min-height: 20px; margin-top: 10px; }
  img { width: 74px; height: 74px; border-radius: 17px; }
</style>
</head>
<body>
  <div class="karte">
    <img src="/icon.svg" alt="" />
    <h1>${titel}</h1>
    <p>${hinweis}</p>
    <form id="formular">
      <input id="passwort" type="password" placeholder="Password"
             autocomplete="${gesetzt ? 'current-password' : 'new-password'}" required />
      ${gesetzt ? '' : '<input id="wiederholung" type="password" placeholder="Repeat password" autocomplete="new-password" required />'}
      <button id="knopf" type="submit">${knopf}</button>
    </form>
    <div class="fehler" id="fehler"></div>
  </div>
<script>
  var gesetzt = ${gesetzt ? 'true' : 'false'};
  var formular = document.getElementById('formular');
  var fehler = document.getElementById('fehler');
  var knopf = document.getElementById('knopf');

  formular.addEventListener('submit', async function (e) {
    e.preventDefault();
    var passwort = document.getElementById('passwort').value;
    if (!gesetzt) {
      var wdh = document.getElementById('wiederholung').value;
      if (passwort !== wdh) { fehler.textContent = 'The two passwords do not match.'; return; }
      if (passwort.length < ${MIN_LAENGE}) {
        fehler.textContent = 'Please use at least ${MIN_LAENGE} characters.';
        return;
      }
    }
    fehler.textContent = '';
    knopf.disabled = true;
    try {
      var antwort = await fetch('/api/passwort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwort: passwort })
      });
      var daten = await antwort.json();
      if (daten.ok) { location.reload(); return; }
      fehler.textContent = daten.meldung || 'Wrong password.';
    } catch (err) {
      fehler.textContent = 'Connection problem. Please try again.';
    }
    knopf.disabled = false;
  });
</script>
</body>
</html>`;
}

/**
 * Hinweisseite, wenn der KV-Speicher fehlt.
 *
 * Ohne ihn kann niemand ein Passwort setzen oder prüfen. Die Seite dann
 * einfach freizugeben wäre falsch – dann stünde das Spiel offen, obwohl es
 * geschützt sein soll. Also gibt es hier eine Anleitung statt des Spiels.
 */
export function einrichtungsSeite(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Setup needed</title>
<style>
  body { margin:0; min-height:100dvh; display:grid; place-items:center; background:#0b0e13;
         color:#e8edf4; font-family: system-ui, sans-serif; padding:24px; }
  .karte { max-width: 560px; background:#151b24; border:1px solid #253040; border-radius:18px;
           padding:28px; line-height:1.6; }
  h1 { font-size:20px; margin:0 0 12px; }
  code { background:#0d1219; padding:2px 6px; border-radius:6px; }
  ol { padding-left: 20px; color:#c3d0de; }
</style>
</head>
<body>
  <div class="karte">
    <h1>One setup step is missing</h1>
    <p>The password lock needs a place to store the password. In Cloudflare:</p>
    <ol>
      <li>Storage &amp; Databases → KV → <b>Create namespace</b>, name it <code>carsimulator-passwort</code></li>
      <li>Workers &amp; Pages → your project → Settings → <b>Bindings</b> → Add → KV namespace</li>
      <li>Variable name: <code>PASSWORT</code> — Namespace: the one you just created</li>
      <li>Save and redeploy</li>
    </ol>
  </div>
</body>
</html>`;
}
