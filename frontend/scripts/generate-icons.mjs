import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')
const svgSource = readFileSync(resolve(publicDir, 'icon.svg'), 'utf8')

// Wrap the source SVG's drawable contents inside a transform so we can pad
// for maskable icons (Android adaptive masks crop ~10% on each side).
function buildSvg({ padding = 0 } = {}) {
  if (padding === 0) return svgSource
  const scale = (512 - padding * 2) / 512
  const offset = padding
  // Extract everything between <svg ...> and </svg>
  const inner = svgSource.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#0c0a09"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g>
  </svg>`
}

function render(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: '#0c0a09',
  })
  return r.render().asPng()
}

const targets = [
  { name: 'favicon.png', svg: buildSvg(), size: 32 },
  { name: 'apple-touch-icon.png', svg: buildSvg(), size: 180 },
  { name: 'pwa-192.png', svg: buildSvg(), size: 192 },
  { name: 'pwa-512.png', svg: buildSvg(), size: 512 },
  { name: 'pwa-maskable-512.png', svg: buildSvg({ padding: 64 }), size: 512 },
]

for (const { name, svg, size } of targets) {
  const png = render(svg, size)
  writeFileSync(resolve(publicDir, name), png)
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`)
}
