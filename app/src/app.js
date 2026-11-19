// Sunset Cover Studio — editor: state, controls, export, scene wiring.
// Photos are read on this machine only and never uploaded anywhere.

import { POSTER_SIZES, COLOR_GRADES, layoutFor, defaultCrop, shuffledCrop, paintPoster } from "./render.js";
import { runScene } from "./scenes.js";

const $ = (id) => document.getElementById(id);

const state = {
  size: "1080x1080",
  grade: "sunset",
  title: "Sunset Heist",
  tagline: "A night in the city",
  titleScale: 1,
  photos: [], // { name, img }
  panels: [], // { photoIndex, crop }
  selected: 0,
  shuffleRound: 0,
};

function rebuildPanels(keepPhotos) {
  const count = layoutFor(state.size).slots.length;
  const old = keepPhotos ? state.panels : [];
  state.panels = Array.from({ length: count }, (_, i) => ({
    photoIndex: old[i] ? old[i].photoIndex : -1,
    crop: old[i] ? old[i].crop : defaultCrop(i),
  }));
  if (state.selected >= count) state.selected = 0;
}

function panelPhoto(i) {
  const panel = state.panels[i];
  if (!panel || panel.photoIndex < 0) return null;
  return state.photos[panel.photoIndex]?.img || null;
}

function repaint() {
  const view = {
    ...state,
    panels: state.panels.map((p) => ({ photo: panelPhoto(state.panels.indexOf(p)), crop: p.crop })),
  };
  paintPoster($("coverCanvas"), view, !document.body.classList.contains("shot-cover"));
  syncPanelControls();
}

function refreshPhotoOptions() {
  const sel = $("panelPhoto");
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "-1";
  none.textContent = "No photo";
  sel.appendChild(none);
  state.photos.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i + 1} · ${p.name}`;
    sel.appendChild(opt);
  });
  $("photoCount").textContent = `${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} loaded.`;
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  $("panelLabel").textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
  $("panelPhoto").value = String(panel.photoIndex);
  $("zoomRange").value = String(panel.crop.zoom);
  $("zoomValue").textContent = `${panel.crop.zoom.toFixed(2)}×`;
  $("panXRange").value = String(panel.crop.panX);
  $("panXValue").textContent = String(panel.crop.panX);
  $("panYRange").value = String(panel.crop.panY);
  $("panYValue").textContent = String(panel.crop.panY);
}

function note(msg) {
  $("statusLine").textContent = msg;
}

async function loadImageFrom(src, name) {
  const img = new Image();
  img.decoding = "async";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error(`could not load ${name}`));
    img.src = src;
  });
  return img;
}

export async function loadSample(name) {
  const img = await loadImageFrom(`samples/${name}.jpg`, `${name}.jpg`);
  state.photos.push({ name: `${name}.jpg`, img });
  refreshPhotoOptions();
  return img;
}

function fillAllPanels() {
  if (state.photos.length === 0) {
    note("Add a photo first — or try a sample photo below.");
    return;
  }
  state.panels.forEach((panel, i) => {
    panel.photoIndex = i % state.photos.length;
    panel.crop = defaultCrop(i);
  });
  repaint();
  note(`Filled ${state.panels.length} panels from ${state.photos.length} photo(s).`);
}

function shuffleCrops() {
  state.shuffleRound += 1;
  state.panels.forEach((panel, i) => {
    panel.crop = shuffledCrop(i, state.shuffleRound);
  });
  repaint();
  note(`Shuffled crops (round ${state.shuffleRound}).`);
}

function exportPng() {
  const layout = layoutFor(state.size);
  const off = document.createElement("canvas");
  const view = {
    ...state,
    panels: state.panels.map((p) => ({ photo: panelPhoto(state.panels.indexOf(p)), crop: p.crop })),
  };
  paintPoster(off, view, false);
  off.toBlob((blob) => {
    if (!blob) {
      note("Export failed — the browser could not make the PNG.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-${layout.spec.w}x${layout.spec.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    note(`Saved cover-${layout.spec.w}x${layout.spec.h}.png (${Math.round(blob.size / 1024)} KB).`);
  }, "image/png");
}

function wireControls() {
  $("photoInput").addEventListener("change", async (ev) => {
    for (const file of ev.target.files) {
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const img = await loadImageFrom(dataUrl, file.name);
        state.photos.push({ name: file.name, img });
      } catch {
        note(`Could not read ${file.name}.`);
      }
    }
    refreshPhotoOptions();
    repaint();
  });
  $("samplePier").addEventListener("click", async () => { await loadSample("pier"); repaint(); });
  $("sampleBlvd").addEventListener("click", async () => { await loadSample("boulevard"); repaint(); });
  $("fillBtn").addEventListener("click", fillAllPanels);
  $("shuffleBtn").addEventListener("click", shuffleCrops);

  $("panelPhoto").addEventListener("change", (ev) => {
    state.panels[state.selected].photoIndex = Number(ev.target.value);
    repaint();
  });
  $("zoomRange").addEventListener("input", (ev) => {
    state.panels[state.selected].crop.zoom = Number(ev.target.value);
    repaint();
  });
  $("panXRange").addEventListener("input", (ev) => {
    state.panels[state.selected].crop.panX = Number(ev.target.value);
    repaint();
  });
  $("panYRange").addEventListener("input", (ev) => {
    state.panels[state.selected].crop.panY = Number(ev.target.value);
    repaint();
  });

  $("titleInput").addEventListener("input", (ev) => {
    state.title = ev.target.value;
    repaint();
  });
  $("taglineInput").addEventListener("input", (ev) => {
    state.tagline = ev.target.value;
    repaint();
  });
  $("titleScale").addEventListener("input", (ev) => {
    state.titleScale = Number(ev.target.value);
    $("titleScaleValue").textContent = `${state.titleScale.toFixed(2)}×`;
    repaint();
  });

  document.querySelectorAll("[data-grade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.grade = btn.dataset.grade;
      document.querySelectorAll("[data-grade]").forEach((b) => b.classList.toggle("active", b === btn));
      repaint();
    });
  });
  document.querySelectorAll("[data-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.size = btn.dataset.size;
      rebuildPanels(true);
      document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b === btn));
      repaint();
    });
  });

  $("exportBtn").addEventListener("click", exportPng);

  $("coverCanvas").addEventListener("click", (ev) => {
    const canvas = $("coverCanvas");
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
    const hit = layoutFor(state.size).slots.findIndex(
      (s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h,
    );
    if (hit >= 0) {
      state.selected = hit;
      repaint();
    }
  });
}

function init() {
  rebuildPanels(false);
  wireControls();
  refreshPhotoOptions();
  // Fixed screenshot scenes (?shot=cover / ?shot=editor) run through
  // scenes.js; a plain visit just paints the empty editor.
  const params = new URLSearchParams(location.search);
  if (params.get("shot")) {
    runScene(params, { state, loadSample, fillAllPanels, repaint, rebuildPanels, note });
  } else {
    repaint();
  }
}

init();
