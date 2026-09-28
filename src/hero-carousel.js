export function initHeroCarousel(root) {
  const carousel = root.querySelector("[data-hero-carousel]");
  if (!carousel) return;

  const slides = [...carousel.querySelectorAll("[data-hero-slide]")];
  const dots = [...carousel.querySelectorAll("[data-hero-dot]")];
  const status = carousel.querySelector("[data-hero-status]");
  const prev = carousel.querySelector("[data-hero-prev]");
  const next = carousel.querySelector("[data-hero-next]");

  if (slides.length <= 1) return;

  let index = slides.findIndex((slide) => slide.classList.contains("is-active"));
  if (index < 0) index = 0;

  let timer = null;
  const delayMs = 9000;

  const setSlide = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    if (status) {
      status.textContent = slides[index].dataset.title || "";
    }
  };

  const stop = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  const start = () => {
    stop();
    timer = window.setInterval(() => setSlide(index + 1), delayMs);
  };

  prev?.addEventListener("click", () => {
    setSlide(index - 1);
    start();
  });
  next?.addEventListener("click", () => {
    setSlide(index + 1);
    start();
  });
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      setSlide(i);
      start();
    });
  });

  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", start);

  setSlide(index);
  start();
}
