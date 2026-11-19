// Sunset Cover Studio — poster renderer (fresh implementation).
// A poster is a grid of photo panels around one painted title panel.
// render.js is a pure function of state: the same state always paints
// the same pixels, so the live preview and the PNG export share it.

export const POSTER_SIZES = {
  "1080x1080": { w: 1080, h: 1080, cols: 3, rows: 3, titleCol: 1, titleRow: 1, titleCols: 1, titleRows: 1 },
  "1080x1350": { w: 1080, h: 1350, cols: 3, rows: 4, titleCol: 1, titleRow: 1, titleCols: 2, titleRows: 2 },
  "1920x1080": { w: 1920, h: 1080, cols: 4, rows: 3, titleCol: 1, titleRow: 1, titleCols: 2, titleRows: 1 },
};

export const COLOR_GRADES = {
  sunset: {
    sky: ["#ff9a3d", "#ff5e7a", "#8a2fbe", "#2a1650"],
    sun: "#ffedb0",
    glow: "rgba(255, 178, 92, 0.55)",
    tintTop: "rgba(255, 154, 61, 0.14)",
    tintBottom: "rgba(138, 47, 190, 0.30)",
    shadow: "#ff5e7a",
    tag: "#ffe9a8",
  },
  neon: {
    sky: ["#22d3ee", "#e879f9", "#7c3aed", "#0d1030"],
    sun: "#c9f7ff",
    glow: "rgba(34, 211, 238, 0.55)",
    tintTop: "rgba(34, 211, 238, 0.14)",
    tintBottom: "rgba(124, 58, 237, 0.32)",
    shadow: "#e879f9",
    tag: "#a5f3fc",
  },
  golden: {
    sky: ["#fcd34d", "#f59e0b", "#ea580c", "#3f0d05"],
    sun: "#fff7cc",
    glow: "rgba(251, 191, 36, 0.55)",
    tintTop: "rgba(252, 211, 77, 0.14)",
    tintBottom: "rgba(234, 88, 12, 0.30)",
    shadow: "#ea580c",
    tag: "#fde68a",
  },
};

// Small deterministic hash in [0, 1) — drives skyline towers and windows.
export function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Default crop for a panel: a pure function of the panel index, so the
// first paint is already varied and repeatable. Zoom cycles 1 / 1.15 / 1.3.
export function defaultCrop(slotIndex) {
  return {
    zoom: 1 + (slotIndex % 3) * 0.15,
    panX: ((slotIndex * 37) % 81) - 40,
    panY: ((slotIndex * 53) % 61) - 30,
  };
}

// A re-rolled crop: same shape as defaultCrop, shifted by a shuffle round.
export function shuffledCrop(slotIndex, round) {
  const k = slotIndex + round * 7;
  return {
    zoom: 1 + (k % 3) * 0.15,
    panX: ((k * 37 + round * 13) % 81) - 40,
    panY: ((k * 53 + round * 29) % 61) - 30,
  };
}

// Geometry of one poster: cell sizes, the title rectangle, and the list of
// photo slots (reading order, skipping the cells the title occupies).
export function layoutFor(sizeKey) {
  const spec = POSTER_SIZES[sizeKey] || POSTER_SIZES["1080x1080"];
  const gutter = spec.w / 108;
  const cellW = (spec.w - gutter * (spec.cols + 1)) / spec.cols;
  const cellH = (spec.h - gutter * (spec.rows + 1)) / spec.rows;
  const title = {
    x: gutter + spec.titleCol * (cellW + gutter),
    y: gutter + spec.titleRow * (cellH + gutter),
    w: spec.titleCols * cellW + (spec.titleCols - 1) * gutter,
    h: spec.titleRows * cellH + (spec.titleRows - 1) * gutter,
  };
  const slots = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const insideTitle =
        c >= spec.titleCol && c < spec.titleCol + spec.titleCols &&
        r >= spec.titleRow && r < spec.titleRow + spec.titleRows;
      if (insideTitle) continue;
      slots.push({
        index: slots.length,
        x: gutter + c * (cellW + gutter),
        y: gutter + r * (cellH + gutter),
        w: cellW,
        h: cellH,
      });
    }
  }
  return { spec, gutter, cellW, cellH, title, slots };
}

function coverDraw(ctx, img, rect, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * crop.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = (dw - rect.w) / 2;
  const oy = (dh - rect.h) / 2;
  const dx = rect.x - ox + (crop.panX / 100) * ox;
  const dy = rect.y - oy + (crop.panY / 100) * oy;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function paintPhotoPanel(ctx, img, slot, crop, grade, gutter) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  if (img) {
    coverDraw(ctx, img, slot, crop);
  } else {
    ctx.fillStyle = "#241b3a";
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 ${Math.round(slot.w * 0.07)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ADD A PHOTO", slot.x + slot.w / 2, slot.y + slot.h / 2);
  }
  const tint = ctx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
  tint.addColorStop(0, grade.tintTop);
  tint.addColorStop(1, grade.tintBottom);
  ctx.fillStyle = tint;
  ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, gutter * 0.4);
  ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
}

function paintPalm(ctx, baseX, baseY, height, lean, color) {
  const topX = baseX + lean;
  const topY = baseY - height;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(4, height * 0.05);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + lean * 0.4, baseY - height * 0.55, topX, topY);
  ctx.stroke();
  // Drooping fronds fanning out from the crown, kept short so they frame
  // the title instead of crossing it.
  ctx.lineWidth = Math.max(3, height * 0.03);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.06 + (i / 8) * 0.88);
    const reach = height * (0.24 + 0.07 * hash01(i * 3 + Math.round(baseX)));
    const ex = topX + Math.cos(a) * reach * (i < 4 ? -1 : 1);
    const ey = topY + Math.abs(Math.sin(a)) * reach * 0.35 + height * 0.04;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (ex - topX) * 0.5, topY - height * 0.05, ex, ey);
    ctx.stroke();
  }
}

function paintCity(ctx, rect, color) {
  const bandH = rect.h * 0.20;
  const baseY = rect.y + rect.h;
  ctx.fillStyle = color;
  let x = rect.x;
  let i = 0;
  while (x < rect.x + rect.w) {
    const tw = rect.w * (0.06 + hash01(i * 5 + 1) * 0.07);
    const th = bandH * (0.45 + hash01(i * 9 + 2) * 0.55);
    ctx.fillRect(x, baseY - th, tw, th);
    // A few warm lit windows on each tower.
    ctx.fillStyle = "rgba(255, 214, 130, 0.9)";
    const win = Math.max(2, rect.w * 0.006);
    for (let wy = 0; wy < 3; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        if (hash01(i * 31 + wy * 7 + wx) > 0.55) {
          ctx.fillRect(x + tw * (0.2 + wx * 0.45), baseY - th + th * (0.2 + wy * 0.25), win, win);
        }
      }
    }
    ctx.fillStyle = color;
    x += tw + rect.w * 0.012;
    i++;
  }
}

function paintTitlePanel(ctx, rect, grade, title, tagline, titleScale) {
  const sky = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Low glowing sun: radius is 16% of the title block's short side, so a
  // wide short title never lets the sun swallow the words.
  const short = Math.min(rect.w, rect.h);
  const sunR = short * 0.16;
  const sunX = rect.x + rect.w / 2;
  const sunY = rect.y + rect.h * 0.26;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.6);
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Palms frame the block from its lower corners, skyline along the base.
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  paintPalm(ctx, rect.x + rect.w * 0.02, rect.y + rect.h, rect.h * 0.60, rect.w * 0.10, "rgba(20, 8, 40, 0.92)");
  paintPalm(ctx, rect.x + rect.w * 0.98, rect.y + rect.h, rect.h * 0.56, -rect.w * 0.10, "rgba(20, 8, 40, 0.92)");
  paintCity(ctx, rect, "#160b2e");
  ctx.restore();

  // Caption: huge bold uppercase, coloured offset shadow + dark outline,
  // shrunk until it fits the block. It sits below the sun, above the city.
  const words = (title || "SUNSET HEIST").toUpperCase();
  const maxW = rect.w * 0.88;
  let px = Math.min(rect.w * 0.17, rect.h * 0.30) * (titleScale || 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const setFont = (size) => { ctx.font = `900 ${Math.round(size)}px Arial, Helvetica, sans-serif`; };
  setFont(px);
  while (px > 10 && ctx.measureText(words).width > maxW) {
    px *= 0.92;
    setFont(px);
  }
  const titleY = rect.y + rect.h * 0.64;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(20, 8, 40, 0.95)";
  ctx.lineWidth = Math.max(2, px * 0.14);
  ctx.strokeText(words, rect.x + rect.w / 2, titleY);
  ctx.fillStyle = grade.shadow;
  ctx.fillText(words, rect.x + rect.w / 2 + px * 0.07, titleY + px * 0.07);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(words, rect.x + rect.w / 2, titleY);

  if (tagline) {
    const tagPx = Math.max(10, px * 0.34);
    ctx.font = `700 ${Math.round(tagPx)}px Arial, Helvetica, sans-serif`;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(20, 8, 40, 0.85)";
    ctx.lineWidth = Math.max(2, tagPx * 0.16);
    ctx.strokeText(tagline.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h * 0.82);
    ctx.fillStyle = grade.tag;
    ctx.fillText(tagline.toUpperCase(), rect.x + rect.w / 2, rect.y + rect.h * 0.82);
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, (rect.w / 108) * 0.4);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

// The one render entry point. `state` holds size, grade, title, tagline,
// titleScale and panels: [{ photo: HTMLImageElement|null, crop }].
// `showSelection` draws the dashed editor outline on the chosen panel.
export function paintPoster(canvas, state, showSelection) {
  const layout = layoutFor(state.size);
  const { spec } = layout;
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d");
  const grade = COLOR_GRADES[state.grade] || COLOR_GRADES.sunset;
  ctx.fillStyle = "#171226";
  ctx.fillRect(0, 0, spec.w, spec.h);
  layout.slots.forEach((slot) => {
    const panel = state.panels[slot.index] || { photo: null, crop: defaultCrop(slot.index) };
    paintPhotoPanel(ctx, panel.photo, slot, panel.crop, grade, layout.gutter);
  });
  paintTitlePanel(ctx, layout.title, grade, state.title, state.tagline, state.titleScale);
  if (showSelection && state.selected >= 0 && layout.slots[state.selected]) {
    const slot = layout.slots[state.selected];
    ctx.save();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = Math.max(4, layout.gutter * 0.5);
    ctx.setLineDash([16, 12]);
    ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
    ctx.restore();
  }
  return layout;
}
