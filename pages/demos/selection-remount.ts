const TEXT = 'Select this line, release, then wait for the next remove-and-append tick.'

function getRequiredElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id)
  if (!(element instanceof ctor)) throw new Error(`#${id} not found`)
  return element
}

const counter = getRequiredElement('counter', HTMLParagraphElement)
const container = getRequiredElement('container', HTMLDivElement)

const line = document.createElement('p')
line.className = 'line'
line.textContent = TEXT
container.appendChild(line)

let commits = 0

function commit(): void {
  commits++
  counter.textContent = `remove+append commits: ${commits}`
  container.removeChild(line)
  container.appendChild(line)
}

counter.textContent = 'remove+append commits: 0'
window.setInterval(commit, 500)
