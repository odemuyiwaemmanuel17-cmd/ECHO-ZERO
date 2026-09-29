/** Native listeners bypass scene picking and always compare the actual canvas. */
export function bindPrimaryInput(
  canvas: HTMLCanvasElement,
  options: {
    playing: () => boolean;
    blocked: () => boolean;
    press: () => void;
    release: () => void;
    captureError: (reason: string) => void;
    unlockedFire: () => boolean;
    observed: () => void;
  },
) {
  let active = true;
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      event.pointerType === "touch" ||
      !options.playing()
    )
      return;
    const locked = document.pointerLockElement === canvas;
    if (!locked && event.target !== canvas) return;
    options.observed();
    if (options.blocked()) return;
    if (!locked && !options.unlockedFire()) {
      const failed = (error: unknown) => {
        if (active)
          options.captureError(
            error instanceof Error ? error.message : String(error),
          );
      };
      try {
        const pending = canvas.requestPointerLock();
        pending?.catch(failed);
      } catch (error) {
        failed(error);
      }
      return;
    }
    event.preventDefault();
    options.press();
  };
  const up = () => options.release();
  const capture = { capture: true };
  document.addEventListener("pointerdown", down, capture);
  document.addEventListener("pointerup", up, capture);
  document.addEventListener("pointercancel", up, capture);
  window.addEventListener("blur", up);
  return () => {
    active = false;
    document.removeEventListener("pointerdown", down, capture);
    document.removeEventListener("pointerup", up, capture);
    document.removeEventListener("pointercancel", up, capture);
    window.removeEventListener("blur", up);
  };
}
