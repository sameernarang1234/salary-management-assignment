/**
 * Hides content visually but keeps it for screen readers (e.g. the data behind a chart).
 * Sizes are strings on purpose: in MUI's sx a bare number from 0 to 1 means a percentage,
 * so `width: 1` would be 100% and push the page wider than the screen.
 */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
