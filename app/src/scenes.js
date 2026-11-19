// Fixed scenes for screenshots: ?shot=cover shows the cover alone,
// ?shot=editor shows the editor with a sample photo loaded.
// Query params: photo (pier|boulevard), caption, tagline, grade, size.
// Sets window.__shotReady after two animation frames once painted.

export async function runScene(params, hooks) {
  const { state, loadSample, fillAllPanels, repaint, rebuildPanels } = hooks;
  const shot = params.get("shot");
  const photo = params.get("photo") || "pier";
  const grade = params.get("grade");
  const size = params.get("size");
  const caption = params.get("caption");
  const tagline = params.get("tagline");

  if (grade) state.grade = grade;
  if (size) state.size = size;
  if (caption) {
    state.title = caption;
    const titleInput = document.getElementById("titleInput");
    if (titleInput) titleInput.value = caption;
  }
  if (tagline) {
    state.tagline = tagline;
    const tagInput = document.getElementById("taglineInput");
    if (tagInput) tagInput.value = tagline;
  }
  document.querySelectorAll("[data-grade]").forEach((b) => b.classList.toggle("active", b.dataset.grade === state.grade));
  document.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b.dataset.size === state.size));

  if (shot === "cover") document.body.classList.add("shot-cover");

  // Rebuild panels for the (possibly new) size before filling them.
  rebuildPanels(true);

  await loadSample(photo);
  fillAllPanels();
  repaint();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
