'use client';

// Renders its children into a dedicated node appended directly to <body> —
// outside the app's own component tree, including any Chakra <Modal> that
// happens to be open (Chakra already portals modals near the end of body,
// but that's still a sibling of the rest of the app, not a replacement
// for it).
//
// Why this exists: every "generated document" print button used to rely on
// the classic `body * { visibility: hidden } .print-area { visibility:
// visible }` trick. That hides everything else, but visibility:hidden does
// NOT remove an element's height from layout — so window.print() still
// paginates against the full height of whatever was behind the document
// (a long admin table, a tall compliance-record modal, ...), printing
// dozens of blank pages before/after the one page of real content. Moving
// the printable content to its own node and hiding every OTHER top-level
// child of body means print pagination is based only on the content that's
// actually meant to be printed.
//
// Note: this app's src/app/globals.css is never imported by layout.tsx, so
// it has no effect on anything — the CSS this relies on is injected
// directly into <head> below instead of living there.
import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const PORTAL_ID = 'print-portal-root';
const STYLE_ID = 'print-portal-styles';

function ensurePortalRoot(): HTMLDivElement {
  let root = document.getElementById(PORTAL_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = PORTAL_ID;
    document.body.appendChild(root);
  }
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media print {
        body > *:not(#${PORTAL_ID}) {
          display: none !important;
        }
      }
      /* A PrintPortal used with screenVisible={false} (e.g. Diary of
         Action, which already renders its table inline where it belongs
         on screen) — its portaled copy exists only to be printed, so keep
         it out of the way until print time. */
      .print-portal-screen-hidden {
        display: none;
      }
      @media print {
        .print-portal-screen-hidden {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  return root;
}

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflowY: 'auto',
  zIndex: 2000,
  background: '#edf2f7',
};

export default function PrintPortal({
  children,
  screenVisible = true,
}: {
  children: ReactNode;
  // false for content that already has its own normal, inline on-screen
  // rendering elsewhere (e.g. the Diary of Action table) — this portaled
  // copy exists purely so printing has an isolated, correctly-paginated
  // version to print, and stays hidden on screen.
  screenVisible?: boolean;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setRoot(ensurePortalRoot());
  }, []);

  if (!root) return null;

  if (!screenVisible) {
    return createPortal(<div className="print-portal-screen-hidden">{children}</div>, root);
  }

  return createPortal(<div style={wrapperStyle}>{children}</div>, root);
}
