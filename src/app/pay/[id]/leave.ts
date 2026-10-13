/**
 * Sends the browser to the calling kit's return address. A full navigation,
 * not a router push: the address is on another site. Its own module so a
 * test can replace it, since jsdom cannot navigate.
 */
export function leaveTo(url: string): void {
  window.location.assign(url);
}
