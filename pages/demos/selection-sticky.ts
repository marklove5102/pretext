const TEXT = 'Select this line, release, then drag-select again somewhere else.'

function getRequiredElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id)
  if (!(element instanceof ctor)) throw new Error(`#${id} not found`)
  return element
}

const counter = getRequiredElement('counter', HTMLParagraphElement)
const line = getRequiredElement('line', HTMLDivElement)

line.textContent = TEXT

const st = {
  events: {
    mousemove: null as MouseEvent | null,
  },
  commits: 0,
}

let scheduled = false

function scheduleRender(): void {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(function render() {
    scheduled = false
    st.commits++
    counter.textContent = `counter commits: ${st.commits}`
    st.events.mousemove = null
  })
}

document.addEventListener('mousemove', event => {
  st.events.mousemove = event
  scheduleRender()
})

counter.textContent = 'counter commits: 0'
