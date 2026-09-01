/**
 * Math Text (LaTeX) Shape Generator & Crisp Renderer for Rempaint
 * Uses KaTeX and html2canvas for 100% reliable DOM-to-canvas rendering of math formulas
 * at 2x pixel density, supports crisp parametric re-rendering on transformend, and live floating editor.
 */

export function preprocessLatex(latexSource) {
  if (!latexSource) return '';
  return latexSource
    .replace(/(?:\\|\/)del\b/g, '\\Delta')
    .replace(/\/([a-zA-Z]+)/g, (match, cmd) => '\\' + cmd);
}

export async function renderLatexToDataUrl(latexSource, options = {}) {
  const katex = window.katex;
  const fontSize = Math.max(12, parseFloat(options.fontSize || 28));
  const color = options.color || '#000000';
  const pixelRatio = options.pixelRatio || 2;
  const cleanLatex = preprocessLatex(latexSource);

  let katexHtml = '';
  if (katex) {
    try {
      katexHtml = katex.renderToString(cleanLatex, {
        displayMode: true,
        throwOnError: false,
        output: 'html',
        macros: {
          "\\del": "\\Delta",
          "\\Del": "\\Delta",
        },
      });
    } catch (err) {
      katexHtml = `<span style="color:#ef4444;font-family:monospace;">${err.message}</span>`;
    }
  } else {
    katexHtml = `<span style="font-family:'Times New Roman',serif;">${cleanLatex}</span>`;
  }

  // Create real DOM container attached to body so all fonts, styles, and fraction bars compute
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.zIndex = '-9999';
  container.style.color = color;
  container.style.fontSize = `${fontSize}px`;
  container.style.background = 'transparent';
  container.style.display = 'inline-block';
  container.style.padding = '8px 14px';
  container.style.lineHeight = '1.2';
  container.innerHTML = katexHtml;
  document.body.appendChild(container);

  // Measure bounding box in DOM
  const rect = container.getBoundingClientRect();
  const width = Math.max(30, Math.ceil(rect.width));
  const height = Math.max(26, Math.ceil(rect.height));

  let dataUrl = '';
  if (window.html2canvas) {
    try {
      const renderedCanvas = await window.html2canvas(container, {
        backgroundColor: null,
        scale: pixelRatio,
        logging: false,
        useCORS: true,
      });
      dataUrl = renderedCanvas.toDataURL('image/png');
    } catch (e) {
      console.warn('html2canvas render failed, falling back:', e);
    }
  }

  document.body.removeChild(container);

  // Fallback if html2canvas not available
  if (!dataUrl) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width * pixelRatio;
    offCanvas.height = height * pixelRatio;
    const ctx = offCanvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px 'KaTeX_Main', 'Cambria Math', 'Times New Roman', serif`;
    ctx.fillText(latexSource, 8, fontSize + 4);
    dataUrl = offCanvas.toDataURL('image/png');
  }

  return {
    dataUrl,
    width,
    height,
    baseFontSize: fontSize,
    latexSource,
    textColor: color,
  };
}

/**
 * Creates a new Konva.Image node representing the LaTeX Math Text object
 */
export async function createMathTextImageNode(config, KonvaInstance) {
  const Konva = KonvaInstance || window.Konva;
  const renderResult = await renderLatexToDataUrl(config.latexSource, {
    fontSize: config.baseFontSize || 28,
    color: config.textColor || '#000000',
    pixelRatio: 2,
  });

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const node = new Konva.Image({
        x: config.x || 0,
        y: config.y || 0,
        width: renderResult.width,
        height: renderResult.height,
        image: img,
        name: 'shape',
        draggable: true,
      });

      node.setAttr('shapeType', 'math-text');
      node.setAttr('latexSource', config.latexSource);
      node.setAttr('baseFontSize', renderResult.baseFontSize);
      node.setAttr('textColor', renderResult.textColor);

      resolve(node);
    };
    img.src = renderResult.dataUrl;
  });
}

/**
 * Re-renders a Math Text node to razor-sharp 2x resolution at its newly scaled target size
 */
export async function refreshMathTextCrisp(node) {
  if (node.getAttr('shapeType') !== 'math-text') return;

  const latexSource = node.getAttr('latexSource');
  const baseFontSize = node.getAttr('baseFontSize') || 28;
  const textColor = node.getAttr('textColor') || '#000000';

  const scaleX = Math.abs(node.scaleX() || 1);
  const scaleY = Math.abs(node.scaleY() || 1);
  const effectiveScale = Math.max(scaleX, scaleY);

  const targetFontSize = Math.max(12, Math.round(baseFontSize * effectiveScale));

  const renderResult = await renderLatexToDataUrl(latexSource, {
    fontSize: targetFontSize,
    color: textColor,
    pixelRatio: 2,
  });

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      node.image(img);
      node.width(renderResult.width);
      node.height(renderResult.height);
      node.scaleX(node.scaleX() < 0 ? -1 : 1);
      node.scaleY(node.scaleY() < 0 ? -1 : 1);
      node.setAttr('baseFontSize', targetFontSize);
      resolve(node);
    };
    img.src = renderResult.dataUrl;
  });
}

/**
 * Floating LaTeX Math Editor UI
 */
export function openMathTextEditor(options = {}) {
  const existingPopover = document.getElementById('math-editor-popover');
  if (existingPopover) existingPopover.remove();

  const {
    x = 100,
    y = 100,
    clientX = 150,
    clientY = 150,
    initialLatex = '',
    initialFontSize = 28,
    initialColor = '#000000',
    existingNode = null,
    onCommit,
  } = options;

  const popover = document.createElement('div');
  popover.className = 'math-editor-popover';
  popover.id = 'math-editor-popover';

  const posX = Math.max(10, Math.min(window.innerWidth - 380, clientX));
  const posY = Math.max(10, Math.min(window.innerHeight - 340, clientY));
  popover.style.left = `${posX}px`;
  popover.style.top = `${posY}px`;

  popover.innerHTML = `
    <div class="math-editor-header">
      <div class="math-editor-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;"><path d="M4 4h16v3L11 12l9 5v3H4"></path></svg>
        ${existingNode ? 'Edit Math Text (LaTeX)' : 'Insert Math Text (LaTeX)'}
      </div>
      <button type="button" class="math-editor-close-btn" title="Close">✕</button>
    </div>
    <div class="math-editor-body">
      <textarea class="math-editor-input" placeholder="Type LaTeX formula (e.g. \\frac{a}{b}, \\delta, \\gamma, t_0, \\sqrt{x^2+y^2})...">${initialLatex}</textarea>
      
      <div class="math-editor-preview-container">
        <div class="math-editor-preview-label">Live Preview</div>
        <div class="math-editor-preview"></div>
      </div>

      <div class="math-editor-toolbar">
        <label class="math-editor-label">
          <span>Size</span>
          <input type="number" class="math-editor-size-input" min="10" max="150" value="${initialFontSize}" />
        </label>
        <label class="math-editor-label">
          <span>Color</span>
          <input type="color" class="math-editor-color-input" value="${initialColor}" />
        </label>
        <div class="math-quick-symbols">
          <button type="button" class="symbol-chip" data-insert="\\frac{a}{b}">\\frac</button>
          <button type="button" class="symbol-chip" data-insert="\\sqrt{x}">\\sqrt</button>
          <button type="button" class="symbol-chip" data-insert="\\del">\\del (Δ)</button>
          <button type="button" class="symbol-chip" data-insert="\\Delta">\\Delta (Δ)</button>
          <button type="button" class="symbol-chip" data-insert="\\delta">\\delta (δ)</button>
          <button type="button" class="symbol-chip" data-insert="\\gamma">\\gamma</button>
          <button type="button" class="symbol-chip" data-insert="\\theta">\\theta</button>
          <button type="button" class="symbol-chip" data-insert="\\pi">\\pi</button>
          <button type="button" class="symbol-chip" data-insert="\\Sigma">\\Sigma</button>
          <button type="button" class="symbol-chip" data-insert="t_0">t_0</button>
          <button type="button" class="symbol-chip" data-insert="x^2">x^2</button>
        </div>
      </div>
    </div>
    <div class="math-editor-footer">
      <button type="button" class="btn-secondary btn-sm math-editor-cancel-btn">Cancel</button>
      <button type="button" class="btn-primary btn-sm math-editor-submit-btn">
        ${existingNode ? 'Update Math' : 'Insert Math'}
      </button>
    </div>
  `;

  document.body.appendChild(popover);

  const textarea = popover.querySelector('.math-editor-input');
  const preview = popover.querySelector('.math-editor-preview');
  const sizeInput = popover.querySelector('.math-editor-size-input');
  const colorInput = popover.querySelector('.math-editor-color-input');
  const submitBtn = popover.querySelector('.math-editor-submit-btn');
  const cancelBtn = popover.querySelector('.math-editor-cancel-btn');
  const closeBtn = popover.querySelector('.math-editor-close-btn');

  let debounceTimer = null;
  function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const src = textarea.value.trim();
      const color = colorInput.value;
      const size = parseInt(sizeInput.value, 10) || 28;

      if (!src) {
        preview.innerHTML = '<span style="color:#64748b;font-style:italic;">Formula preview will appear here...</span>';
        return;
      }

      try {
        if (window.katex) {
          const cleanLatex = preprocessLatex(src);
          const rendered = window.katex.renderToString(cleanLatex, {
            displayMode: true,
            throwOnError: true,
            macros: {
              "\\del": "\\Delta",
              "\\Del": "\\Delta",
            },
          });
          preview.style.color = color;
          preview.style.fontSize = `${Math.min(size, 32)}px`;
          preview.innerHTML = rendered;
        } else {
          preview.textContent = src;
        }
      } catch (err) {
        preview.innerHTML = `<div class="math-error">${err.message}</div>`;
      }
    }, 150);
  }

  textarea.addEventListener('input', updatePreview);
  sizeInput.addEventListener('input', updatePreview);
  colorInput.addEventListener('input', updatePreview);

  popover.querySelectorAll('.symbol-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const insertText = chip.dataset.insert;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = textarea.value;
      textarea.value = current.substring(0, start) + insertText + current.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      updatePreview();
    });
  });

  updatePreview();
  setTimeout(() => {
    textarea.focus();
    if (initialLatex) textarea.select();
  }, 40);

  function close() {
    popover.remove();
  }

  function commit() {
    const src = textarea.value.trim();
    if (src) {
      const fontSize = parseInt(sizeInput.value, 10) || 28;
      const color = colorInput.value;
      if (onCommit) {
        onCommit({
          latexSource: src,
          baseFontSize: fontSize,
          textColor: color,
          x,
          y,
          existingNode,
        });
      }
    }
    close();
  }

  submitBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
}
