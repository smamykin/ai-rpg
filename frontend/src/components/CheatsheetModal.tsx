import { useEffect } from 'react'

interface Props {
  show: boolean
  onClose: () => void
}

const K = ({ children }: { children: React.ReactNode }) => <kbd className="kbd">{children}</kbd>

export default function CheatsheetModal({ show, onClose }: Props) {
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, onClose])

  if (!show) return null

  return (
    <>
      <div className="mov" onClick={onClose} />
      <div className="mdl" style={{ maxWidth: 640 }}>
        <div className="mdl-h">Cheatsheet</div>

        <div className="chs">
          <section>
            <h4>Action input &mdash; silent expansions</h4>
            <div className="chs-row">
              <div><code>l</code></div><div>I look around</div>
              <div><code>l &lt;X&gt;</code></div><div>I look at X <span style={{ color: 'var(--mt)' }}>(or <code>I look {'<prep>'} X</code> if X starts with <em>at / around / into / in / under / behind / through / up / down / over / toward</em>)</span></div>
              <div><code>x &lt;X&gt;</code></div><div>I examine X</div>
              <div><code>i</code></div><div>I check my inventory</div>
              <div><code>g &lt;dir&gt;</code></div><div>I go &lt;dir&gt;</div>
              <div><code>s &lt;text&gt;</code></div><div>I say: "&lt;text&gt;" &mdash; or <code>I ask:</code> if text ends with <code>?</code></div>
            </div>
          </section>

          <section>
            <h4>Action input &mdash; keys</h4>
            <div className="chs-row">
              <div><K>Enter</K></div><div>Submit action</div>
              <div><K>Shift</K>+<K>Enter</K></div><div>New line</div>
              <div><K>Tab</K></div><div>Continue the story (when input is empty)</div>
            </div>
          </section>

          <section>
            <h4>Global keys</h4>
            <div className="chs-row">
              <div><K>1</K> <K>2</K> <K>3</K> <K>4</K> <K>5</K></div><div>Toggle Story / Gallery / Tracking / Settings / Prompt panel</div>
              <div><K>o</K></div><div>Toggle outline &amp; session menu</div>
              <div><K>a</K></div><div>Toggle arc guidance bar</div>
              <div><K>/</K></div><div>Focus the action input</div>
              <div><K>Esc</K></div><div>Close panels, outline, modals</div>
              <div><K>?</K></div><div>Show this cheatsheet</div>
            </div>
          </section>

          <section>
            <h4>Story text</h4>
            <div className="chs-row">
              <div>Click a past turn</div><div>Edit the turn in the rich editor</div>
              <div>Select text</div><div>Toolbar appears: <strong>Fix</strong>, <strong>Make it&hellip;</strong>, <strong>Read aloud</strong></div>
              <div><K>Ctrl</K>/<K>&#8984;</K>+<K>Enter</K></div><div>Save editor modals</div>
              <div>Pin icon (during gen)</div><div>Follow the stream / detach to scroll freely</div>
            </div>
          </section>

          <section>
            <h4>Lightbox (image viewer)</h4>
            <div className="chs-row">
              <div><K>&larr;</K> <K>&rarr;</K></div><div>Previous / next image</div>
              <div><K>Esc</K></div><div>Close</div>
              <div>Pin</div><div>Use image as ambient background</div>
            </div>
          </section>

          <section>
            <h4>Mobile gestures</h4>
            <div className="chs-row">
              <div>Swipe left</div><div>Open session panel (or close outline)</div>
              <div>Swipe right</div><div>Open outline (or close session panel)</div>
            </div>
          </section>
        </div>

        <div className="mdl-f">
          <button className="b ba" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  )
}
