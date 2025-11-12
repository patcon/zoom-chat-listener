import 'dotenv/config';
import { chromium } from 'playwright';

const ZOOM_LINK = process.argv[2];
if (!ZOOM_LINK) {
  console.error('Usage: node zoom-chat-listener.js <zoom-join-link>');
  process.exit(1);
}

function parseZoomLink(link) {
  const match = link.match(/\/j\/(\d+)(?:\?pwd=([\w-]+))?/);
  if (!match) throw new Error('Invalid Zoom link');
  return { meetingId: match[1], password: match[2] || null };
}

const { meetingId, password } = parseZoomLink(ZOOM_LINK);

const DISPLAY_NAME = process.env.DISPLAY_NAME || 'ChatBot';
const HEADLESS = process.env.HEADLESS !== 'false';

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🔗 Joining meeting ${meetingId} as ${DISPLAY_NAME}...`);

  const joinUrl = `https://zoom.us/wc/join/${meetingId}?pwd=${password || ''}`;
  await page.goto(joinUrl);

  // Wait for name input (if present)
  await page.waitForSelector('input#inputname', { timeout: 15000 }).catch(() => {});
  const nameInput = await page.$('input#inputname');
  if (nameInput) {
    await nameInput.fill(DISPLAY_NAME);
    const joinBtn = await page.$('button.joinBtn');
    if (joinBtn) await joinBtn.click();
  }

  // Wait for chat to load
  console.log('💬 Waiting for chat messages...');
  await page.waitForSelector('.chat-message__text, .chat-item__chat-info', { timeout: 60000 }).catch(() => {
    console.log('⚠️ No chat detected (chat might be disabled or hidden).');
  });

  // Continuously monitor new chat messages
  await page.exposeFunction('onNewChat', (msg) => {
    console.log(msg);
  });

  await page.evaluate(() => {
    const seen = new Set();
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.chat-message__text, .chat-item__chat-info').forEach((el) => {
        const parent = el.closest('.chat-item__chat-info, .chat-message');
        const nameEl = parent?.querySelector('.chat-message__sender, .chat-item__sender') || {};
        const msgText = el.textContent?.trim();
        const name = nameEl.textContent?.trim() || 'Unknown';
        const key = `${name}:${msgText}`;
        if (!seen.has(key) && msgText) {
          seen.add(key);
          window.onNewChat(`${name}: ${msgText}`);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  console.log('✅ Listening for new chat messages...');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
