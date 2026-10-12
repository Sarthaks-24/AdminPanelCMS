import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, CONTENT_CHANGED_EVENT } from '../api/client';

/**
 * How much each content section holds, for the sidebar: `{ projects: 3, …, profile: true, resume: false }`.
 * One request (GET /account/summary), refreshed when the page changes or a content write succeeds.
 * `null` until the first answer, and stays at the last good answer if a refresh fails.
 */
export default function useContentSummary() {
  const { pathname } = useLocation();
  const [summary, setSummary] = useState(null);
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    const bump = () => setChanges((count) => count + 1);
    window.addEventListener(CONTENT_CHANGED_EVENT, bump);
    return () => window.removeEventListener(CONTENT_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let live = true;
    api.get('/account/summary').then(({ data }) => { if (live) setSummary(data); }).catch(() => { /* keep the last counts */ });
    return () => { live = false; };
  }, [pathname, changes]);

  return summary;
}
