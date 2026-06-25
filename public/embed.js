/**
 * Faceshion Try-On Embed (Overlay)
 *
 * Usage on merchant product page:
 *   <a class="faceshion-tryon" data-product-url="https://your-store.com/products/dress-123" data-ref="MERCHANT_ID">
 *     Üzerimde Dene
 *   </a>
 *   <script async src="https://faceshion.app/embed.js"></script>
 *
 * Click opens the try-on as a fullscreen iframe overlay on the merchant page —
 * the user never leaves the store. The iframe posts `{type:'faceshion:close'}` 
 * via window.postMessage to request close (also handled here on ESC / backdrop).
 */
(function () {
  var ORIGIN = 'https://faceshion.app';
  var BASE = ORIGIN + '/merchant/tryon';
  var BRANDING_API = ORIGIN + '/api/public/merchant-branding';
  var brandingCache = {};
  var currentOverlay = null;

  function buildHref(el) {
    var product = el.getAttribute('data-product-url') || window.location.href;
    var ref = el.getAttribute('data-ref') || '';
    var params = new URLSearchParams();
    params.set('url', product);
    params.set('embed', '1');
    if (ref) params.set('ref', ref);
    return BASE + '?' + params.toString();
  }

  function applyStyle(el, branding) {
    var primary = (branding && branding.brand_primary_color) || '#7c3aed';
    var accent = (branding && branding.brand_accent_color) || '#ec4899';
    var label = (branding && branding.brand_button_label) || el.getAttribute('data-label') || (el.dataset.faceshionOriginalText || '').trim() || 'Üzerimde Dene';
    var logo = branding && branding.brand_logo_url;

    el.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'padding:12px 20px',
      'background:linear-gradient(135deg,' + primary + ',' + accent + ')',
      'color:#fff',
      'font-weight:600',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:15px',
      'border-radius:9999px',
      'text-decoration:none',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,0.18)',
      'transition:transform .15s ease, box-shadow .15s ease',
      'border:none',
    ].join(';');

    var safeLabel = String(label).replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
    if (logo) {
      var safeLogo = String(logo).replace(/"/g, '&quot;');
      el.innerHTML = '<img src="' + safeLogo + '" alt="" style="height:20px;width:20px;border-radius:4px;object-fit:cover" />' + safeLabel;
    } else {
      el.innerHTML = '✨ ' + safeLabel;
    }
  }

  function styleButton(el) {
    if (el.dataset.faceshionStyled === '1') return;
    el.dataset.faceshionStyled = '1';
    if (!el.dataset.faceshionOriginalText) {
      el.dataset.faceshionOriginalText = (el.textContent || '').trim();
    }
    applyStyle(el, null);

    var ref = el.getAttribute('data-ref');
    if (!ref) return;

    var apply = function (branding) { applyStyle(el, branding); };
    if (brandingCache[ref]) {
      if (typeof brandingCache[ref].then === 'function') {
        brandingCache[ref].then(apply);
      } else {
        apply(brandingCache[ref]);
      }
      return;
    }
    brandingCache[ref] = fetch(BRANDING_API + '?ref=' + encodeURIComponent(ref))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { brandingCache[ref] = json || {}; return brandingCache[ref]; })
      .catch(function () { brandingCache[ref] = {}; return {}; });
    brandingCache[ref].then(apply);
  }

  function closeOverlay() {
    if (!currentOverlay) return;
    var o = currentOverlay;
    currentOverlay = null;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('message', onMessage);
    if (o.parentNode) o.parentNode.removeChild(o);
    document.documentElement.style.overflow = o.dataset.prevHtmlOverflow || '';
    document.body.style.overflow = o.dataset.prevBodyOverflow || '';
  }

  function onKey(e) { if (e.key === 'Escape') closeOverlay(); }
  function onMessage(e) {
    if (!e || !e.data) return;
    if (e.data && e.data.type === 'faceshion:close') closeOverlay();
  }

  function openOverlay(href) {
    if (currentOverlay) closeOverlay();

    var overlay = document.createElement('div');
    overlay.setAttribute('data-faceshion-overlay', '1');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'background:rgba(8,8,12,0.72)',
      '-webkit-backdrop-filter:blur(10px)',
      'backdrop-filter:blur(10px)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:0',
      'opacity:0',
      'transition:opacity 180ms ease-out',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    var isDesktop = window.innerWidth >= 768;

    var frameWrap = document.createElement('div');
    frameWrap.style.cssText = [
      'position:relative',
      'width:100%',
      'height:100%',
      'max-width:' + (isDesktop ? '1100px' : '100%'),
      'max-height:100%',
      'background:#0a0a0a',
      'border-radius:0',
      'overflow:hidden',
      'box-shadow:0 30px 80px rgba(0,0,0,0.6)',
      'transform:translateY(8px)',
      'transition:transform 220ms cubic-bezier(.2,.8,.2,1)',
    ].join(';');

    // Centered modal look on desktop — wider, padded, rounded
    if (isDesktop) {
      overlay.style.padding = '32px';
      frameWrap.style.borderRadius = '20px';
      frameWrap.style.maxHeight = '94vh';
      frameWrap.style.height = '94vh';
      frameWrap.style.width = '100%';
    }


    var iframe = document.createElement('iframe');
    iframe.src = href;
    iframe.setAttribute('allow', 'camera; microphone; clipboard-read; clipboard-write; fullscreen');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', 'Faceshion Try-On');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0a0a0a';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'width:38px',
      'height:38px',
      'border-radius:9999px',
      'background:rgba(255,255,255,0.95)',
      'color:#111',
      'border:0',
      'font-size:18px',
      'line-height:1',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 4px 14px rgba(0,0,0,0.35)',
      'z-index:2',
    ].join(';');
    closeBtn.onclick = closeOverlay;

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    frameWrap.appendChild(iframe);
    frameWrap.appendChild(closeBtn);
    overlay.appendChild(frameWrap);
    document.body.appendChild(overlay);

    overlay.dataset.prevHtmlOverflow = document.documentElement.style.overflow || '';
    overlay.dataset.prevBodyOverflow = document.body.style.overflow || '';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    currentOverlay = overlay;
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', onMessage);

    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      frameWrap.style.transform = 'translateY(0)';
    });
  }

  function attach(el) {
    if (el.dataset.faceshionAttached === '1') return;
    el.dataset.faceshionAttached = '1';

    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openOverlay(buildHref(el));
    });

    // Keep href for accessibility / right-click "open in new tab" fallback
    if (el.tagName === 'A') {
      el.setAttribute('href', buildHref(el));
      el.setAttribute('rel', 'noopener');
    }
    if (el.getAttribute('data-style') !== 'none') styleButton(el);
  }

  function init() {
    var nodes = document.querySelectorAll('.faceshion-tryon, [data-faceshion-tryon]');
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
