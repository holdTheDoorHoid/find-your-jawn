import { render } from 'preact';
import CheckInCard from './CheckInCard';

/** Put the card on the page. Called by the small script in components/CheckIn.astro. */
export function mountCheckIn(root: HTMLElement, dataVersion: string): void {
  root.hidden = false;
  render(<CheckInCard dataVersion={dataVersion} />, root);
}
