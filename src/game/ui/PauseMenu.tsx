import type { Steuerungsart } from '../spielzustand';

interface PauseMenuProps {
  steuerung: Steuerungsart;
  onFortsetzen: () => void;
  onZuruecksetzen: () => void;
  onSteuerungWechseln: (art: Steuerungsart) => void;
}

/** Pausemenü. Solange es offen ist, steht die Physik still. */
export function PauseMenu({
  steuerung,
  onFortsetzen,
  onZuruecksetzen,
  onSteuerungWechseln,
}: PauseMenuProps) {
  return (
    <div className="pause">
      <div className="pause-box">
        <div className="pause-titel">Paused</div>

        <button className="pause-knopf haupt" onClick={onFortsetzen}>
          Resume
        </button>
        <button className="pause-knopf" onClick={onZuruecksetzen}>
          Reset car to start
        </button>

        <div className="pause-trenner" />

        <div className="pause-label">Controls</div>
        <div className="pause-umschalter">
          <button
            className={steuerung === 'keyboard' ? 'aktiv' : ''}
            onClick={() => onSteuerungWechseln('keyboard')}
          >
            Keyboard
          </button>
          <button
            className={steuerung === 'touch' ? 'aktiv' : ''}
            onClick={() => onSteuerungWechseln('touch')}
          >
            Touch
          </button>
        </div>

        <div className="pause-hilfe">
          {steuerung === 'keyboard' ? (
            <>
              <div>
                <b>W A S D</b> / arrows — drive
              </div>
              <div>
                <b>Space</b> — handbrake
              </div>
              <div>
                <b>C</b> — change camera
              </div>
              <div>
                <b>R</b> — reset car
              </div>
              <div>
                <b>E</b> — start race (in the start zone)
              </div>
              <div>
                <b>Esc</b> or <b>P</b> — pause
              </div>
            </>
          ) : (
            <>
              <div>Left pad — steer</div>
              <div>Right buttons — throttle, brake, handbrake</div>
              <div>Top right — camera, reset, pause</div>
              <div>Race starts at the glowing gate on the road</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
