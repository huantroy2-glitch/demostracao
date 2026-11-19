import { useEffect } from "react";
import { useUI } from "./store";

function formatClock(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = Math.floor(minutes % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function MiniMap({ x = 0, z = -58, yaw = Math.PI }: { x?: number; z?: number; yaw?: number }) {
  const px = Math.max(4, Math.min(96, ((x + 60) / 120) * 100));
  const py = Math.max(4, Math.min(116, ((z + 100) / 128) * 120));
  return (
    <div className="game-minimap" aria-label="Minimapa do bairro">
      <div className="game-minimap__heading">BAIRRO · GPS</div>
      <svg viewBox="0 0 100 120" role="img" aria-label="Mapa simplificado das ruas">
        <path d="M0 94 H100 M50 94 V42 A9 9 0 0 1 50 24 A9 9 0 0 1 50 42" />
        <path d="M0 94 H100" className="game-minimap__avenue" />
        <path d="M50 94 V42 A9 9 0 0 1 50 24" className="game-minimap__street" />
        <path d="M11 13 H89 M11 108 H89 M10 13 V108 M90 13 V108" className="game-minimap__boundary" />
        <circle cx="50" cy="63" r="13" className="game-minimap__park" />
        <circle cx="50" cy="63" r="4" className="game-minimap__pool" />
        <circle cx={px} cy={py} r="3.2" className="game-minimap__player" />
        <path d={`M${px} ${py - 6} l-2.5 5 h5 z`} className="game-minimap__arrow" transform={`rotate(${(yaw * 180) / Math.PI} ${px} ${py})`} />
      </svg>
      <div className="game-minimap__footer"><span>AVENIDA</span><span>PARQUE</span></div>
    </div>
  );
}

export function GameHud({ onStart }: { onStart: () => void }) {
  const started = useUI((s) => s.started);
  const locked = useUI((s) => s.locked);
  const prompt = useUI((s) => s.prompt);
  const money = useUI((s) => s.money);
  const playerX = useUI((s) => s.playerX);
  const playerZ = useUI((s) => s.playerZ);
  const playerYaw = useUI((s) => s.playerYaw);
  const clock = useUI((s) => s.clock);
  const dialog = useUI((s) => s.dialog);
  const toast = useUI((s) => s.toast);
  const showHelp = useUI((s) => s.showHelp);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => useUI.getState().set({ toast: null }), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="game-hud">
      <div className="game-brand">
        <span className="game-brand__mark">B</span>
        <span><strong>BAIRRO</strong><small>VIDA DE RUA</small></span>
      </div>

      <div className="game-stats">
        <div className="game-stat"><span>DINHEIRO</span><strong>${money.toLocaleString("pt-PT")}</strong></div>
        <div className="game-stat"><span>HORA</span><strong>{formatClock(clock)}</strong></div>
      </div>

      {started && <MiniMap x={playerX} z={playerZ} yaw={playerYaw} />}

      {started && showHelp && !dialog && (
        <div className="game-help">
          <div className="game-help__title">CONTROLOS</div>
          <div><kbd>W A S D</kbd><span>Mover</span></div>
          <div><kbd>SHIFT</kbd><span>Correr / sprint</span></div>
          <div><kbd>ESPAÇO</kbd><span>Saltar</span></div>
          <div><kbd>Q</kbd><span>Rolar</span></div>
          <div><kbd>C</kbd><span>Agachar</span></div>
          <div><kbd>E</kbd><span>Interagir / sentar</span></div>
          <div><kbd>RATO</kbd><span>Olhar à volta</span></div>
          <div className="game-help__tip">Pressiona <kbd>H</kbd> para ocultar</div>
        </div>
      )}

      {started && !dialog && prompt && (
        <div className="game-prompt"><kbd>E</kbd><span>{prompt.replace(/^Pressione E para /, "")}</span></div>
      )}

      {dialog && (
        <div className="game-dialog" role="status" aria-live="polite">
          <div className="game-dialog__eyebrow">CONVERSA · {dialog.index}/{dialog.total}</div>
          <strong>{dialog.name}</strong>
          <p>{dialog.text}</p>
          <div className="game-dialog__hint">Pressiona <kbd>E</kbd> para continuar <span>·</span> <kbd>ESC</kbd> para sair</div>
        </div>
      )}

      {toast && <div className="game-toast" role="status">{toast.text}</div>}

      {started && !locked && !dialog && (
        <button className="game-resume" type="button" onClick={onStart}>
          <span>▶</span> CLICA PARA CONTINUAR
        </button>
      )}

      {!started && (
        <div className="game-intro">
          <div className="game-intro__eyebrow">UM MUNDO ABERTO · ANGOLA</div>
          <h1>O BAIRRO<br /><em>É TEU.</em></h1>
          <p>Explora as ruas, conhece a malta, descobre o parque e apanha os pacotes espalhados pelo bairro.</p>
          <button type="button" onClick={onStart}>ENTRAR NO BAIRRO <span>↗</span></button>
          <div className="game-intro__keys"><kbd>WASD</kbd> mover <i /> <kbd>SHIFT</kbd> correr <i /> <kbd>E</kbd> interagir</div>
        </div>
      )}

      <div className="game-version">PRÉ-VISUALIZAÇÃO · ALPHA</div>
    </div>
  );
}
