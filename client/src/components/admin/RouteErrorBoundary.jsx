import React from 'react';

const RELOAD_FLAG = 'route-chunk-reloaded';

// A lazy chunk that no longer exists on the server (after a redeploy) throws while loading.
function isChunkLoadError(error) {
  const text = `${error?.name || ''} ${error?.message || ''}`;
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported/i.test(text);
}

function readFlag() { try { return sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { return false; } }
function writeFlag(value) { try { if (value) sessionStorage.setItem(RELOAD_FLAG, '1'); else sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked */ } }

/**
 * Sits inside <Suspense> around the routes. A chunk-load error reloads the page once (a stale deploy is
 * the usual cause); anything else, or a second chunk failure, shows a plain recovery screen instead of white.
 */
export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !readFlag()) {
      writeFlag(true);
      window.location.reload();
    }
  }

  componentDidMount() {
    // A clean mount after a reload means the recovery worked; allow one more some other day.
    if (readFlag()) window.setTimeout(() => writeFlag(false), 5000);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkLoadError(this.state.error);
    return (
      <main className="grid min-h-dvh place-items-center bg-t-bg px-4 text-t-text">
        <div role="alert" className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">{chunk ? 'A newer version is available' : 'Something broke.'}</h1>
          <p className="mt-3 text-sm leading-6 text-t-muted">
            {chunk ? 'The page you asked for was updated while you were away. Reload to get the current version.' : 'The page hit an error it couldn’t recover from. Reloading usually fixes it; nothing you saved is lost.'}
          </p>
          <button type="button" onClick={() => { writeFlag(false); window.location.reload(); }} className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-t-accent px-5 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br">Reload</button>
        </div>
      </main>
    );
  }
}
