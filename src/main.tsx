import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { ErrorBoundary } from './App'
import { GitHubCallback } from './components/github-callback'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {new URLSearchParams(location.hash.slice(1)).has('github_state') ? (
        <GitHubCallback />
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
