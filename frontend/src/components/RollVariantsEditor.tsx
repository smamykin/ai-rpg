import { X, Plus } from 'lucide-react'
import type { RollVariant, DiceSpec } from '../types'
import { uid } from '../types'
import { parseDice } from '../utils/dice'
import ModalTextField from './ModalTextField'

interface Props {
  variants: RollVariant[]
  diceRules: string
  onChange: (next: RollVariant[]) => void
  onDiceRulesChange: (next: string) => void
}

const EXAMPLE_RULES_TEXT = 'Roll the dice and sum the results. 2 = success, 1 = miss. On success, the player gets their way; on a miss, something goes wrong — narrate a light complication.'

function newVariant(): RollVariant {
  return { id: uid('rv'), name: '', dice: [{ dice: '1d6', type: '' }] }
}

export default function RollVariantsEditor({ variants, diceRules, onChange, onDiceRulesChange }: Props) {
  const updateVariant = (id: string, patch: Partial<RollVariant>) => {
    onChange(variants.map(v => v.id === id ? { ...v, ...patch } : v))
  }

  const removeVariant = (id: string) => {
    onChange(variants.filter(v => v.id !== id))
  }

  const addVariant = () => {
    onChange([...variants, newVariant()])
  }

  const addDie = (vid: string) => {
    const v = variants.find(x => x.id === vid)
    if (!v) return
    updateVariant(vid, { dice: [...v.dice, { dice: '1d6', type: '' }] })
  }

  const updateDie = (vid: string, idx: number, patch: Partial<DiceSpec>) => {
    const v = variants.find(x => x.id === vid)
    if (!v) return
    updateVariant(vid, { dice: v.dice.map((d, i) => i === idx ? { ...d, ...patch } : d) })
  }

  const removeDie = (vid: string, idx: number) => {
    const v = variants.find(x => x.id === vid)
    if (!v) return
    updateVariant(vid, { dice: v.dice.filter((_, i) => i !== idx) })
  }

  const addExample = () => {
    if (!diceRules.trim()) onDiceRulesChange(EXAMPLE_RULES_TEXT)
    onChange([...variants, {
      id: uid('rv'),
      name: 'Coin flip',
      dice: [{ dice: '1d2', type: 'white' }],
    }])
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="gr">
        <label className="lb">Dice rules (shared by every variant)</label>
        <ModalTextField
          className="mt"
          value={diceRules}
          onChange={onDiceRulesChange}
          placeholder="How dice resolve. e.g. roll the dice, sum the results, 2 = success, 1 = miss..."
          lines={3}
          title="Dice rules"
        />
        <div className="hint">
          Hoisted into <code>&lt;dice_rules&gt;</code> whenever the player rolls a variant. Hidden from the prompt the rest of the time.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.6rem', flexWrap: 'wrap' }}>
        <button className="b bs ba" onClick={addVariant}><Plus size={14} className="ic" /> New variant</button>
        <button className="b bs" onClick={addExample} title="Append an example variant (and sample rules text if missing)">Add example</button>
      </div>

      {variants.length === 0 && (
        <p style={{ color: 'var(--mt)', fontSize: '.85rem', textAlign: 'center', padding: '1rem 0' }}>
          No roll variants yet. Create one to enable dice in the chevron menu next to Continue.
        </p>
      )}

      {variants.map(v => (
        <div key={v.id} className="sc">
          <div className="sh">
            <input
              type="text"
              value={v.name}
              onChange={e => updateVariant(v.id, { name: e.target.value })}
              placeholder="Variant name (e.g. Combat, Stealth check)"
              style={{ flex: 1, fontWeight: 600, fontSize: '.88rem', color: 'var(--ac)', padding: '.3rem .45rem', marginRight: '.4rem' }}
            />
            <button
              className="b bs"
              onClick={() => removeVariant(v.id)}
              style={{ padding: '.15rem .4rem', fontSize: '.68rem' }}
              aria-label="Remove variant"
            ><X size={12} className="ic ic-muted" /></button>
          </div>

          <label className="lb" style={{ marginTop: '.15rem' }}>Dice</label>
          {v.dice.map((d, i) => {
            const valid = !!parseDice(d.dice)
            return (
              <div key={i} style={{ display: 'flex', gap: '.3rem', marginBottom: '.3rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={d.dice}
                  onChange={e => updateDie(v.id, i, { dice: e.target.value })}
                  placeholder="2d6"
                  style={{ width: '5.5rem', fontSize: '.82rem', padding: '.3rem .45rem', borderColor: valid ? undefined : 'var(--dng)' }}
                />
                <input
                  type="text"
                  value={d.type}
                  onChange={e => updateDie(v.id, i, { type: e.target.value })}
                  placeholder="type (red, blue, ...)"
                  style={{ flex: 1, fontSize: '.82rem', padding: '.3rem .45rem' }}
                />
                <button
                  className="b bs"
                  onClick={() => removeDie(v.id, i)}
                  disabled={v.dice.length <= 1}
                  style={{ padding: '.15rem .4rem' }}
                  aria-label="Remove die"
                ><X size={12} className="ic ic-muted" /></button>
              </div>
            )
          })}
          <button className="b bs" onClick={() => addDie(v.id)} style={{ fontSize: '.75rem' }}>
            <Plus size={12} className="ic" /> Add die
          </button>
        </div>
      ))}
    </div>
  )
}
