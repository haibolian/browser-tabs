type FocusTarget = { focus: (options?: FocusOptions) => void }

// A selected action starts only after the menu releases its focus scope.
export function createMenuSession() {
  let action: (() => void) | null = null
  let origin: FocusTarget | null = null
  return {
    begin(target: FocusTarget | null) {
      action = null
      origin = target
    },
    select(next: () => void) {
      action = next
    },
    finish(event: { preventDefault: () => void }) {
      event.preventDefault()
      const next = action
      const previous = origin
      action = null
      origin = null
      if (next) next()
      else previous?.focus({ preventScroll: true })
    },
  }
}
