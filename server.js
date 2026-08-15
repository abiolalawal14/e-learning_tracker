const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "board.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");

function ensureBoard() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(SEED_FILE, DATA_FILE);
  }
}

function readBoard() {
  ensureBoard();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeBoard(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/board", (req, res) => {
  res.json(readBoard());
});

app.put("/api/board", (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Expected the board as a JSON array of tasks." });
  }
  writeBoard(req.body);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

app.post("/api/reset", (req, res) => {
  fs.copyFileSync(SEED_FILE, DATA_FILE);
  res.json(readBoard());
});

app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log("NPHCDA Onboarding Tracker listening on port " + PORT);
});
