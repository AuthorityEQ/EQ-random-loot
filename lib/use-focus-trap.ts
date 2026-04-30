import { useEffect } from "react";

/**
 * Custom hook to trap focus within a container element.
 * When active, Tab navigation is constrained to focusable elements within the container.
 * Prevents focus from escaping to elements outside the container.
 *
 * @param active - Whether the focus trap is currently active
 * @param containerRef - Reference to the container element to trap focus within
 */
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement>): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelectors = [
      'a[href]',
      'button:not(:disabled)',
      'input:not(:disabled)',
      'select:not(:disabled)',
      'textarea:not(:disabled)',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    function getFocusableElements(): HTMLElement[] {
      const elements = container.querySelectorAll<HTMLElement>(focusableSelectors);
      return Array.from(elements).filter(
        (el) => el.offsetParent !== null || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const activeElement = document.activeElement as HTMLElement;
      const focusedIndex = focusableElements.indexOf(activeElement);

      if (event.shiftKey) {
        // Shift + Tab: move to previous element
        const previousIndex = focusedIndex <= 0 ? focusableElements.length - 1 : focusedIndex - 1;
        focusableElements[previousIndex]?.focus();
      } else {
        // Tab: move to next element
        const nextIndex = focusedIndex >= focusableElements.length - 1 ? 0 : focusedIndex + 1;
        focusableElements[nextIndex]?.focus();
      }

      event.preventDefault();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}
