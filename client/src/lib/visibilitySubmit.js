/**
 * Publish-on-save forms have two submit buttons: "Save as draft" and "Save and publish".
 *
 * Pressing Enter in a text field submits a form through its *default* button, which is the first
 * submit button in DOM order. In every content form that was "Save as draft", so Enter quietly
 * unpublished a live item and pulled it out of every App's `selected` list (FX-38).
 *
 * The fix has two halves, and every publish-on-save form uses both:
 *  - `onKeyDown={submitKeepingVisibility}` on the <form>: Enter in a single-line field submits the
 *    form with no submitter, instead of "clicking" whichever button happens to come first;
 *  - `chosenVisibility(event, fallback)` in the submit handler: a click on one of the two buttons
 *    is an explicit choice; anything else (Enter) keeps `fallback`, which is the item's current
 *    visibility when editing and "draft" when creating, so Enter never publishes anything (FE-02).
 */

const NON_TEXT_INPUTS = new Set(['submit', 'button', 'reset', 'image', 'file']);

/** `onKeyDown` handler for a <form>. */
export function submitKeepingVisibility(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.nativeEvent?.isComposing) return;
  const target = event.target;
  if (!target || target.tagName !== 'INPUT') return; // textareas take newlines; buttons and selects keep their own Enter
  if (NON_TEXT_INPUTS.has(String(target.type || '').toLowerCase())) return;
  event.preventDefault();
  const form = event.currentTarget;
  if (typeof form.requestSubmit === 'function') form.requestSubmit(); // validates, then fires submit with no submitter
}

/**
 * @param {SubmitEvent|React.FormEvent} event the submit event
 * @param {'draft'|'published'} fallback what Enter means for this form
 * @returns {'draft'|'published'}
 */
export function chosenVisibility(event, fallback) {
  const value = (event?.nativeEvent ?? event)?.submitter?.value;
  if (value === 'draft' || value === 'published') return value;
  return fallback === 'published' ? 'published' : 'draft';
}

/** The fallback for an item being edited (or `null` when creating). */
export function currentVisibility(item) {
  if (!item) return 'draft';
  return item.visibility === 'published' ? 'published' : 'draft';
}
