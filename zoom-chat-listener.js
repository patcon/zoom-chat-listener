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

  async function skipMicCameraDialog(page) {
    for (let i = 0; i < 2; i++) { // try twice
      try {
        const btn = await page.waitForSelector(
          'span.pepc-permission-dialog__footer-button',
          { timeout: 5000 }
        );
        if (btn) {
          await btn.click();
          console.log('✅ Skipped camera/microphone permissions');
        }
      } catch {
        console.log('⚠️ No camera/mic permission dialog appeared');
      }
      await page.waitForTimeout(500); // small delay in case the second dialog appears
    }
  }
  await skipMicCameraDialog(page);

  // Enter guest display name
  try {
    await page.waitForSelector('input#input-for-name', { timeout: 10000 });
    const nameInput = await page.$('input#input-for-name');
    if (nameInput) {
      await nameInput.fill(DISPLAY_NAME);

      const joinBtn = await page.$('button.preview-join-button');
      await page.waitForFunction(
        btn => btn && !btn.classList.contains('disabled'),
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

  // Open chat panel (new Zoom UI)
  try {
    const chatBtn = await page.waitForSelector(
      'button.footer-button-base__button[aria-label="open the chat panel"]',
      { timeout: 10000, state: 'visible' }
    );
    await chatBtn.click();
    console.log('✅ Chat panel opened');
  } catch {
    console.log('⚠️ Chat panel button not found');
  }

  await page.exposeFunction('onNewChat', (text, userid) => {
    console.log(`UserID ${userid}: ${text}`);
  });

  await page.evaluate(() => {
    const seen = new Set();

    const container = document.querySelector('div.new-chat-message__list-container') || document.body;

    const observer = new MutationObserver(() => {
      container.querySelectorAll('div.new-chat-message__container').forEach(msgEl => {
        const msgId = msgEl.id;
        if (seen.has(msgId)) return;
        seen.add(msgId);

        // Get message text from aria-label
        const ariaLabel = msgEl.getAttribute('aria-label');
        if (!ariaLabel) return;
        // e.g., "Patrick Connolly to Everyone, 02:22 PM, testing"
        const match = ariaLabel.match(/^(.+?) to .*?, .*?, (.+)$/);
        if (!match) return;

        const usernameFromLabel = match[1];
        const messageText = match[2];

        // Carefully traverse to the sender span
        let senderSpan = null;
        const wrap = msgEl.closest('.new-chat-item__chat-msg-wrap');
        if (wrap) {
          senderSpan = wrap.querySelector('.chat-item__sender');
        }

        const userid = senderSpan ? senderSpan.getAttribute('data-userid') : 'unknown';
        const username = senderSpan ? senderSpan.getAttribute('data-name') : usernameFromLabel;

        window.onNewChat(`${username}: ${messageText}`, userid);
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  });

  console.log('✅ Listening for new chat messages...');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
