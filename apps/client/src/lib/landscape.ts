/**
 * The play screen is held landscape. Browsers only allow locking orientation in fullscreen,
 * and iOS Safari not at all, so this is best effort; the page also asks the player to rotate.
 */
export async function enterLandscape(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // fullscreen refused or unsupported
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    // lock unsupported (iOS) or not in fullscreen
  }
}
