(() => {
  const screens = {
    timer: document.getElementById('screen-timer'),
    letter: document.getElementById('screen-letter'),
    done: document.getElementById('screen-done'),
  };

  const digitButtons = document.querySelectorAll('.key[data-digit]');
  const clearBtn = document.getElementById('clear-btn');
  const minutesValueEl = document.getElementById('minutes-value');
  const startBtn = document.getElementById('start-btn');
  const finishBtn = document.getElementById('finish-btn');
  const timeLeftEl = document.getElementById('time-left');
  const pagesContainer = document.getElementById('letter-pages');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const pageIndicatorEl = document.getElementById('page-indicator');
  const downloadBtn = document.getElementById('download-btn');
  const restartBtn = document.getElementById('restart-btn');

  let enteredMinutes = 0;
  let remainingSeconds = 0;
  let intervalId = null;
  let pages = [];
  let currentIndex = 0;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function formatDateHeader(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}.${mo}.${d} ${h}:${mi}`;
  }

  function updateMinutesDisplay() {
    minutesValueEl.textContent = String(enteredMinutes).padStart(2, '0');
  }

  async function recordLocation(headerLine, metaEl) {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const place = addr.city || addr.town || addr.village || addr.county || addr.state;
            if (place) {
              label = addr.country ? `${place}, ${addr.country}` : place;
            }
          }
        } catch (err) {
          /* keep coordinate fallback */
        }

        if (metaEl.textContent === headerLine) {
          metaEl.textContent = `${headerLine} · ${label}`;
        }
      },
      () => {
        /* permission denied or unavailable — leave header as date/time only */
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  function resetPages() {
    pagesContainer.innerHTML = '';
    pages = [];
    currentIndex = 0;
  }

  function createPage(metaText, num) {
    const root = document.createElement('div');
    root.className = 'letter-paper';

    let metaEl = null;
    if (metaText !== null) {
      metaEl = document.createElement('div');
      metaEl.className = 'letter-meta';
      metaEl.textContent = metaText;
      root.appendChild(metaEl);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'letter-body';
    textarea.placeholder = num === 1 ? 'start writing...' : 'keep writing...';
    textarea.spellcheck = false;
    root.appendChild(textarea);

    textarea.addEventListener('input', updateNav);

    return { root, textarea, metaEl };
  }

  function isPageFull(page) {
    return page.textarea.scrollHeight > page.textarea.clientHeight + 2;
  }

  function updateNav() {
    const total = pages.length;
    pageIndicatorEl.textContent = total > 1 ? `${currentIndex + 1} / ${total}` : `${currentIndex + 1}`;

    prevPageBtn.classList.toggle('visible', currentIndex > 0);

    const onLastPage = currentIndex === total - 1;
    const canAdvance = !onLastPage || isPageFull(pages[currentIndex]);
    nextPageBtn.classList.toggle('visible', canAdvance);
  }

  function showPage(index) {
    pages.forEach((page, i) => {
      page.root.style.display = i === index ? 'flex' : 'none';
    });
    currentIndex = index;
    updateNav();
    pages[index].textarea.focus();
    pages[index].textarea.scrollTop = 0;
  }

  prevPageBtn.addEventListener('click', () => {
    if (currentIndex > 0) showPage(currentIndex - 1);
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentIndex < pages.length - 1) {
      showPage(currentIndex + 1);
      return;
    }
    if (isPageFull(pages[currentIndex])) {
      const newPage = createPage(null, pages.length + 1);
      pagesContainer.appendChild(newPage.root);
      pages.push(newPage);
      showPage(pages.length - 1);
    }
  });

  digitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const digit = Number(btn.dataset.digit);
      enteredMinutes = (enteredMinutes * 10 + digit) % 100;
      updateMinutesDisplay();
    });
  });

  clearBtn.addEventListener('click', () => {
    enteredMinutes = 0;
    updateMinutesDisplay();
  });

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function tick() {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      timeLeftEl.textContent = "time's up";
      timeLeftEl.classList.remove('digital');
      stopTimer();
      return;
    }
    timeLeftEl.textContent = formatTime(remainingSeconds);
  }

  startBtn.addEventListener('click', () => {
    stopTimer();
    resetPages();

    const headerLine = formatDateHeader(new Date());
    const firstPage = createPage(headerLine, 1);
    pagesContainer.appendChild(firstPage.root);
    pages.push(firstPage);
    recordLocation(headerLine, firstPage.metaEl);

    timeLeftEl.classList.add('digital');

    if (enteredMinutes > 0) {
      remainingSeconds = enteredMinutes * 60;
      timeLeftEl.textContent = formatTime(remainingSeconds);
      intervalId = setInterval(tick, 1000);
    } else {
      timeLeftEl.textContent = '--:--';
    }

    showScreen('letter');
    showPage(0);
  });

  finishBtn.addEventListener('click', () => {
    stopTimer();
    showScreen('done');
  });

  downloadBtn.addEventListener('click', () => {
    const parts = pages.map((page) => {
      const meta = page.metaEl ? `${page.metaEl.textContent}\n\n` : '';
      return `${meta}${page.textarea.value}`;
    });
    const content = parts.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `letter-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  restartBtn.addEventListener('click', () => {
    resetPages();
    enteredMinutes = 0;
    updateMinutesDisplay();
    timeLeftEl.textContent = '--:--';
    showScreen('timer');
  });

  showScreen('timer');
})();
