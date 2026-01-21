import { createBroadcast, createPlayer } from "@daydreamlive/browser";

const inputVideo = document.getElementById("inputVideo");
const outputVideo = document.getElementById("outputVideo");
const inputDot = document.getElementById("inputDot");
const outputDot = document.getElementById("outputDot");
const inputState = document.getElementById("inputState");
const outputState = document.getElementById("outputState");
const spinner = document.getElementById("spinner");
const startBtn = document.getElementById("startBtn");
const updateBtn = document.getElementById("updateBtn");
const stopBtn = document.getElementById("stopBtn");
const promptInput = document.getElementById("promptInput");
const idleControls = document.getElementById("idleControls");
const liveControls = document.getElementById("liveControls");
const errorEl = document.getElementById("error");

let streamInfo = null;
let mediaStream = null;
let broadcast = null;
let player = null;
let started = false;

async function createStream(prompt) {
  const res = await fetch("/api/streams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to create stream");
  return res.json();
}

async function updateStream(id, prompt) {
  const res = await fetch(`/api/streams/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Failed to update stream");
  return res.json();
}

function updateUI() {
  const broadcastState = broadcast?.state ?? "idle";
  const playerState = player?.state ?? "idle";

  inputState.textContent = broadcastState;
  outputState.textContent = playerState;

  inputDot.classList.toggle("live", broadcastState === "live");
  outputDot.classList.toggle("playing", playerState === "playing");

  const isLive = broadcastState === "live";
  idleControls.classList.toggle("hidden", isLive);
  liveControls.classList.toggle("hidden", !isLive);

  const showSpinner = started && playerState !== "playing";
  spinner.classList.toggle("visible", showSpinner);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.classList.add("hidden");
}

async function handleStart() {
  if (!mediaStream || !streamInfo) return;

  clearError();
  started = true;

  broadcast = createBroadcast({
    whipUrl: streamInfo.whipUrl,
    stream: mediaStream,
    reconnect: { enabled: true, maxAttempts: 5, baseDelayMs: 1000 },
  });

  broadcast.on("stateChange", (state) => {
    updateUI();

    if (state === "live" && broadcast.whepUrl) {
      startPlayer(broadcast.whepUrl);
    }
  });

  broadcast.on("error", (err) => {
    showError(err.message);
  });

  try {
    await broadcast.connect();
  } catch (err) {
    showError(err.message);
  }
}

async function startPlayer(whepUrl) {
  if (player) {
    await player.stop();
  }

  player = createPlayer(whepUrl, {
    reconnect: { enabled: true, maxAttempts: 30, baseDelayMs: 200 },
  });

  player.on("stateChange", (state) => {
    updateUI();
    if (state === "playing") {
      player.attachTo(outputVideo);
    }
  });

  player.on("error", (err) => {
    showError(err.message);
  });

  try {
    await player.connect();
  } catch (err) {
    showError(err.message);
  }
}

async function handleStop() {
  started = false;

  if (player) {
    await player.stop();
    player = null;
  }

  if (broadcast) {
    await broadcast.stop();
    broadcast = null;
  }

  streamInfo = null;
  updateUI();

  try {
    streamInfo = await createStream(promptInput.value);
  } catch (err) {
    showError(err.message);
  }
}

async function handleUpdate() {
  if (!streamInfo) return;

  updateBtn.disabled = true;
  updateBtn.textContent = "...";

  try {
    await updateStream(streamInfo.id, promptInput.value);
  } catch (err) {
    showError(err.message);
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = "Update";
  }
}

async function init() {
  try {
    const [info, stream] = await Promise.all([
      createStream("cyberpunk, high quality"),
      navigator.mediaDevices.getUserMedia({
        video: { width: 512, height: 512 },
        audio: true,
      }),
    ]);

    streamInfo = info;
    mediaStream = stream;
    inputVideo.srcObject = stream;

    startBtn.disabled = false;
    startBtn.textContent = "Start";
  } catch (err) {
    showError(err.message);
  }
}

startBtn.addEventListener("click", handleStart);
stopBtn.addEventListener("click", handleStop);
updateBtn.addEventListener("click", handleUpdate);
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleUpdate();
});

init();
