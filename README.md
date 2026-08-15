# NPHCDA Onboarding Tracker

A shared progress board for the NPHCDA Health Worker LMS onboarding programme. Everyone on the team opens the same web address and sees the same board — no separate files to pass around.

This guide assumes no technical background. If a step doesn't work exactly as described, screenshot the error and send it back for a fix.

## What you need installed

**Docker Desktop** — this is the only thing you need. It's free.
Download: https://www.docker.com/products/docker-desktop/
Install it like any other program, then open it once and leave it running in the background (you'll see a whale icon in your system tray when it's ready).

## Starting the tracker

1. Open a terminal (on Windows: search for "PowerShell" in the Start menu) and navigate into this folder:
   ```
   cd "path\to\TLS_Project\tracker-app"
   ```
2. Run:
   ```
   docker compose up -d
   ```
   The first time, this takes a minute or two while it sets itself up. After that it starts in a few seconds.
3. Open a browser and go to: **http://localhost:8080**

That's it — the board loads with the current plan already on it.

## Stopping it

```
docker compose down
```
Your data is safe — it's saved to the `data/` folder in this project, not inside the container. Starting it again with `docker compose up -d` picks up right where you left off.

## Sharing it with the team

Right now this runs on one machine (yours), reachable only as `localhost:8080` — that means only people using *that same machine* can open it.

To let teammates on other computers reach it, this needs to move to a server that's always on and reachable over your network or the internet (a small VPS, or a machine in your office). The app itself doesn't need to change for that — only *where* it runs. When you're ready to do that, come back and it can be pointed at a real server with a proper address instead of `localhost`.

## Backing up your data

Everything the team enters lives in one file: `data/board.json`. Copy that file anywhere (OneDrive, email, USB) to back it up. There's also an **Export backup** button on the page itself that downloads a snapshot as a JSON file straight from the browser.

## Starting over

If you ever want to wipe the board back to the original seeded plan, click **Reset to original plan** at the bottom of the page — this affects everyone, so use it deliberately, not to undo a single mistake.

## What's actually happening, in plain terms

- Docker packages the whole app (a small web server + the board's data) into one self-contained unit called a "container," so it runs the same way on any machine without needing separate setup.
- The app itself is a small Node.js web server. It serves the board page and reads/writes `data/board.json` whenever anyone edits a task.
- Everyone who has the page open gets the latest data automatically (it quietly re-checks every 20 seconds), so you don't need to refresh manually to see a teammate's update.
