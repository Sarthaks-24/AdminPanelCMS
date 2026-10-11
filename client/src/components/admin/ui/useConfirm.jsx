import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from './Modal';

/**
 * `window.confirm`, as an accessible dialog (focus trap, Escape, focus returns to the trigger).
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Delete this role?', consequence: '…', confirmLabel: 'Delete' }))) return;
 *   …
 *   return <>{…}{confirmDialog}</>;
 *
 * Options are ConfirmDialog's props minus the handlers: title, consequence, confirmLabel, cancelLabel, danger, note.
 */
export default function useConfirm() {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false); // a second request cancels a dialog that is still open
    resolver.current = resolve;
    setRequest(options);
  }), []);

  const settle = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  };

  const dialog = request ? (
    <ConfirmDialog {...request} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return [confirm, dialog];
}
