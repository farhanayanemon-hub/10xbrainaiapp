/**
 * Popover positioning utilities for ChatInterface
 * Handles positioning of native HTML popovers relative to trigger elements
 */

// ToggleEvent interface for popover beforetoggle event
export interface ToggleEvent extends Event {
  newState: "open" | "closed";
  oldState: "open" | "closed";
}

export interface PopoverConfig {
  popoverId: string;
  triggerId: string;
}

/**
 * Position popover relative to trigger button
 * Handles both file upload and model selector popovers with different positioning strategies
 */
export function positionPopover(popover: HTMLElement, trigger: HTMLElement) {
  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Default spacing above/below trigger
  const spacing = 16;
  const isFileUpload = popover.id === "file-upload-popover";
  const isMobile = viewport.width < 640; // sm breakpoint

  // Calculate horizontal position
  let left: number;

  if (isMobile && !isFileUpload) {
    // On mobile, center the popover in the viewport with 8px margins
    left = 8;
    // Ensure the popover uses full available width (already handled by CSS w-[calc(100vw-16px)])
  } else {
    // Desktop behavior: center-align with trigger
    left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
  }

  // Ensure popover doesn't go off screen horizontally
  if (left < 8) {
    left = 8; // 8px margin from left edge
  } else if (left + popoverRect.width > viewport.width - 8) {
    left = viewport.width - popoverRect.width - 8; // 8px margin from right edge
  }

  if (isFileUpload) {
    // File upload popover: anchor bottom edge above trigger (grows upward)
    const bottom = viewport.height - triggerRect.top + spacing;

    // Ensure popover doesn't go off screen at the top
    const maxBottom = viewport.height - 8; // 8px margin from top
    const finalBottom = Math.min(bottom, maxBottom);

    popover.style.bottom = `${finalBottom}px`;
    popover.style.top = "auto";
  } else {
    // Model selector popover: intelligent positioning
    let top: number;

    if (isMobile) {
      // On mobile, prefer positioning above the trigger with more space
      const spaceAbove = triggerRect.top - spacing;
      const spaceBelow = viewport.height - triggerRect.bottom - spacing;
      const popoverHeight = Math.min(
        popoverRect.height,
        viewport.height * 0.7
      ); // Max 70% of viewport height

      if (spaceAbove >= popoverHeight) {
        // Position above
        top = triggerRect.top - popoverHeight - spacing;
      } else if (spaceBelow >= popoverHeight) {
        // Position below
        top = triggerRect.bottom + spacing;
      } else {
        // Use the larger space and adjust height
        if (spaceAbove > spaceBelow) {
          top = 8; // Near top of screen
          popover.style.maxHeight = `${triggerRect.top - 24}px`; // Leave space for trigger
        } else {
          top = triggerRect.bottom + spacing;
          popover.style.maxHeight = `${viewport.height - triggerRect.bottom - 24}px`;
        }
      }
    } else {
      // Desktop logic: try above first, then below
      top = triggerRect.top - popoverRect.height - spacing;

      // If not enough space above, position below
      if (top < 8) {
        top = triggerRect.bottom + spacing;
      }

      // Ensure popover doesn't go off screen vertically
      if (top + popoverRect.height > viewport.height - 8) {
        top = viewport.height - popoverRect.height - 8; // 8px margin from bottom
      }
    }

    popover.style.top = `${top}px`;
    popover.style.bottom = "auto";
  }

  // Apply horizontal positioning for both types (using logical property for RTL support)
  popover.style.insetInlineStart = `${left}px`;
}

/**
 * Setup popover positioning with event handlers
 * Returns a cleanup function to remove all event listeners
 */
export function setupPopoverPositioning(
  configs: PopoverConfig[],
  isMounted: () => boolean
): () => void {
  if (!isMounted()) return () => {};

  const cleanupHandlers: (() => void)[] = [];

  // Debounced resize handler to improve performance
  let resizeTimer: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Reposition open popovers when screen size changes
      for (const config of configs) {
        const popover = document.getElementById(config.popoverId);
        const trigger = document.getElementById(config.triggerId);
        if (popover?.matches(":popover-open") && trigger) {
          requestAnimationFrame(() => {
            positionPopover(popover, trigger);
          });
        }
      }
    }, 150); // 150ms debounce
  };

  // Add resize and orientation change listeners
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  cleanupHandlers.push(() => {
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("orientationchange", handleResize);
  });

  // Setup beforetoggle handlers for each popover
  for (const config of configs) {
    const popover = document.getElementById(config.popoverId);
    const trigger = document.getElementById(config.triggerId);

    if (popover && trigger) {
      const handleBeforeToggle = (event: Event) => {
        const toggleEvent = event as ToggleEvent;
        if (toggleEvent.newState === "open") {
          // Small delay to ensure popover dimensions are available
          requestAnimationFrame(() => {
            positionPopover(popover, trigger);
          });
        }
      };

      popover.addEventListener("beforetoggle", handleBeforeToggle);
      cleanupHandlers.push(() => {
        popover.removeEventListener("beforetoggle", handleBeforeToggle);
      });
    }
  }

  // Return cleanup function
  return () => {
    cleanupHandlers.forEach((cleanup) => cleanup());
  };
}
