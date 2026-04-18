interface Props {
  show: boolean
  onClose: () => void
  onSave: () => void
  onExportMd: () => void
  onLoad: () => void
  onNew: () => void
}

export default function MenuPanel({ show, onClose, onSave, onExportMd, onLoad, onNew }: Props) {
  if (!show) return null

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={onClose} />
      <div className="mp">
        <button className="mi" onClick={() => { onSave(); onClose() }}>Save</button>
        <button className="mi" onClick={() => { onExportMd(); onClose() }}>Export MD</button>
        <button className="mi" onClick={() => { onLoad(); onClose() }}>Load</button>
        <button className="mi dg" onClick={() => { onNew(); onClose() }}>New</button>
      </div>
    </>
  )
}
