import { prepare, layout, clearCache } from '../src/layout.ts'
import { TEXTS, SIZES, WIDTHS } from '../src/test-data.ts'

const FONTS = [
  '"Helvetica Neue", Helvetica, Arial, sans-serif',
  'Georgia, "Times New Roman", serif',
  'Verdana, Geneva, sans-serif',
  '"Courier New", Courier, monospace',
]

type Mismatch = {
  font: string
  fontSize: number
  width: number
  actual: number
  predicted: number
  diff: number
  text: string
  diagnostic?: string
}

function runSweep(): { total: number, mismatches: Mismatch[] } {
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;visibility:hidden'
  document.body.appendChild(container)

  const mismatches: Mismatch[] = []
  let total = 0

  for (const fontFamily of FONTS) {
    for (const fontSize of SIZES) {
      const font = `${fontSize}px ${fontFamily}`
      const lineHeight = Math.round(fontSize * 1.2)
      clearCache()

      for (const maxWidth of WIDTHS) {
        const divs: HTMLDivElement[] = []
        const prepared: ReturnType<typeof prepare>[] = []

        for (const { text } of TEXTS) {
          const div = document.createElement('div')
          div.style.font = font
          div.style.lineHeight = `${lineHeight}px`
          div.style.width = `${maxWidth}px`
          div.style.wordWrap = 'break-word'
          div.style.overflowWrap = 'break-word'
          div.textContent = text
          container.appendChild(div)
          divs.push(div)
          prepared.push(prepare(text, font, lineHeight))
        }

        for (let i = 0; i < TEXTS.length; i++) {
          const text = TEXTS[i]!.text
          const actual = divs[i]!.getBoundingClientRect().height
          const predicted = layout(prepared[i]!, maxWidth).height
          total++
          if (Math.abs(actual - predicted) >= 1) {
            // Diagnose: detect where the browser actually breaks lines
            // by wrapping each word in a span and comparing offsetTop
            const diagDiv = document.createElement('div')
            diagDiv.style.font = font
            diagDiv.style.lineHeight = `${lineHeight}px`
            diagDiv.style.width = `${maxWidth}px`
            diagDiv.style.wordWrap = 'break-word'
            diagDiv.style.overflowWrap = 'break-word'

            const normalized = text.replace(/\n/g, ' ')
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
            const segs = [...segmenter.segment(normalized)]
            for (const seg of segs) {
              const span = document.createElement('span')
              span.textContent = seg.segment
              diagDiv.appendChild(span)
            }
            container.appendChild(diagDiv)

            // Read offsetTops to detect browser line breaks
            const spans = diagDiv.querySelectorAll('span')
            const browserLines: string[] = []
            let currentLine = ''
            let lastTop = -1
            for (let si = 0; si < spans.length; si++) {
              const top = spans[si]!.offsetTop
              if (lastTop >= 0 && top > lastTop) {
                browserLines.push(currentLine)
                currentLine = spans[si]!.textContent ?? ''
              } else {
                currentLine += spans[si]!.textContent ?? ''
              }
              lastTop = top
            }
            if (currentLine) browserLines.push(currentLine)
            container.removeChild(diagDiv)

            // Build our algorithm's lines for comparison
            const diagCtx = (new OffscreenCanvas(1,1)).getContext('2d')!
            diagCtx.font = font
            let diagLine = ''
            const ourLines: string[] = []
            for (const seg of segs) {
              const candidate = diagLine + seg.segment
              if (diagLine && diagCtx.measureText(candidate).width > maxWidth && (seg.isWordLike ?? false)) {
                ourLines.push(diagLine)
                diagLine = seg.segment
              } else {
                diagLine = candidate
              }
            }
            if (diagLine) ourLines.push(diagLine)

            const lineDetails: string[] = []
            const maxLines = Math.max(browserLines.length, ourLines.length)
            for (let li = 0; li < maxLines; li++) {
              const ours = (ourLines[li] ?? '').trimEnd()
              const theirs = (browserLines[li] ?? '').trimEnd()
              if (ours !== theirs) {
                lineDetails.push(`L${li+1} ours="${ours.slice(0,40)}" browser="${theirs.slice(0,40)}"`)
              }
            }
            if (lineDetails.length === 0 && browserLines.length !== ourLines.length) {
              lineDetails.push(`ours=${ourLines.length}L browser=${browserLines.length}L (same content, different count?)`)
            }

            mismatches.push({
              font: fontFamily,
              fontSize,
              width: maxWidth,
              actual,
              predicted,
              diff: predicted - actual,
              text,
              diagnostic: lineDetails.length > 0 ? lineDetails.join(' | ') : 'no per-line canvas/DOM diff found',
            })
          }
        }
        container.innerHTML = ''
      }
    }
  }

  document.body.removeChild(container)
  return { total, mismatches }
}

// --- Render ---

function render() {
  const root = document.getElementById('root')!
  root.innerHTML = '<p>Running sweep...</p>'

  requestAnimationFrame(() => {
    const { total, mismatches } = runSweep()
    const matchCount = total - mismatches.length
    const pct = ((matchCount / total) * 100).toFixed(2)

    let html = `
      <div class="summary">
        <span class="big">${matchCount}/${total}</span> match (${pct}%)
        <span class="sep">|</span>
        ${mismatches.length} mismatches
        <span class="sep">|</span>
        ${FONTS.length} fonts × ${SIZES.length} sizes × ${WIDTHS.length} widths × ${TEXTS.length} texts
      </div>
    `

    // Group mismatches by font
    const byFont = new Map<string, Mismatch[]>()
    for (const m of mismatches) {
      const key = m.font
      let arr = byFont.get(key)
      if (!arr) { arr = []; byFont.set(key, arr) }
      arr.push(m)
    }

    // Group within font by size
    for (const [font, ms] of byFont) {
      html += `<h2>${font}</h2>`

      const bySize = new Map<number, Mismatch[]>()
      for (const m of ms) {
        let arr = bySize.get(m.fontSize)
        if (!arr) { arr = []; bySize.set(m.fontSize, arr) }
        arr.push(m)
      }

      for (const [size, sizeMs] of bySize) {
        html += `<h3>${size}px (${sizeMs.length} mismatches)</h3>`
        html += '<table><colgroup><col class="num"><col class="num"><col class="num"><col class="num"><col class="text"></colgroup><tr><th>Width</th><th>Actual</th><th>Predicted</th><th>Diff</th><th>Text</th></tr>'
        for (const m of sizeMs) {
          const cls = m.diff > 0 ? 'over' : 'under'
          const snippet = m.text
          html += `<tr class="${cls}">
            <td>${m.width}px</td>
            <td>${m.actual}px</td>
            <td>${m.predicted}px</td>
            <td>${m.diff > 0 ? '+' : ''}${m.diff}px</td>
            <td class="text">${escapeHtml(snippet)}</td>
          </tr>`
          if (m.diagnostic) {
            html += `<tr class="${cls}"><td colspan="5" class="text" style="color:#888;font-size:11px;padding-left:24px">${escapeHtml(m.diagnostic)}</td></tr>`
          }
        }
        html += '</table>'
      }
    }

    if (mismatches.length === 0) {
      html += '<p class="perfect">All tests pass.</p>'
    }

    root.innerHTML = html
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

render()
