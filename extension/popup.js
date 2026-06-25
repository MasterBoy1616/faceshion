document.getElementById('go').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'faceshion:open-overlay' });
  } finally {
    window.close();
  }
});
