interface Props {
  show: boolean
  onClose: () => void
  onSave: () => void
  onExportMd: () => void
  onLoad: () => void
  onHub: () => void
  onSaveAsScenario?: () => void
  canSaveAsScenario?: boolean
}

export default function MenuPanel({
  show, onClose, onSave, onExportMd, onLoad, onHub, onSaveAsScenario, canSaveAsScenario = true,
}: Props) {
  if (!show) return null

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={onClose} />
      <div className="mp">
        <button className="mi" onClick={() => { onHub(); onClose() }}>Sessions</button>
        {onSaveAsScenario && (
          <button
            className="mi"
            disabled={!canSaveAsScenario}
            style={canSaveAsScenario ? undefined : { opacity: .4, cursor: 'default' }}
            onClick={() => { if (canSaveAsScenario) { onSaveAsScenario(); onClose() } }}
          >Save as Scenario</button>
        )}
        <button className="mi" onClick={() => { onSave(); onClose() }}>Export JSON</button>
        <button className="mi" onClick={() => { onExportMd(); onClose() }}>Export MD</button>
        <button className="mi" onClick={() => { onLoad(); onClose() }}>Import JSON</button>
      </div>
    </>
  )
}
