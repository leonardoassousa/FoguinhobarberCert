/* =============================================================
   FOGUINHO BARBER SHOP — comportamento da página
   1. Cabeçalho com estado de rolagem
   2. Menu mobile acessível
   3. Link ativo conforme a seção visível
   4. Revelação suave dos blocos
   5. Carrossel de avaliações (laço infinito)
   6. Status de aberto/fechado em tempo real
   7. Ano do rodapé
   ============================================================= */
(() => {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. CABEÇALHO ---------------------------------- */
  const header = $('.site-header');

  if (header) {
    let ticking = false;
    const syncHeader = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(syncHeader);
      }
    }, { passive: true });
    syncHeader();
  }

  /* ---------- 2. MENU MOBILE -------------------------------- */
  const toggle = $('.nav-toggle');
  const nav    = $('#menu-principal');
  const scrim  = $('.nav-scrim');

  if (toggle && nav && scrim) {
    const setMenu = (open) => {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      scrim.hidden = !open;
    };

    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    scrim.addEventListener('click', () => setMenu(false));

    $$('a', nav).forEach((link) => {
      link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    // Volta ao estado normal quando a tela cresce
    window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
      if (event.matches) setMenu(false);
    });
  }

  /* ---------- 3. LINK ATIVO --------------------------------- */
  const navLinks = $$('.nav__list a');
  const sections = navLinks
    .map((link) => $(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          if (active) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- 4. REVELAÇÃO ---------------------------------- */
  const revealables = $$('.reveal');

  // Escalona os itens irmãos para o bloco entrar em cascata
  const groups = new Map();
  revealables.forEach((el) => {
    const parent = el.parentElement;
    const index = groups.get(parent) ?? 0;
    el.style.setProperty('--i', index);
    groups.set(parent, index + 1);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    revealables.forEach((el) => revealer.observe(el));
  }

  /* ---------- 5. CARROSSEL DE AVALIAÇÕES --------------------- */
  /* O laço infinito depende de ter conteúdo duplicado o bastante para
     cobrir a tela inteira; em telas largas, uma única cópia extra não
     é suficiente e sobra um vão vazio antes do laço reiniciar. Por isso
     o número de cópias é calculado aqui, em vez de fixo no HTML/CSS. */
  const tickerViewport = $('.ticker-viewport');
  const ticker = $('.ticker');
  const sourceTrack = ticker && $('.ticker__track', ticker);

  if (tickerViewport && ticker && sourceTrack) {
    const buildTicker = () => {
      $$('.ticker__track', ticker).forEach((track, index) => {
        if (index > 0) track.remove();
      });

      const trackWidth = sourceTrack.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(ticker).columnGap || getComputedStyle(ticker).gap) || 0;
      if (!trackWidth) return;

      const viewportWidth = tickerViewport.getBoundingClientRect().width;
      const copiesNeeded = Math.max(1, Math.ceil(viewportWidth / trackWidth)) + 1;

      for (let i = 0; i < copiesNeeded; i++) {
        const clone = sourceTrack.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        ticker.appendChild(clone);
      }

      ticker.style.setProperty('--ticker-shift', `${-(trackWidth + gap)}px`);
    };

    buildTicker();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildTicker, 200);
    });
  }

  /* ---------- 6. ABERTO OU FECHADO -------------------------- */
  /* Horário da barbearia: segunda a sábado, 09:00 às 19:00 (fuso de Eunápolis) */
  const OPEN_MIN  = 9 * 60;
  const CLOSE_MIN = 19 * 60;
  const statusEl  = $('#status-loja');

  const localNow = () => {
    try {
      return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }));
    } catch (error) {
      return new Date();
    }
  };

  const describeStatus = (now) => {
    const day = now.getDay();                                  // 0 = domingo
    const minutes = now.getHours() * 60 + now.getMinutes();
    const isWorkday = day >= 1 && day <= 6;

    if (isWorkday && minutes >= OPEN_MIN && minutes < CLOSE_MIN) {
      const left = CLOSE_MIN - minutes;
      return left <= 60
        ? { state: 'closing', html: `<b>Fecha em ${left} min</b> — hoje até às 19h` }
        : { state: 'open',    html: '<b>Aberto agora</b> — fecha às 19h' };
    }

    let when = 'amanhã';
    if (isWorkday && minutes < OPEN_MIN) when = 'hoje';
    else if (day === 6 || day === 0)     when = 'segunda-feira';

    return { state: 'closed', html: `<b>Fechado agora</b> — abre ${when} às 9h` };
  };

  const paintStatus = () => {
    if (!statusEl) return;
    const { state, html } = describeStatus(localNow());
    statusEl.dataset.status = state;
    $('.status__text', statusEl).innerHTML = html;
  };

  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------- 7. ANO DO RODAPÉ ------------------------------ */
  const year = $('#ano');
  if (year) year.textContent = String(new Date().getFullYear());
})();
