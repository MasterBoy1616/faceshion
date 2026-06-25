// Faceshion content bridge — captures the element under right-click and opens
// the try-on in an in-page extension overlay, including sites with custom DOMs.
(function () {
  var lastContext = { imageUrl: '', linkUrl: '', pageUrl: location.href };

  function absoluteUrl(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.split(',')[0].trim().split(/\s+/)[0];
    try { return new URL(url, location.href).toString(); } catch { return ''; }
  }

  function imageUrlFromElement(el) {
    if (!el || el.nodeType !== 1) return '';
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'img') {
      return absoluteUrl(el.currentSrc || el.src || el.getAttribute('src') || '');
    }
    if (tag === 'source') {
      return absoluteUrl(el.srcset || el.getAttribute('srcset') || '');
    }
    if (tag === 'video') {
      return absoluteUrl(el.poster || el.currentSrc || el.src || '');
    }
    var style = window.getComputedStyle(el);
    var bg = style && style.backgroundImage;
    var match = bg && bg.match(/url\((['"]?)(.*?)\1\)/i);
    return absoluteUrl(match && match[2] ? match[2] : '');
  }

  function area(rect) {
    return Math.max(0, rect.width || 0) * Math.max(0, rect.height || 0);
  }

  function imageNearPoint(root, x, y) {
    var best = null;
    var bestArea = Infinity;
    var nodes = [];
    if (root && root.querySelectorAll) {
      nodes = Array.prototype.slice.call(root.querySelectorAll('img,video,[style*="background-image"]'));
    }
    nodes.push.apply(nodes, Array.prototype.slice.call(document.querySelectorAll('img,video,[style*="background-image"]')));
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var rect = node.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) continue;
      var inside = x >= rect.left - 12 && x <= rect.right + 12 && y >= rect.top - 12 && y <= rect.bottom + 12;
      if (!inside) continue;
      var url = imageUrlFromElement(node);
      if (!url) continue;
      var a = area(rect);
      if (a < bestArea) {
        best = url;
        bestArea = a;
      }
    }
    return best || '';
  }

  function captureContext(event) {
    var path = event.composedPath ? event.composedPath() : [];
    var imageUrl = '';
    var linkUrl = '';

    for (var i = 0; i < path.length; i += 1) {
      var el = path[i];
      if (!el || el.nodeType !== 1) continue;
      if (!imageUrl) imageUrl = imageUrlFromElement(el);
      if (!linkUrl && el.closest) {
        var link = el.closest('a[href]');
        if (link) linkUrl = absoluteUrl(link.href || link.getAttribute('href') || '');
      }
      if (imageUrl && linkUrl) break;
    }

    if (!imageUrl) {
      var target = document.elementFromPoint(event.clientX, event.clientY) || event.target;
      var root = target && target.closest ? (target.closest('article,main,section,div[role="dialog"],div') || target) : target;
      imageUrl = imageNearPoint(root, event.clientX, event.clientY);
    }

    lastContext = {
      imageUrl: imageUrl || '',
      linkUrl: linkUrl || '',
      pageUrl: location.href,
    };
    try {
      chrome.runtime.sendMessage({ type: 'faceshion:update-context-title', hasImage: !!lastContext.imageUrl });
    } catch {}
  }

  function removeOverlay() {
    var existing = document.querySelector('[data-faceshion-overlay="1"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
  }

  function openExtensionOverlay(href) {
    removeOverlay();
    var isDesktop = window.innerWidth >= 768;
    var overlay = document.createElement('div');
    overlay.setAttribute('data-faceshion-overlay', '1');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(8,8,12,0.72)',
      '-webkit-backdrop-filter:blur(10px)', 'backdrop-filter:blur(10px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:' + (isDesktop ? '32px' : '0'),
      'opacity:0', 'transition:opacity 180ms ease-out',
    ].join(';');

    var wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:relative', 'width:100%',
      'height:' + (isDesktop ? '94vh' : '100%'),
      'max-width:' + (isDesktop ? '1100px' : '100%'),
      'max-height:' + (isDesktop ? '94vh' : '100%'),
      'background:#0a0a0a',
      'border-radius:' + (isDesktop ? '20px' : '0'),
      'overflow:hidden', 'box-shadow:0 30px 80px rgba(0,0,0,0.6)',
      'transform:translateY(8px)',
      'transition:transform 220ms cubic-bezier(.2,.8,.2,1)',
    ].join(';');

    var frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('overlay.html') + '?target=' + encodeURIComponent(href);
    frame.setAttribute('allow', 'camera; microphone; clipboard-read; clipboard-write; fullscreen');
    frame.setAttribute('allowfullscreen', 'true');
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0a0a0a';

    function onKey(e) { if (e.key === 'Escape') removeOverlay(); }
    function onMessage(e) {
      if (e && e.data && e.data.type === 'faceshion:close-overlay') removeOverlay();
    }

    overlay.addEventListener('click', function (e) { if (e.target === overlay) removeOverlay(); });
    document.addEventListener('keydown', onKey, { once: true });
    window.addEventListener('message', onMessage);
    wrap.appendChild(frame);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      wrap.style.transform = 'translateY(0)';
    });
  }

  document.addEventListener('contextmenu', captureContext, true);
  document.addEventListener('mousedown', function (event) {
    if (event.button === 2) captureContext(event);
  }, true);

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (message && message.type === 'faceshion:get-context') {
      sendResponse(lastContext);
      return;
    }
    if (message && message.type === 'faceshion:open-overlay') {
      openExtensionOverlay(message.href);
      sendResponse({ ok: true });
    }
  });
}());