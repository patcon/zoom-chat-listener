# Zoom Chat Listener

This is a script for launching a Zoom web client, logging into a meeting, and watching for new messages.

The intent is to allow a script to read interactions within a non-privileged zoom call. The end goal is to see whether it's possible to allow Polis-like vote interactions from within a Zoom call chat interface.

Currently, headless mode doesn't work, because one needs to manually click the "Chat" button to open the chat window.

Also, neither threading nor emoji reactions work yet, just detection of any message (threaded or unthreaded).
