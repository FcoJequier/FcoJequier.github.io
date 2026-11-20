// Adds .in to every .rv element the first time it enters the viewport.
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = matchMedia("(pointer: fine)").matches;

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
);
document.querySelectorAll(".rv").forEach((el) => io.observe(el));

// Remember where an internal link was clicked so the next page can open from that point.
addEventListener("click", (e) => {
  if (e.target instanceof Element && e.target.closest('a[href^="/"]')) sessionStorage.vt = JSON.stringify([e.clientX, e.clientY]);
});
