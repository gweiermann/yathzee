function bindBottomSheet({ drawer, handle, backdrop, isOpen, setOpen, onClose }) {
  if (!drawer || !handle) return;
  const scrollArea = drawer.querySelector('.paper-table-scroll');
  let startY = 0;
  let startX = 0;
  let startTranslate = 0;
  let maxTranslate = 0;
  let dragging = false;
  let pullingFromContent = false;
  let startedOpen = false;

  const translateForState = () => isOpen() ? 0 : Math.max(0, drawer.getBoundingClientRect().height - 66);
  const close = () => {
    setOpen(false);
    onClose?.();
    render();
  };
  const settle = open => {
    setOpen(open);
    if (!open) onClose?.();
    drawer.classList.remove('dragging');
    drawer.style.transform = '';
    drawer.classList.toggle('open', open);
    handle.setAttribute('aria-expanded', String(open));
  };
  const beginDrag = (clientX, clientY) => {
    dragging = false;
    startedOpen = isOpen();
    startX = clientX;
    startY = clientY;
    maxTranslate = Math.max(0, drawer.getBoundingClientRect().height - 66);
    startTranslate = translateForState();
  };
  const dragTo = clientY => {
    const dy = clientY - startY;
    if (Math.abs(dy) > 5) dragging = true;
    if (!dragging) return;
    const next = Math.min(maxTranslate, Math.max(0, startTranslate + dy));
    drawer.classList.add('dragging');
    drawer.style.transform = `translate(-50%, ${next}px)`;
  };
  const finishDrag = () => {
    if (!dragging) return;
    const transform = drawer.style.transform.match(/translate\(-50%,\s*([-\d.]+)px\)/);
    const current = transform ? Number(transform[1]) : translateForState();
    if (startedOpen) settle(current < Math.min(110, maxTranslate * .22));
    else settle(current < maxTranslate * .6);
    setTimeout(() => { dragging = false; }, 0);
  };

  // Close on any interaction outside the sheet. The screen-level capture
  // listener is intentional: on touch devices a synthetic click on the
  // visual backdrop can be swallowed by scroll/drag gesture handling.
  // Capturing pointerdown makes outside dismissal immediate and prevents
  // the underlying game control from accidentally firing as the sheet closes.
  const screen = drawer.closest('.screen');
  screen?.addEventListener('pointerdown', e => {
    if (!isOpen() || drawer.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);
  backdrop?.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  handle.addEventListener('click', () => {
    if (dragging) return;
    if (isOpen()) close();
    else { setOpen(true); render(); }
  });
  handle.addEventListener('pointerdown', e => {
    beginDrag(e.clientX, e.clientY);
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!handle.hasPointerCapture?.(e.pointerId)) return;
    dragTo(e.clientY);
  });
  handle.addEventListener('pointerup', e => {
    if (!handle.hasPointerCapture?.(e.pointerId)) return;
    handle.releasePointerCapture?.(e.pointerId);
    finishDrag();
  });
  handle.addEventListener('pointercancel', () => {
    drawer.classList.remove('dragging');
    drawer.style.transform = '';
    dragging = false;
  });

  // A downward pull from the score sheet closes the bottom sheet once its own
  // vertical scroll has reached the top. Horizontal swipes remain table scrolls.
  const contentArea = drawer.querySelector('.drawer-body');
  contentArea?.addEventListener('touchstart', e => {
    if (!isOpen() || e.touches.length !== 1) return;
    const touch = e.touches[0];
    beginDrag(touch.clientX, touch.clientY);
    pullingFromContent = false;
  }, { passive: true });
  contentArea?.addEventListener('touchmove', e => {
    if (!isOpen() || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const scrollTop = scrollArea?.scrollTop ?? 0;
    if (!pullingFromContent) {
      if (Math.abs(dy) <= Math.abs(dx) || dy <= 0) return;
      if (scrollTop > 0) {
        // Keep moving the gesture anchor while the table itself is still
        // scrolling. This avoids a jump when it finally reaches the top.
        startX = touch.clientX;
        startY = touch.clientY;
        return;
      }
      if (dy <= 6) return;
      pullingFromContent = true;
    }
    if (scrollTop > 0 || dy < 0) return;
    e.preventDefault();
    dragTo(touch.clientY);
  }, { passive: false });
  contentArea?.addEventListener('touchend', () => {
    if (pullingFromContent) finishDrag();
    pullingFromContent = false;
  }, { passive: true });
  contentArea?.addEventListener('touchcancel', () => {
    drawer.classList.remove('dragging');
    drawer.style.transform = '';
    dragging = false;
    pullingFromContent = false;
  }, { passive: true });
}

