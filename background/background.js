// ── LETMEAPPLY BACKGROUND SERVICE WORKER ──

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[LetMeApply] Extension installed. Open a job page to get started!');
  }
});

// Keep service worker alive for longer operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ status: 'alive' });
  }
  return true;
});
