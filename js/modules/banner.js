/** Chuyển banner bằng nút bấm và tự động sau 5 giây. */
export function initBanner() {
  const banner = document.querySelector('[data-banner]');
  if (!banner) return;

  const slides = banner.querySelectorAll('[data-banner-slide]');
  if (slides.length < 2) return;

  const dots = banner.querySelectorAll('[data-banner-dot]');
  const delay = 5000;
  let currentIndex = 0;
  let timer;

  // Mỗi lần bấm nút, chờ đủ 5 giây rồi mới tự chuyển tiếp.
  const scheduleNext = () => {
    clearTimeout(timer);
    if (!document.hidden && !slides[currentIndex].contains(document.activeElement)) {
      timer = setTimeout(() => showSlide(currentIndex + 1), delay);
    }
  };

  const showSlide = (index) => {
    currentIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === currentIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.inert = !isActive;
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === currentIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-pressed', String(isActive));
    });

    scheduleNext();
  };

  banner.querySelector('[data-banner-prev]').addEventListener('click', () => showSlide(currentIndex - 1));
  banner.querySelector('[data-banner-next]').addEventListener('click', () => showSlide(currentIndex + 1));
  dots.forEach(dot => {
    dot.addEventListener('click', () => showSlide(Number(dot.dataset.bannerDot)));
  });

  // Không chạy bộ đếm khi người dùng đang xem tab khác.
  document.addEventListener('visibilitychange', scheduleNext);
  // Giữ nguyên ảnh khi người dùng đang chọn liên kết trong ảnh bằng bàn phím.
  banner.addEventListener('focusin', scheduleNext);
  banner.addEventListener('focusout', () => queueMicrotask(scheduleNext));
  showSlide(0);
}
