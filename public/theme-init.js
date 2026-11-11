// Apply the last selected mode before the page paints. No inline script is needed in MV3.
;(() => {
  const mode = localStorage.getItem('blank:color-mode') ?? 'system'
  const dark =
    mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
})()
