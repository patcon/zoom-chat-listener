# Zoom Chat Listener

This is a script for launching a Zoom web client, logging into a meeting, and watching for new messages.

The intent is to allow a script to read interactions within a non-privileged zoom call. The end goal is to see whether it's possible to allow Polis-like vote interactions from within a Zoom call chat interface.

Currently, headless mode doesn't work, because one needs to manually click the "Chat" button to open the chat window.

Also, neither threading nor emoji reactions work yet, just detection of any message (threaded or unthreaded).

## Usage

1. Ensure `headless=false` in `.env`
2. Create a zoom meeting link. Personal meeting rooms work well.
3. Turn off the waiting room (there is code to wait, but it perhaps doesn't work)
4. Run `npm start -- https://us05web.zoom.us/j/7439777370?pwd=xxxxx` with your link
5. Manually open the chat dialog when browser opens to that page.
6. Type some messages and watch them show up in terminal.
