const board = document.querySelector("#board");
const emptyState = document.querySelector("#emptyState");
const cameraButton = document.querySelector("#cameraButton");
const galleryButton = document.querySelector("#galleryButton");
const clearButton = document.querySelector("#clearButton");
const downloadButton = document.querySelector("#downloadButton");
const cameraInput = document.querySelector("#cameraInput");
const galleryInput = document.querySelector("#galleryInput");
const todayCount = document.querySelector("#todayCount");
const trackerCopy = document.querySelector("#trackerCopy");
const weekStrip = document.querySelector("#weekStrip");
const layers = [];

const DAILY_TARGET = 3;
const STORAGE_KEY = "daily-img-mix-progress";
const MIN_OPACITY = 0.28;
const MAX_OPACITY = 0.5;
const MIN_CROP_RATIO = 0.04;
const MAX_CROP_RATIO = 0.16;
const EFFECT_PRESETS = [
  {
    blendMode: "multiply",
    rotation: [-2, 2],
    scale: [1, 1.04],
    filter: () =>
      `contrast(${randomNumber(1.02, 1.14).toFixed(2)}) saturate(${randomNumber(0.95, 1.08).toFixed(2)})`,
  },
  {
    blendMode: "darken",
    rotation: [-3, 3],
    scale: [0.99, 1.03],
    filter: () =>
      `contrast(${randomNumber(1.04, 1.18).toFixed(2)}) brightness(${randomNumber(0.92, 1).toFixed(2)})`,
  },
  {
    blendMode: "overlay",
    rotation: [-4, 4],
    scale: [1, 1.05],
    filter: () =>
      `contrast(${randomNumber(1.08, 1.22).toFixed(2)}) saturate(${randomNumber(1.02, 1.18).toFixed(2)})`,
  },
  {
    blendMode: "soft-light",
    rotation: [-2.5, 2.5],
    scale: [1, 1.06],
    filter: () =>
      `sepia(${randomNumber(0.04, 0.16).toFixed(2)}) contrast(${randomNumber(1.04, 1.12).toFixed(2)})`,
  },
];

cameraButton.addEventListener("click", () => cameraInput.click());
galleryButton.addEventListener("click", () => galleryInput.click());
clearButton.addEventListener("click", clearBoard);
downloadButton.addEventListener("click", downloadComposition);

cameraInput.addEventListener("change", (event) => handleInputChange(event.target.files));
galleryInput.addEventListener("change", (event) => handleInputChange(event.target.files));
renderWeeklyProgress();

["dragenter", "dragover"].forEach((eventName) => {
  board.addEventListener(eventName, (event) => {
    event.preventDefault();
    board.classList.add("is-dragging");
  });
});

["dragleave", "dragend", "drop"].forEach((eventName) => {
  board.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === "drop") {
      handleInputChange(event.dataTransfer.files);
    }

    if (!board.contains(event.relatedTarget)) {
      board.classList.remove("is-dragging");
    }
  });
});

document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  if (!board.contains(event.target)) {
    handleInputChange(event.dataTransfer.files);
    board.classList.remove("is-dragging");
  }
});

async function handleInputChange(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    return;
  }

  for (const file of files) {
    try {
      const dataUrl = await makeRandomSquareCrop(file);
      addTile(dataUrl);
      incrementTodayCount();
    } catch (error) {
      console.error("이미지 처리 실패", error);
    }
  }

  cameraInput.value = "";
  galleryInput.value = "";
}

function clearBoard() {
  board.querySelectorAll(".mix-tile").forEach((tile) => tile.remove());
  layers.length = 0;
  emptyState.hidden = false;
}

function addTile(src) {
  emptyState.hidden = true;

  const tile = document.createElement("figure");
  tile.className = "mix-tile";

  const image = document.createElement("img");
  image.src = src;
  image.alt = "랜덤하게 잘린 업로드 이미지";

  const opacity = randomNumber(MIN_OPACITY, MAX_OPACITY);
  const zIndex = board.querySelectorAll(".mix-tile").length + 1;
  const effect = pickRandom(EFFECT_PRESETS);
  const rotation = randomNumber(effect.rotation[0], effect.rotation[1]);
  const scale = randomNumber(effect.scale[0], effect.scale[1]);
  const flipX = Math.random() < 0.18 ? -1 : 1;
  const flipY = Math.random() < 0.1 ? -1 : 1;
  const filter = effect.filter();

  tile.style.opacity = opacity.toFixed(2);
  tile.style.zIndex = String(zIndex);
  tile.style.mixBlendMode = effect.blendMode;
  tile.style.transform = `scale(${(scale * flipX).toFixed(3)}, ${(scale * flipY).toFixed(3)}) rotate(${rotation.toFixed(2)}deg)`;
  image.style.filter = filter;

  tile.append(image);
  board.append(tile);
  layers.push({
    src,
    opacity,
    blendMode: effect.blendMode,
    rotation,
    scale,
    flipX,
    flipY,
    filter,
  });
}

async function makeRandomSquareCrop(file) {
  const image = await loadImage(file);
  const minEdge = Math.min(image.naturalWidth, image.naturalHeight);
  const cropRatio = randomNumber(MIN_CROP_RATIO, MAX_CROP_RATIO);
  const squareSize = Math.max(24, Math.floor(minEdge * cropRatio));

  // Pick a square region inside the original image so every upload feels slightly different.
  const startX = randomNumber(0, image.naturalWidth - squareSize);
  const startY = randomNumber(0, image.naturalHeight - squareSize);

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;

  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    startX,
    startY,
    squareSize,
    squareSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    image.src = objectUrl;
  });
}

function randomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function renderWeeklyProgress() {
  const progress = readProgress();
  const days = getRecentDays();
  const todayKey = formatDateKey(new Date());
  const todayValue = progress[todayKey] || 0;

  todayCount.textContent = `${todayValue}/${DAILY_TARGET}`;

  if (todayValue >= DAILY_TARGET) {
    trackerCopy.textContent = `오늘 ${todayValue}장이 쌓였어요. 라인이 가득 찬 하루로 남아있습니다.`;
  } else {
    trackerCopy.textContent = `오늘 ${DAILY_TARGET}칸 중 ${todayValue}칸이 채워졌어요. 원하는 만큼 더 쌓아보세요.`;
  }

  weekStrip.innerHTML = "";

  for (const day of days) {
    const count = progress[day.key] || 0;
    const progressRatio = Math.min(count / DAILY_TARGET, 1);
    const card = document.createElement("article");
    card.className = "day-card";

    if (day.key === todayKey) {
      card.classList.add("is-today");
    }

    if (count >= DAILY_TARGET) {
      card.classList.add("is-complete");
    }

    card.innerHTML = `
      <span class="day-label">${day.label}</span>
      <div class="day-meter" aria-hidden="true">
        <div class="day-fill" style="height: ${Math.max(progressRatio * 100, count ? 14 : 8)}%;"></div>
        <span class="day-check">✓</span>
      </div>
      <span class="day-count">${count}/${DAILY_TARGET}</span>
    `;

    weekStrip.append(card);
  }
}

function incrementTodayCount() {
  const progress = readProgress();
  const key = formatDateKey(new Date());
  progress[key] = (progress[key] || 0) + 1;
  writeProgress(progress);
  renderWeeklyProgress();
}

function readProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return pruneOldEntries(parsed);
  } catch (error) {
    console.error("진행도 불러오기 실패", error);
    return {};
  }
}

function writeProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneOldEntries(progress)));
}

function pruneOldEntries(progress) {
  const days = new Set(getRecentDays(14).map((day) => day.key));
  return Object.fromEntries(Object.entries(progress).filter(([key]) => days.has(key)));
}

function getRecentDays(total = 7) {
  const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
  return Array.from({ length: total }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (total - 1 - index));

    return {
      key: formatDateKey(date),
      label: formatter.format(date).replace("요일", ""),
    };
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function downloadComposition() {
  if (!layers.length) {
    return;
  }

  downloadButton.disabled = true;
  downloadButton.textContent = "이미지 만드는 중...";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1600;

    const context = canvas.getContext("2d");
    context.fillStyle = "#f3efe6";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (const layer of layers) {
      const image = await loadImageFromUrl(layer.src);
      context.save();
      context.globalAlpha = layer.opacity;
      context.globalCompositeOperation = toCanvasBlendMode(layer.blendMode);
      context.filter = layer.filter;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.scale(layer.scale * layer.flipX, layer.scale * layer.flipY);
      context.drawImage(image, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      context.restore();
    }

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = canvas.toDataURL("image/png");
    link.download = `daily-img-mix-${timestamp}.png`;
    link.click();
  } catch (error) {
    console.error("다운로드 실패", error);
  } finally {
    downloadButton.disabled = false;
    downloadButton.textContent = "결과 다운로드";
  }
}

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

function toCanvasBlendMode(blendMode) {
  const supported = new Set([
    "source-over",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
  ]);

  return supported.has(blendMode) ? blendMode : "source-over";
}
