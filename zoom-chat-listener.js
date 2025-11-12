import 'dotenv/config';
import { chromium } from 'playwright';

const ZOOM_LINK = process.argv[2];
if (!ZOOM_LINK) {
  console.error('Usage: node zoom-chat-listener.js <zoom-join-link>');
  process.exit(1);
}

// Parse Zoom meeting ID and password from URL
function parseZoomLink(link) {
  const match = link.match(/\/j\/(\d+)(?:\?pwd=([\w-]+))?/);
  if (!match) throw new Error('Invalid Zoom link');
  return { meetingId: match[1], password: match[2] || '' };
}

const { meetingId, password } = parseZoomLink(ZOOM_LINK);
const DISPLAY_NAME = process.env.DISPLAY_NAME || 'ChatBot';
const HEADLESS = process.env.HEADLESS !== 'false';

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🔗 Joining meeting ${meetingId} as ${DISPLAY_NAME}...`);

  const joinUrl = `https://zoom.us/wc/join/${meetingId}?pwd=${password}`;
  await page.goto(joinUrl);

  // Skip camera/mic permission dialog
  try {
    await page.waitForSelector(
      'span.pepc-permission-dialog__footer-button',
      { timeout: 5000 }
    );
    await page.click('span.pepc-permission-dialog__footer-button');
    console.log('✅ Skipped camera/microphone permissions');
  } catch {
    console.log('⚠️ No camera/mic permission dialog appeared');
  }


  await page.waitForSelector(
    'span.pepc-permission-dialog__footer-button',
    { timeout: 5000 }
  );
  await page.click('span.pepc-permission-dialog__footer-button');
  console.log('✅ Skipped camera/microphone permissions');

  // Wait for the name input (if present)
  try {
    await page.waitForSelector('input#input-for-name', { timeout: 10000 });
    const nameInput = await page.$('input#input-for-name');
    if (nameInput) {
      await nameInput.fill(DISPLAY_NAME);

      // Wait until the Join button becomes enabled
      const joinBtn = await page.$('button.preview-join-button');
      await page.waitForFunction(
        btn => !btn.classList.contains('disabled'),
        joinBtn
      );

      await joinBtn.click();
      console.log(`✅ Submitted display name: ${DISPLAY_NAME}`);
    }
  } catch {
    console.log('⚠️ Name input not detected, continuing...');
  }

  // Handle waiting room: auto-click Admit
  try {
    await page.waitForSelector('button.admit-button', { timeout: 5000 });
    await page.click('button.admit-button');
    console.log('✅ Clicked Admit button (waiting room)');
  } catch {
    console.log('⚠️ No waiting room detected or already admitted');
  }

  // Open chat panel
  try {
    await page.waitForSelector('button[aria-label="Open Chat"]', { timeout: 5000 });
    await page.click('button[aria-label="Open Chat"]');
    console.log('✅ Chat panel opened');
  } catch {
    console.log('⚠️ Chat panel not detected (might be hidden or disabled)');
  }

  // Expose a terminal logger for chat messages
  await page.exposeFunction('onNewChat', (msg) => {
    console.log(msg);
  });

  // Monitor chat messages
  await page.evaluate(() => {
    const seen = new Set();
    const observer = new MutationObserver(() => {
      // Zoom chat messages have various selectors depending on region/UI version
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
