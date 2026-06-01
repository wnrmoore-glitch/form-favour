/* ============================================================
   FORM & FAVOUR — Theme JS
   Powers: AJAX cart drawer, quick-add, free-shipping bar,
           predictive search, slideshow.
   Reads config from window.FF (set in theme.liquid).
   ============================================================ */
(function () {
  'use strict';

  var FF = window.FF || {};
  var money = function (cents) {
    return (FF.currencySymbol || '£') + (cents / 100).toFixed(2);
  };

  /* ---------------------------------------------------------
     CART DRAWER
     --------------------------------------------------------- */
  var Cart = {
    drawer: null,
    init: function () {
      this.drawer = document.querySelector('[data-cart-drawer]');
      if (!this.drawer) return;

      // Open triggers
      document.querySelectorAll('[data-cart-open]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          Cart.open();
        });
      });
      // Close triggers
      this.drawer.querySelectorAll('[data-cart-close]').forEach(function (el) {
        el.addEventListener('click', function () { Cart.close(); });
      });
      // Esc to close
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') Cart.close();
      });
      // Intercept all add-to-cart forms
      document.querySelectorAll('form[action$="/cart/add"], form[action*="/cart/add"]').forEach(function (form) {
        form.addEventListener('submit', Cart.onAddSubmit);
      });
      // Refresh count on load
      this.refresh();
    },

    open: function () {
      this.drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    },
    close: function () {
      this.drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    },

    onAddSubmit: function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      var btn = form.querySelector('[type="submit"]');
      var original = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = 'Adding…'; }

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function () { return Cart.refresh(); })
        .then(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = original; }
          Cart.open();
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = original; }
        });
    },

    addById: function (variantId, qty, btn) {
      var original = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '✓'; }
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty || 1 })
      })
        .then(function (r) { return r.json(); })
        .then(function () { return Cart.refresh(); })
        .then(function () {
          if (btn) { btn.innerHTML = 'Added'; setTimeout(function () { btn.disabled = false; btn.innerHTML = original; }, 1200); }
          Cart.open();
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = original; }
        });
    },

    changeQty: function (key, qty) {
      return fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
        .then(function (r) { return r.json(); })
        .then(function () { return Cart.refresh(); });
    },

    refresh: function () {
      return fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          Cart.render(cart);
          return cart;
        });
    },

    render: function (cart) {
      // Count bubbles
      document.querySelectorAll('.js-cart-count').forEach(function (el) {
        el.textContent = cart.item_count;
        el.style.display = cart.item_count > 0 ? 'flex' : 'none';
      });
      if (!this.drawer) return;

      var body = this.drawer.querySelector('[data-cart-body]');
      var footer = this.drawer.querySelector('[data-cart-footer]');
      if (!body) return;

      if (cart.item_count === 0) {
        body.innerHTML = '<div class="cart-drawer__empty"><p>Your bag is empty.</p>'
          + '<a href="' + (FF.allProductsUrl || '/collections/all') + '" class="button" data-cart-close>Start shopping</a></div>';
        if (footer) footer.style.display = 'none';
        this.drawer.querySelectorAll('[data-cart-close]').forEach(function (el) {
          el.addEventListener('click', function () { Cart.close(); });
        });
        return;
      }
      if (footer) footer.style.display = 'block';

      // Items
      var html = cart.items.map(function (item, i) {
        var img = item.image ? item.image.replace(/(\.[a-z]+)(\?|$)/i, '_120x120$1$2') : '';
        return '<div class="cart-drawer__item">'
          + (img ? '<a href="' + item.url + '" class="cart-drawer__img"><img src="' + img + '" alt="' + (item.product_title || '') + '" width="64" height="64" loading="lazy"></a>' : '')
          + '<div class="cart-drawer__info">'
          + '<a href="' + item.url + '" class="cart-drawer__name">' + item.product_title + '</a>'
          + (item.variant_title && item.variant_title !== 'Default Title' ? '<p class="cart-drawer__variant">' + item.variant_title + '</p>' : '')
          + '<div class="cart-drawer__row">'
          + '<div class="cart-drawer__qty">'
          + '<button type="button" aria-label="Decrease" data-qty-down data-key="' + item.key + '">−</button>'
          + '<span>' + item.quantity + '</span>'
          + '<button type="button" aria-label="Increase" data-qty-up data-key="' + item.key + '">+</button>'
          + '</div>'
          + '<span class="cart-drawer__price">' + money(item.final_line_price) + '</span>'
          + '</div>'
          + '<button type="button" class="cart-drawer__remove" data-remove data-key="' + item.key + '">Remove</button>'
          + '</div></div>';
      }).join('');
      body.innerHTML = html;

      // Subtotal
      var subtotalEl = this.drawer.querySelector('[data-cart-subtotal]');
      if (subtotalEl) subtotalEl.textContent = money(cart.total_price);

      // Free shipping bar
      this.renderShipping(cart.total_price);

      // Wire qty + remove
      body.querySelectorAll('[data-qty-up]').forEach(function (b) {
        b.addEventListener('click', function () {
          var item = cart.items.filter(function (it) { return it.key === b.dataset.key; })[0];
          Cart.changeQty(b.dataset.key, (item ? item.quantity : 1) + 1);
        });
      });
      body.querySelectorAll('[data-qty-down]').forEach(function (b) {
        b.addEventListener('click', function () {
          var item = cart.items.filter(function (it) { return it.key === b.dataset.key; })[0];
          Cart.changeQty(b.dataset.key, Math.max(0, (item ? item.quantity : 1) - 1));
        });
      });
      body.querySelectorAll('[data-remove]').forEach(function (b) {
        b.addEventListener('click', function () { Cart.changeQty(b.dataset.key, 0); });
      });
    },

    renderShipping: function (total) {
      var bar = this.drawer.querySelector('[data-shipping-bar]');
      if (!bar) return;
      var threshold = (FF.freeShippingThreshold || 5000); // cents
      if (threshold <= 0) { bar.style.display = 'none'; return; }
      bar.style.display = 'block';
      var msg = bar.querySelector('[data-shipping-msg]');
      var fill = bar.querySelector('[data-shipping-fill]');
      var pct = Math.min(100, (total / threshold) * 100);
      if (fill) fill.style.width = pct + '%';
      if (msg) {
        if (total >= threshold) {
          msg.innerHTML = '🎉 You\'ve unlocked <strong>free shipping!</strong>';
        } else {
          msg.innerHTML = 'You\'re <strong>' + money(threshold - total) + '</strong> away from free shipping';
        }
      }
    }
  };

  /* ---------------------------------------------------------
     QUICK ADD (product cards)
     --------------------------------------------------------- */
  function initQuickAdd() {
    document.querySelectorAll('[data-quick-add]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var vid = btn.dataset.variantId;
        if (!vid) return;
        Cart.addById(vid, 1, btn);
      });
    });
  }

  /* ---------------------------------------------------------
     PREDICTIVE SEARCH
     --------------------------------------------------------- */
  function initPredictiveSearch() {
    var overlay = document.querySelector('[data-search-overlay]');
    // Open / close overlay
    if (overlay) {
      document.querySelectorAll('[data-search-open]').forEach(function (el) {
        el.addEventListener('click', function () {
          overlay.setAttribute('aria-hidden', 'false');
          document.body.style.overflow = 'hidden';
          var inp = overlay.querySelector('input[type="search"]');
          if (inp) setTimeout(function () { inp.focus(); }, 60);
        });
      });
      overlay.querySelectorAll('[data-search-close]').forEach(function (el) {
        el.addEventListener('click', closeSearch);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });
    }
    function closeSearch() {
      if (!overlay) return;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    var wrap = document.querySelector('[data-predictive-search]');
    if (!wrap) return;
    var input = wrap.querySelector('input[type="search"]');
    var results = wrap.querySelector('[data-predictive-results]');
    if (!input || !results) return;
    var timer;

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; results.removeAttribute('data-open'); return; }
      timer = setTimeout(function () {
        fetch('/search/suggest.json?q=' + encodeURIComponent(q)
          + '&resources[type]=product&resources[limit]=6&resources[options][unavailable_products]=last')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var products = (data.resources && data.resources.results && data.resources.results.products) || [];
            if (!products.length) {
              results.innerHTML = '<p class="predictive__empty">No matches for "' + q + '"</p>';
              results.setAttribute('data-open', '');
              return;
            }
            results.innerHTML = products.map(function (p) {
              var img = p.featured_image && p.featured_image.url ? p.featured_image.url : '';
              var price = p.price ? p.price : '';
              return '<a href="' + p.url + '" class="predictive__item">'
                + (img ? '<img src="' + img + '" alt="" width="44" height="44" loading="lazy">' : '<span class="predictive__noimg"></span>')
                + '<span class="predictive__text"><span class="predictive__title">' + p.title + '</span>'
                + (price ? '<span class="predictive__price">' + price + '</span>' : '') + '</span></a>';
            }).join('') + '<a href="/search?q=' + encodeURIComponent(q) + '" class="predictive__all">See all results →</a>';
            results.setAttribute('data-open', '');
          })
          .catch(function () {});
      }, 220);
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) { results.removeAttribute('data-open'); }
    });
  }

  /* ---------------------------------------------------------
     SLIDESHOW
     --------------------------------------------------------- */
  function initSlideshows() {
    document.querySelectorAll('[data-slideshow]').forEach(function (slideshow) {
      var slides = Array.prototype.slice.call(slideshow.querySelectorAll('[data-slide]'));
      if (slides.length < 2) return;
      var dots = Array.prototype.slice.call(slideshow.querySelectorAll('[data-slide-dot]'));
      var current = 0;
      var interval = parseInt(slideshow.dataset.autoplay, 10) || 0;
      var timer;

      function go(i) {
        slides[current].classList.remove('is-active');
        if (dots[current]) dots[current].classList.remove('is-active');
        current = (i + slides.length) % slides.length;
        slides[current].classList.add('is-active');
        if (dots[current]) dots[current].classList.add('is-active');
      }
      function next() { go(current + 1); }
      function start() { if (interval > 0) timer = setInterval(next, interval); }
      function stop() { clearInterval(timer); }

      slideshow.querySelectorAll('[data-slide-next]').forEach(function (b) {
        b.addEventListener('click', function () { stop(); next(); start(); });
      });
      slideshow.querySelectorAll('[data-slide-prev]').forEach(function (b) {
        b.addEventListener('click', function () { stop(); go(current - 1); start(); });
      });
      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { stop(); go(i); start(); });
      });
      slideshow.addEventListener('mouseenter', stop);
      slideshow.addEventListener('mouseleave', start);
      start();
    });
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  /* ---------------------------------------------------------
     SCROLL REVEAL
     --------------------------------------------------------- */
  function initScrollReveal() {
    if (!window.IntersectionObserver) return;

    // Reveal individual .reveal elements
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      revealObs.observe(el);
    });

    // Stagger product grid items
    var gridObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var items = entry.target.querySelectorAll('.product-grid__item');
          items.forEach(function (item, i) {
            setTimeout(function () {
              item.classList.add('is-visible');
            }, i * 70);
          });
          gridObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    document.querySelectorAll('.product-grid').forEach(function (grid) {
      gridObs.observe(grid);
    });
  }

  /* ---------------------------------------------------------
     LIVE VIEWING COUNTER
     --------------------------------------------------------- */
  function initViewingCounter() {
    var el = document.querySelector('[data-viewing-count]');
    if (!el) return;
    var numEl = el.querySelector('.viewing-num');
    if (!numEl) return;
    var seed = parseInt(el.dataset.productId || '1', 10);
    var base = (seed % 14) + 5; // 5–18 range, consistent per product
    function update() {
      var n = base + Math.floor(Math.random() * 3) - 1;
      numEl.textContent = Math.max(3, n);
    }
    update();
    setInterval(update, 5000);
  }

  /* ---------------------------------------------------------
     WISHLIST (localStorage)
     --------------------------------------------------------- */
  var WISHLIST_KEY = 'ff-wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveWishlist(list) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); } catch(e) {}
  }
  function syncWishlistUI() {
    var list = getWishlist();
    // Update count bubbles
    document.querySelectorAll('.js-wishlist-count').forEach(function(el) {
      el.textContent = list.length;
      el.style.display = list.length > 0 ? 'flex' : 'none';
    });
    // Update heart states
    document.querySelectorAll('.js-wishlist-btn').forEach(function(btn) {
      var saved = list.some(function(i) { return i.handle === btn.dataset.handle; });
      btn.classList.toggle('is-wishlisted', saved);
      btn.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Save to wishlist');
    });
  }
  function initWishlist() {
    syncWishlistUI();
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.js-wishlist-btn');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      var list = getWishlist();
      var handle = btn.dataset.handle;
      var idx = list.findIndex(function(i) { return i.handle === handle; });
      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        list.push({ handle: handle, title: btn.dataset.title, price: btn.dataset.price, image: btn.dataset.image });
      }
      saveWishlist(list);
      syncWishlistUI();
    });
  }

  /* ---------------------------------------------------------
     FREQUENTLY BOUGHT TOGETHER — add bundle
     --------------------------------------------------------- */
  function initFBT() {
    var fbtBtn = document.querySelector('.js-fbt-add');
    if (!fbtBtn) return;
    fbtBtn.addEventListener('click', function() {
      var ids = [];
      var mainId = fbtBtn.dataset.mainVariant;
      if (mainId) ids.push(mainId);
      document.querySelectorAll('.fbt__item[data-variant-id]').forEach(function(item) {
        ids.push(item.dataset.variantId);
      });
      if (!ids.length) return;
      fbtBtn.disabled = true; fbtBtn.textContent = 'Adding…';
      // Add items sequentially
      ids.reduce(function(promise, id) {
        return promise.then(function() {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: id, quantity: 1 })
          });
        });
      }, Promise.resolve()).then(function() {
        return Cart.refresh();
      }).then(function() {
        fbtBtn.textContent = 'Added!';
        setTimeout(function() { fbtBtn.disabled = false; fbtBtn.textContent = 'Add bundle to cart'; }, 1500);
        Cart.open();
      }).catch(function() {
        fbtBtn.disabled = false; fbtBtn.textContent = 'Add bundle to cart';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Cart.init();
    initQuickAdd();
    initPredictiveSearch();
    initSlideshows();
    initScrollReveal();
    initViewingCounter();
    initWishlist();
    initFBT();
    window.FFCart = Cart;
  });
})();
