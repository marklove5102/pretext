const TEXT = 'Select this line, release, then drag-select again somewhere else.'

function getRequiredElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id)
  if (!(element instanceof ctor)) throw new Error(`#${id} not found`)
  return element
}

const counter = getRequiredElement('counter', HTMLParagraphElement)
const line = getRequiredElement('line', HTMLParagraphElement)

let commits = 0

function commit(): void {
  commits++
  counter.textContent = `commits: ${commits}`
  line.textContent = TEXT
}

commit()
window.setInterval(commit, 500)
