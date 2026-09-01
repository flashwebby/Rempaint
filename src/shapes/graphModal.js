/**
 * Desmos Graph Modal and Canvas Integration for Rempaint
 * Handles mounting/destroying Desmos.GraphingCalculator,
 * live display settings controls, high-res transparent screenshot rendering,
 * and double-click re-editing.
 */

const DEFAULT_DESMOS_KEY = 'd3ab473863574706b83f0c2016334587';

export function getDesmosApiKey() {
  return localStorage.getItem('rempaint_desmos_api_key') || DEFAULT_DESMOS_KEY;
}

export function setDesmosApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('rempaint_desmos_api_key', key.trim());
  } else {
    localStorage.removeItem('rempaint_desmos_api_key');
  }
}

export function loadDesmosScript(apiKey = null) {
  return new Promise((resolve, reject) => {
    if (window.Desmos) {
      resolve(window.Desmos);
      return;
    }
    const key = apiKey || getDesmosApiKey();
    const existingScript = document.getElementById('desmos-api-script');
    if (existingScript) {
      existingScript.remove();
    }
    const script = document.createElement('script');
    script.id = 'desmos-api-script';
    script.src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${key}`;
    script.async = true;
    script.onload = () => {
      if (window.Desmos) resolve(window.Desmos);
      else reject(new Error('Desmos API failed to initialize.'));
    };
    script.onerror = () => reject(new Error('Failed to load Desmos script.'));
    document.head.appendChild(script);
  });
}

/**
 * Process a data URL image to make white/near-white pixels transparent
 */
export function makeImageTransparent(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Make pure white or near-white background transparent
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // If pixel is very close to white (#fff), make it transparent
        if (r > 248 && g > 248 && b > 248) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

/**
 * Capture a crisp screenshot from a Desmos calculator instance
 */
export function captureDesmosScreenshot(calculator, width, height, transparent = true) {
  return new Promise((resolve) => {
    const mathBounds = calculator.graphpaperBounds?.mathCoordinates;
    const pixelCoords = calculator.graphpaperBounds?.pixelCoordinates;

    // Use requested or graphpaper pixel dimensions
    const captureW = Math.max(100, Math.round(width || pixelCoords?.width || 600));
    const captureH = Math.max(100, Math.round(height || pixelCoords?.height || 450));

    // Capture screenshot matching current visible graphpaper bounds
    calculator.asyncScreenshot(
      {
        width: captureW,
        height: captureH,
        targetPixelRatio: 2,
        showLabels: true,
      },
      async (dataUri) => {
        if (transparent) {
          const transparentUri = await makeImageTransparent(dataUri);
          resolve({ dataUri: transparentUri, mathBounds, width: captureW, height: captureH });
        } else {
          resolve({ dataUri, mathBounds, width: captureW, height: captureH });
        }
      }
    );
  });
}

export class DesmosModalManager {
  constructor(options) {
    this.modalEl = document.getElementById('modal-desmos-graph');
    this.containerEl = document.getElementById('desmos-calculator-container');
    this.calculator = null;
    this.existingNode = null;
    this.onCommit = options.onCommit || (() => {});
    this.isOpening = false;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.btnInsert = document.getElementById('btn-desmos-insert');
    this.btnCancel = document.getElementById('btn-desmos-cancel');
    this.btnClose = document.getElementById('btn-desmos-close');
    this.modalTitle = document.getElementById('modal-desmos-title');

    // Display Settings Inputs
    this.toggleGraphOnly = document.getElementById('graph-setting-graph-only');
    this.toggleGrid = document.getElementById('graph-setting-grid');
    this.toggleAxisNumbers = document.getElementById('graph-setting-axis-numbers');
    this.toggleMinorGrid = document.getElementById('graph-setting-minor-grid');
    this.toggleArrows = document.getElementById('graph-setting-arrows');
    this.toggleDegreeMode = document.getElementById('graph-setting-degrees');
    this.toggleTransparentBg = document.getElementById('graph-setting-transparent');

    // X Axis
    this.toggleXAxis = document.getElementById('graph-setting-xaxis-visible');
    this.inputXLabel = document.getElementById('graph-setting-xaxis-label');
    this.inputXMin = document.getElementById('graph-setting-xaxis-min');
    this.inputXMax = document.getElementById('graph-setting-xaxis-max');
    this.inputXStep = document.getElementById('graph-setting-xaxis-step');

    // Y Axis
    this.toggleYAxis = document.getElementById('graph-setting-yaxis-visible');
    this.inputYLabel = document.getElementById('graph-setting-yaxis-label');
    this.inputYMin = document.getElementById('graph-setting-yaxis-min');
    this.inputYMax = document.getElementById('graph-setting-yaxis-max');
    this.inputYStep = document.getElementById('graph-setting-yaxis-step');
  }

  bindEvents() {
    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.btnCancel) this.btnCancel.addEventListener('click', () => this.close());

    if (this.btnInsert) {
      this.btnInsert.addEventListener('click', async () => {
        await this.handleCommit();
      });
    }

    // Bind settings change listeners to update Desmos live
    const settingInputs = [
      this.toggleGrid, this.toggleAxisNumbers, this.toggleMinorGrid,
      this.toggleArrows, this.toggleDegreeMode, this.toggleXAxis,
      this.inputXLabel, this.toggleYAxis, this.inputYLabel,
      this.inputXStep, this.inputYStep,
    ];

    settingInputs.forEach((input) => {
      if (input) {
        input.addEventListener('change', () => this.applySettingsToCalculator());
        input.addEventListener('input', () => this.applySettingsToCalculator());
      }
    });

    if (this.toggleGraphOnly) {
      this.toggleGraphOnly.addEventListener('change', () => {
        const isGraphOnly = this.toggleGraphOnly.checked;
        if (isGraphOnly) {
          if (this.toggleGrid) this.toggleGrid.checked = false;
          if (this.toggleAxisNumbers) this.toggleAxisNumbers.checked = false;
          if (this.toggleArrows) this.toggleArrows.checked = false;
          if (this.toggleXAxis) this.toggleXAxis.checked = false;
          if (this.toggleYAxis) this.toggleYAxis.checked = false;
        } else {
          if (this.toggleGrid) this.toggleGrid.checked = true;
          if (this.toggleAxisNumbers) this.toggleAxisNumbers.checked = true;
          if (this.toggleArrows) this.toggleArrows.checked = true;
          if (this.toggleXAxis) this.toggleXAxis.checked = true;
          if (this.toggleYAxis) this.toggleYAxis.checked = true;
        }
        this.applySettingsToCalculator();
      });
    }

    // Bounds input change
    const boundsInputs = [this.inputXMin, this.inputXMax, this.inputYMin, this.inputYMax];
    boundsInputs.forEach((input) => {
      if (input) {
        input.addEventListener('change', () => this.applyBoundsToCalculator());
      }
    });
  }

  async open(options = {}) {
    if (this.isOpening) return;
    this.isOpening = true;

    this.existingNode = options.existingNode || null;
    this.modalTitle.textContent = this.existingNode ? 'Edit Graph (Desmos)' : 'Insert Graph (Desmos)';
    this.btnInsert.textContent = this.existingNode ? 'Update Graph' : 'Insert Graph';

    this.modalEl.classList.remove('hidden');

    try {
      await loadDesmosScript();
      if (this.calculator) {
        this.calculator.destroy();
        this.calculator = null;
      }

      this.calculator = window.Desmos.GraphingCalculator(this.containerEl, {
        keypad: true,
        graphpaper: true,
        expressions: true,
        settingsMenu: false,
        zoomButtons: true,
        pointsOfInterest: true,
        trace: true,
        border: false,
      });

      if (this.existingNode) {
        const savedState = this.existingNode.getAttr('desmosState');
        if (savedState) {
          this.calculator.setState(savedState);
        }
        const savedSettings = this.existingNode.getAttr('displaySettings') || {};
        const savedTransparent = this.existingNode.getAttr('transparentBg');
        this.restoreSettingsForm(savedSettings, savedTransparent !== false);
      } else {
        // Set sample standard equation for quick start
        this.calculator.setExpression({ id: 'expr1', latex: 'y = \\sin(x)', color: '#0078d4' });
        this.resetSettingsForm();
      }

      this.syncBoundsFromCalculator();
      this.calculator.observe('graphpaperBounds', () => {
        this.syncBoundsFromCalculator();
      });

    } catch (err) {
      console.error('Failed to initialize Desmos modal:', err);
      alert('Could not initialize Desmos Graphing Calculator. Please check your internet connection or Desmos API key in Settings.');
      this.close();
    } finally {
      this.isOpening = false;
    }
  }

  applySettingsToCalculator() {
    if (!this.calculator) return;

    const showGrid = this.toggleGrid ? this.toggleGrid.checked : true;
    const showAxisNumbers = this.toggleAxisNumbers ? this.toggleAxisNumbers.checked : true;
    const showArrows = this.toggleArrows ? this.toggleArrows.checked : true;
    const degreeMode = this.toggleDegreeMode ? this.toggleDegreeMode.checked : false;

    const showXAxis = this.toggleXAxis ? this.toggleXAxis.checked : true;
    const showYAxis = this.toggleYAxis ? this.toggleYAxis.checked : true;
    const xLabel = this.inputXLabel ? this.inputXLabel.value : '';
    const yLabel = this.inputYLabel ? this.inputYLabel.value : '';
    const xStep = parseFloat(this.inputXStep?.value) || 0;
    const yStep = parseFloat(this.inputYStep?.value) || 0;

    const arrowMode = showArrows
      ? window.Desmos.AxisArrowModes.BOTH
      : window.Desmos.AxisArrowModes.NONE;

    this.calculator.updateSettings({
      showGrid,
      showXAxis,
      showYAxis,
      xAxisNumbers: showAxisNumbers,
      yAxisNumbers: showAxisNumbers,
      xAxisArrowMode: arrowMode,
      yAxisArrowMode: arrowMode,
      degreeMode,
      xAxisLabel: xLabel,
      yAxisLabel: yLabel,
      xAxisStep: xStep,
      yAxisStep: yStep,
    });
  }

  applyBoundsToCalculator() {
    if (!this.calculator) return;
    const left = parseFloat(this.inputXMin?.value);
    const right = parseFloat(this.inputXMax?.value);
    const bottom = parseFloat(this.inputYMin?.value);
    const top = parseFloat(this.inputYMax?.value);

    if (!isNaN(left) && !isNaN(right) && !isNaN(bottom) && !isNaN(top) && left < right && bottom < top) {
      this.calculator.setMathBounds({ left, right, bottom, top });
    }
  }

  syncBoundsFromCalculator() {
    if (!this.calculator) return;
    const bounds = this.calculator.graphpaperBounds?.mathCoordinates;
    if (bounds) {
      if (this.inputXMin) this.inputXMin.value = bounds.left.toFixed(2);
      if (this.inputXMax) this.inputXMax.value = bounds.right.toFixed(2);
      if (this.inputYMin) this.inputYMin.value = bounds.bottom.toFixed(2);
      if (this.inputYMax) this.inputYMax.value = bounds.top.toFixed(2);
    }
  }

  resetSettingsForm() {
    if (this.toggleGraphOnly) this.toggleGraphOnly.checked = false;
    if (this.toggleGrid) this.toggleGrid.checked = true;
    if (this.toggleAxisNumbers) this.toggleAxisNumbers.checked = true;
    if (this.toggleMinorGrid) this.toggleMinorGrid.checked = true;
    if (this.toggleArrows) this.toggleArrows.checked = true;
    if (this.toggleDegreeMode) this.toggleDegreeMode.checked = false;
    if (this.toggleTransparentBg) this.toggleTransparentBg.checked = true;

    if (this.toggleXAxis) this.toggleXAxis.checked = true;
    if (this.inputXLabel) this.inputXLabel.value = 'x';
    if (this.inputXStep) this.inputXStep.value = '';

    if (this.toggleYAxis) this.toggleYAxis.checked = true;
    if (this.inputYLabel) this.inputYLabel.value = 'y';
    if (this.inputYStep) this.inputYStep.value = '';

    this.applySettingsToCalculator();
  }

  restoreSettingsForm(settings, transparent) {
    if (this.toggleGraphOnly) this.toggleGraphOnly.checked = settings.graphOnly || false;
    if (this.toggleGrid) this.toggleGrid.checked = settings.showGrid !== false;
    if (this.toggleAxisNumbers) this.toggleAxisNumbers.checked = settings.showAxisNumbers !== false;
    if (this.toggleMinorGrid) this.toggleMinorGrid.checked = settings.showMinorGrid !== false;
    if (this.toggleArrows) this.toggleArrows.checked = settings.showArrows !== false;
    if (this.toggleDegreeMode) this.toggleDegreeMode.checked = settings.degreeMode === true;
    if (this.toggleTransparentBg) this.toggleTransparentBg.checked = transparent !== false;

    if (this.toggleXAxis) this.toggleXAxis.checked = settings.showXAxis !== false;
    if (this.inputXLabel) this.inputXLabel.value = settings.xAxisLabel || 'x';
    if (this.inputXStep) this.inputXStep.value = settings.xAxisStep || '';

    if (this.toggleYAxis) this.toggleYAxis.checked = settings.showYAxis !== false;
    if (this.inputYLabel) this.inputYLabel.value = settings.yAxisLabel || 'y';
    if (this.inputYStep) this.inputYStep.value = settings.yAxisStep || '';

    this.applySettingsToCalculator();
  }

  getDisplaySettings() {
    return {
      graphOnly: this.toggleGraphOnly ? this.toggleGraphOnly.checked : false,
      showGrid: this.toggleGrid ? this.toggleGrid.checked : true,
      showAxisNumbers: this.toggleAxisNumbers ? this.toggleAxisNumbers.checked : true,
      showMinorGrid: this.toggleMinorGrid ? this.toggleMinorGrid.checked : true,
      showArrows: this.toggleArrows ? this.toggleArrows.checked : true,
      degreeMode: this.toggleDegreeMode ? this.toggleDegreeMode.checked : false,
      showXAxis: this.toggleXAxis ? this.toggleXAxis.checked : true,
      xAxisLabel: this.inputXLabel ? this.inputXLabel.value : 'x',
      xAxisStep: this.inputXStep ? this.inputXStep.value : '',
      showYAxis: this.toggleYAxis ? this.toggleYAxis.checked : true,
      yAxisLabel: this.inputYLabel ? this.inputYLabel.value : 'y',
      yAxisStep: this.inputYStep ? this.inputYStep.value : '',
    };
  }

  async handleCommit() {
    if (!this.calculator) return;

    this.btnInsert.disabled = true;
    this.btnInsert.textContent = 'Rendering...';

    try {
      const transparent = this.toggleTransparentBg ? this.toggleTransparentBg.checked : true;
      const pixelCoords = this.calculator.graphpaperBounds?.pixelCoordinates;
      const gpW = pixelCoords?.width || 600;
      const gpH = pixelCoords?.height || 450;
      const aspect = gpW / gpH;

      let targetW, targetH;
      if (this.existingNode) {
        targetW = this.existingNode.width();
        targetH = this.existingNode.height();
      } else {
        // Calculate canvas dimensions that preserve the exact aspect ratio of the graphpaper
        targetW = 600;
        targetH = Math.round(600 / aspect);
        if (targetH > 520) {
          targetH = 520;
          targetW = Math.round(520 * aspect);
        }
      }

      const { dataUri, mathBounds } = await captureDesmosScreenshot(this.calculator, targetW, targetH, transparent);
      const desmosState = this.calculator.getState();
      const displaySettings = this.getDisplaySettings();

      await this.onCommit({
        dataUri,
        desmosState,
        displaySettings,
        transparentBg: transparent,
        mathBounds,
        existingNode: this.existingNode,
        width: targetW,
        height: targetH,
      });

      this.close();
    } catch (err) {
      console.error('Failed to capture and commit Desmos graph:', err);
    } finally {
      this.btnInsert.disabled = false;
    }
  }

  close() {
    this.modalEl.classList.add('hidden');
    if (this.calculator) {
      this.calculator.destroy();
      this.calculator = null;
    }
    this.existingNode = null;
  }
}
