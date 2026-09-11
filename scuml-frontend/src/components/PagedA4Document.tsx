'use client';

// Turns arbitrarily long "letter" content into real, separate A4 sheets —
// on screen, on print, and in the downloaded PDF — instead of one
// continuously scrolling page. The content is rendered once, off-screen, at
// a fixed 794px (210mm) width, rasterized, and sliced into as many
// 1123px-tall (297mm) chunks as it needs. Each chunk is then shown as its
// own white, shadowed "sheet", and the same slices are handed back (via
// onSlicesReady) so the caller can build an identical multi-page PDF
// without re-rendering anything.
import { Box, Spinner, VStack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

export const A4_PAGE_WIDTH_PX = 794;
export const A4_PAGE_HEIGHT_PX = 1123;

// Blank space reserved at the bottom of every page (not just the last one)
// so text never runs flush to the physical edge — roughly the same order
// of magnitude as the page's own top/side padding.
const BOTTOM_MARGIN_PX = 56;

// Give any row/block that shouldn't be sliced in half (a Field label:value
// line, a table row, the header info block, the signature) this class.
// PagedA4Document snaps a page break up above such an element instead of
// cutting through it, leaving the reserved bottom margin blank and
// continuing that entry on the next page.
export const KEEP_TOGETHER_CLASS = 'pg-entry';

export type A4Slice = { dataUrl: string; heightMm: number };

// Every wrapped visual line of text in `root`, as {top, bottom} relative to
// `root`'s own top — so a page break never lands mid-line (mid-glyph) even
// for free-flowing paragraph text that isn't wrapped in KEEP_TOGETHER_CLASS.
// Range.getClientRects() returns one rect per visual line for a wrapped
// text node, which is exactly what's needed here.
function getLineBounds(root: HTMLElement): { top: number; bottom: number }[] {
  const rootTop = root.getBoundingClientRect().top;
  const bounds: { top: number; bottom: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent && n.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.height > 0) bounds.push({ top: r.top - rootTop, bottom: r.bottom - rootTop });
    }
  }
  return bounds;
}

export default function PagedA4Document({
  pageContent,
  contentKey,
  onSlicesReady,
}: {
  // The full, naturally-flowing content for the document — no fixed
  // height needed, this component measures whatever height it ends up.
  pageContent: React.ReactNode;
  // Changing this re-measures and re-slices (e.g. once the underlying
  // record finishes loading).
  contentKey: string;
  onSlicesReady?: (slices: A4Slice[]) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [slices, setSlices] = useState<A4Slice[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlices(null);
    const run = async () => {
      // A brief delay so the off-screen node has actually painted (fonts,
      // images) before html2canvas reads it. A setTimeout, not
      // requestAnimationFrame — rAF callbacks are paused entirely by the
      // browser while the tab is backgrounded/not visible, which would
      // stall this indefinitely if the document is being generated in a
      // tab the user has switched away from.
      await new Promise((r) => setTimeout(r, 80));
      const node = measureRef.current;
      if (!node || cancelled) return;

      // Measure "keep together" rows AND every individual text line in CSS
      // px, relative to the content's own top, BEFORE html2canvas
      // clones/rasterizes anything — a page break must not land inside
      // either.
      const nodeTop = node.getBoundingClientRect().top;
      const entryBoundsCss = Array.from(node.querySelectorAll(`.${KEEP_TOGETHER_CLASS}`)).map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top - nodeTop, bottom: r.bottom - nodeTop };
      });
      entryBoundsCss.push(...getLineBounds(node));

      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const scale = canvas.width / A4_PAGE_WIDTH_PX;
      const bottomMarginPx = Math.round(BOTTOM_MARGIN_PX * scale);
      const pageHeightPx = Math.round(A4_PAGE_HEIGHT_PX * scale) - bottomMarginPx;
      const entryBounds = entryBoundsCss.map((e) => ({ top: e.top * scale, bottom: e.bottom * scale }));

      const out: A4Slice[] = [];
      let renderedPx = 0;
      while (renderedPx < canvas.height) {
        let cutPx = Math.min(renderedPx + pageHeightPx, canvas.height);
        if (cutPx < canvas.height) {
          // If this cut would land inside a "keep together" entry, snap the
          // break up to just before it — that entry (and the would-be-used
          // space below it) moves to the next page instead of being sliced
          // through the middle.
          const straddled = entryBounds.filter((e) => e.top < cutPx && e.bottom > cutPx && e.top > renderedPx);
          if (straddled.length > 0) {
            const snapTo = Math.min(...straddled.map((e) => e.top));
            if (snapTo > renderedPx) cutPx = snapTo;
          }
        }
        const sliceHeightPx = cutPx - renderedPx;
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceHeightPx;
        const ctx = slice.getContext('2d');
        ctx?.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
        out.push({
          dataUrl: slice.toDataURL('image/jpeg', 0.92),
          heightMm: (sliceHeightPx / canvas.width) * 210,
        });
        renderedPx += sliceHeightPx;
      }
      if (!cancelled) {
        setSlices(out);
        onSlicesReady?.(out);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  return (
    <>
      {/* Off-screen measuring copy — never shown, only rasterized. Kept at
          a small, fixed offset (not thousands of px away): html2canvas
          computes its capture canvas from absolute document coordinates,
          so an extreme offset (e.g. -99999px) asks the browser for a
          canvas far larger than its size limit and silently produces
          nothing. */}
      <Box
        position="absolute"
        top="0"
        left="0"
        w="1px"
        h="1px"
        overflow="hidden"
        aria-hidden
      >
        <Box ref={measureRef} w={`${A4_PAGE_WIDTH_PX}px`}>
          {pageContent}
        </Box>
      </Box>

      {slices === null ? (
        <Box display="flex" justifyContent="center" py={20}>
          <Spinner size="xl" />
        </Box>
      ) : (
        <>
          {/* One physical sheet per .a4-page: force the on-screen gap
              between pages to close for print (it's purely a screen
              convenience) and put an explicit break after every page but
              the last — without this, the browser's own auto-pagination
              has to guess where the fixed-height boxes below start and
              stop, which is exactly the kind of mismatch that produced
              extra blank sheets before. */}
          <style>{`
            @media print {
              .a4-page-stack { gap: 0 !important; }
              .a4-page { box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
              .a4-page:not(:last-child) { break-after: page; page-break-after: always; }
            }
          `}</style>
          <VStack spacing={8} align="center" className="a4-page-stack">
            {slices.map((s, i) => (
              <Box
                key={i}
                className="a4-page"
                bg="white"
                shadow="lg"
                w={`${A4_PAGE_WIDTH_PX}px`}
                h={`${A4_PAGE_HEIGHT_PX}px`}
                maxW="100%"
                overflow="hidden"
              >
                {/* Fixed-height page, image top-aligned — a page whose
                    content stopped short (the reserved bottom margin, or a
                    row/line that got pushed to the next page rather than
                    split) shows that as real blank space at the bottom of
                    this sheet, same as an actual printed page. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={`Page ${i + 1}`} style={{ display: 'block', width: '100%' }} />
              </Box>
            ))}
          </VStack>
        </>
      )}
    </>
  );
}
