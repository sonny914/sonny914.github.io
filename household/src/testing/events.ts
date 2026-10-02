import { act, fireEvent as raw } from '@testing-library/react';

/** Like Testing Library's fireEvent, but waits for the async saves and reloads the event triggers. */
export const fireEvent = {
  click: (el: Element) => act(async () => void raw.click(el)),
  change: (el: Element, init: { target: { value: string } }) => act(async () => void raw.change(el, init)),
  keyDown: (el: Element | Document, init: { key: string }) => act(async () => void raw.keyDown(el, init)),
};
