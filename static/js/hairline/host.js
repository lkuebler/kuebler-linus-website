/*
 * Mounts one Hairline figure (built with the hairline-create skill) into
 * #figure, the way the skill's bench does, without the bench's controls.
 * The figure walks its own tour until a pointer arrives, as the package's
 * `play` option does, and rests under reduced motion.
 */
(() => {
  window.hairline = (figure) => {
    const stage = document.getElementById("figure");
    const out = document.getElementById("figure-read");
    if (!stage) return;

    const [, mid] = figure.range;
    HL.inject(document);
    stage.setAttribute("data-hairline", figure.name);
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", figure.means);
    const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage);

    let text = null;
    const read = {
      get textContent() { return text; },
      set textContent(value) { text = value == null ? "" : String(value); if (out) out.textContent = text; },
    };

    figure.mount({ stage, svg, read }, mid);
    if (text === null) read.textContent = "rest";

    if (!HL.reducedMotion() && figure.tour) HL.tour(stage, figure.tour);
  };
})();
