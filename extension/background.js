// Faceshion right-click try-on — background service worker
// Opens the try-on as a centered modal overlay (iframe) on the current page,
// instead of navigating to a new tab. Mirrors the Shopify embed behavior.
const FACESHION_ORIGIN = 'https://faceshion.app';

function buildTryonUrl({ productUrl, imageUrl, src }) {
  const params = new URLSearchParams();
  if (productUrl) params.set('url', productUrl);
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) params.set('image', imageUrl);
  params.set('embed', '1');
  params.set('src', src || 'extension');
  return `${FACESHION_ORIGIN}/tryon?${params.toString()}`;
}

async function getCapturedContext(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'faceshion:get-context' });
  } catch {
    return null;
  }
}

// Injected into the active page. Builds the modal overlay + iframe.
function injectOverlay(href, overlayBaseUrl) {
  try {
    var existing = document.querySelector('[data-faceshion-overlay="1"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.setAttribute('data-faceshion-overlay', '1');
    var isDesktop = window.innerWidth >= 768;
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'background:rgba(8,8,12,0.72)',
      '-webkit-backdrop-filter:blur(10px)', 'backdrop-filter:blur(10px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:' + (isDesktop ? '32px' : '0'),
      'opacity:0', 'transition:opacity 180ms ease-out',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    var frameWrap = document.createElement('div');
    frameWrap.style.cssText = [
      'position:relative', 'width:100%',
      'height:' + (isDesktop ? '94vh' : '100%'),
      'max-width:' + (isDesktop ? '1100px' : '100%'),
      'max-height:' + (isDesktop ? '94vh' : '100%'),
      'background:#0a0a0a',
      'border-radius:' + (isDesktop ? '20px' : '0'),
      'overflow:hidden',
      'box-shadow:0 30px 80px rgba(0,0,0,0.6)',
      'transform:translateY(8px)',
      'transition:transform 220ms cubic-bezier(.2,.8,.2,1)',
    ].join(';');

    var iframe = document.createElement('iframe');
    iframe.src = overlayBaseUrl ? overlayBaseUrl + '?target=' + encodeURIComponent(href) : href;
    iframe.setAttribute('allow', 'camera; microphone; clipboard-read; clipboard-write; fullscreen');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', 'Faceshion Try-On');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0a0a0a';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = [
      'position:absolute', 'top:12px', 'right:12px',
      'width:38px', 'height:38px', 'border-radius:9999px',
      'background:rgba(255,255,255,0.95)', 'color:#111', 'border:0',
      'font-size:18px', 'line-height:1', 'cursor:pointer',
      'display:flex', 'align-items:center', 'justify-content:center',
      'box-shadow:0 4px 14px rgba(0,0,0,0.35)', 'z-index:2',
    ].join(';');

    var prevHtmlOverflow = document.documentElement.style.overflow || '';
    var prevBodyOverflow = document.body.style.overflow || '';

    function close() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMessage);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function onMessage(e) {
      if (e && e.data && e.data.type === 'faceshion:close') close();
    }

    closeBtn.onclick = close;
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    frameWrap.appendChild(iframe);
    frameWrap.appendChild(closeBtn);
    overlay.appendChild(frameWrap);
    document.body.appendChild(overlay);

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', onMessage);

    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      frameWrap.style.transform = 'translateY(0)';
    });
  } catch (err) {
    console.error('[Faceshion] overlay inject failed', err);
  }
}

async function openOverlayInTab(tabId, href) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'faceshion:open-overlay', href });
    if (response && response.ok) return;
  } catch {
    // Content script may not exist on tabs opened before install/update.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectOverlay,
      args: [href, chrome.runtime.getURL('overlay.html')],
    });
  } catch (err) {
    // Fallback: some pages (chrome://, web store) disallow injection — open new tab
    console.warn('[Faceshion] inject failed, falling back to new tab', err);
    chrome.tabs.create({ url: href });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'faceshion-tryon-page',
      title: 'Faceshion ile görseli/ürünü dene',
      contexts: ['page', 'link', 'selection'],
    });
    chrome.contextMenus.create({
      id: 'faceshion-tryon-image',
      title: 'Faceshion ile bu görseli dene',
      contexts: ['image'],
      documentUrlPatterns: ['<all_urls>'],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const captured = await getCapturedContext(tab.id);
  const productUrl = info.linkUrl || captured?.linkUrl || info.pageUrl || tab.url || '';
  const imageUrl = info.srcUrl || captured?.imageUrl || undefined;
  const href = buildTryonUrl({ productUrl, imageUrl, src: 'extension' });
  openOverlayInTab(tab.id, href);
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  const href = buildTryonUrl({ productUrl: tab.url || '', src: 'extension-action' });
  openOverlayInTab(tab.id, href);
});

// Allow popup.html to request an overlay on the active tab
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'faceshion:update-context-title') {
    chrome.contextMenus.update('faceshion-tryon-page', {
      title: msg.hasImage ? 'Faceshion ile bu görseli dene' : 'Faceshion ile görseli/ürünü dene',
    }, () => void chrome.runtime.lastError);
    return;
  }

  if (msg && msg.type === 'faceshion:open-overlay') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) { sendResponse({ ok: false }); return; }
      const href = buildTryonUrl({ productUrl: tab.url || '', src: 'extension-popup' });
      openOverlayInTab(tab.id, href).then(() => sendResponse({ ok: true }));
    });
    return true; // async
  }
});
