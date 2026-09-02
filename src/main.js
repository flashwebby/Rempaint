import { createNumberLineGroup, renderNumberLine } from './shapes/numberLine.js';
import { createMathTextImageNode, refreshMathTextCrisp, openMathTextEditor } from './shapes/mathText.js';
import { RasterSelectionManager } from './tools/selection.js';
import { LayerManager } from './layers/layerManager.js';
import {
  DesmosModalManager,
  getDesmosApiKey,
  setDesmosApiKey,
  captureDesmosScreenshot,
} from './shapes/graphModal.js';
import {
  createFixedCircleGroup,
  renderFixedCircle,
  createParametricAngleGroup,
  renderParametricAngle,
  createParametricGearGroup,
} from './tools/parametricTools.js';
import { ProjectManager } from './project/saveLoad.js';
import { initAutoUpdater } from './updater.js';

// Initialize when DOM and Konva are ready
function initApp() {
  const Konva = window.Konva;
  if (!Konva) {
    console.error('Konva.js library is not loaded!');
    return;
  }

  // --- UI Elements ---
  const stageContainer = document.getElementById('stage-container');
  const brushCursor = document.getElementById('brush-cursor');
  const toolButtons = document.querySelectorAll('.tool-btn');
  const strokeColorInput = document.getElementById('stroke-color');
  const slotColor1 = document.getElementById('slot-color-1');
  const slotColor2 = document.getElementById('slot-color-2');
  const color1Preview = document.getElementById('color-1-preview');
  const color2Preview = document.getElementById('color-2-preview');
  const paletteDots = document.querySelectorAll('.palette-dot');
  const strokeWidthInput = document.getElementById('stroke-width');
  const strokeWidthNumeric = document.getElementById('stroke-width-input');
  const strokePreviewLine = document.getElementById('stroke-preview-line');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnDelete = document.getElementById('btn-delete');
  const btnClear = document.getElementById('btn-clear');
  const btnExport = document.getElementById('btn-export');
  const btnSave = document.getElementById('btn-save');
  const btnOpenImage = document.getElementById('btn-open-image');
  const imageFileInput = document.getElementById('image-file-input');
  const shapeOutlineInput = document.getElementById('shape-outline');
  const shapeFillInput = document.getElementById('shape-fill');
  const statusMode = document.getElementById('status-mode');
  const statusCanvasSize = document.getElementById('status-canvas-size');
  const statusCoords = document.getElementById('status-coords');
  const statusZoom = document.getElementById('status-zoom');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const zoomSlider = document.getElementById('zoom-slider');
  const btnNewNumberLine = document.getElementById('btn-new-number-line');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  let isPointerInStage = false;

  // File Menu Dropdown Elements
  const menuTabFile = document.getElementById('menu-tab-file');
  const fileDropdownMenu = document.getElementById('file-dropdown-menu');
  const menuFileNew = document.getElementById('menu-file-new');
  const menuFileOpen = document.getElementById('menu-file-open');
  const menuFileSave = document.getElementById('menu-file-save');
  const menuFileSaveAs = document.getElementById('menu-file-save-as');
  const menuFileExport = document.getElementById('menu-file-export');

  // Help Menu Dropdown Elements
  const menuTabHelp = document.getElementById('menu-tab-help');
  const helpDropdownMenu = document.getElementById('help-dropdown-menu');
  const menuHelpCheckUpdate = document.getElementById('menu-help-check-update');
  const menuHelpReport = document.getElementById('menu-help-report');

  // Auto-updater engine
  const autoUpdater = initAutoUpdater();

  // Insert Graph & Settings UI
  const btnInsertGraph = document.getElementById('btn-insert-graph');
  const btnSettings = document.getElementById('btn-settings');
  const modalSettings = document.getElementById('modal-settings');
  const btnSettingsClose = document.getElementById('btn-settings-close');
  const btnSettingsCancel = document.getElementById('btn-settings-cancel');
  const formSettings = document.getElementById('form-settings');
  const inputDesmosKey = document.getElementById('setting-desmos-key');
  const btnToggleKeyVis = document.getElementById('btn-toggle-key-visibility');

  // Layers UI Elements
  const btnToggleLayers = document.getElementById('btn-toggle-layers');
  const layersPanel = document.getElementById('layers-panel');
  const layersList = document.getElementById('layers-list');
  const btnLayerAdd = document.getElementById('btn-layer-add');
  const btnLayerDuplicate = document.getElementById('btn-layer-duplicate');
  const btnLayerUp = document.getElementById('btn-layer-up');
  const btnLayerDown = document.getElementById('btn-layer-down');
  const btnLayerDelete = document.getElementById('btn-layer-delete');

  // Rotate & Flip buttons
  const btnRotateRight = document.getElementById('btn-rotate-right');
  const btnRotateLeft = document.getElementById('btn-rotate-left');
  const btnFlipH = document.getElementById('btn-flip-h');
  const btnFlipV = document.getElementById('btn-flip-v');

  // Number Line Modal UI Elements
  const modalBackdrop = document.getElementById('modal-backdrop');
  const formNumberLine = document.getElementById('form-number-line');
  const modalNlTitle = document.getElementById('modal-nl-title');
  const btnModalNlClose = document.getElementById('btn-modal-nl-close');
  const btnModalNlCancel = document.getElementById('btn-modal-nl-cancel');
  const btnModalNlSubmitText = document.getElementById('btn-modal-nl-submit-text');

  const nlStartInput = document.getElementById('nl-start');
  const nlEndInput = document.getElementById('nl-end');
  const nlStepInput = document.getElementById('nl-step');
  const nlSpacingInput = document.getElementById('nl-spacing');
  const nlLabelIntervalInput = document.getElementById('nl-label-interval');
  const nlLineColorInput = document.getElementById('nl-line-color');
  const nlLineColorHex = document.getElementById('nl-line-color-hex');
  const nlLabelColorInput = document.getElementById('nl-label-color');
  const nlLabelColorHex = document.getElementById('nl-label-color-hex');
  const nlHighlightsList = document.getElementById('nl-highlights-list');
  const btnAddHighlight = document.getElementById('btn-add-highlight');

  // --- State Variables ---
  let currentTool = 'pen';
  let color1 = '#000000';
  let color2 = '#ffffff';
  let activeColorSlot = 1; // 1 = Color 1, 2 = Color 2
  let currentStrokeWidth = 4;
  let currentOpacity = 1.0; // 0.05 to 1.0 (5% to 100%)
  let isDrawing = false;
  let currentShape = null;
  let startPos = { x: 0, y: 0 };
  let editingNumberLineGroup = null;
  let activeTextarea = null;
  let zoomLevel = 1;

  // --- Artboard (Bounded Canvas) State ---
  let artboard = {
    x: 60,
    y: 40,
    width: 1152,
    height: 648,
  };

  const geometricTools = new Set([
    'line', 'curve', 'rectangle', 'rounded-rectangle', 'ellipse', 'polygon',
    'triangle', 'right-triangle', 'diamond', 'pentagon', 'hexagon', 'arrow',
    'left-arrow', 'up-arrow', 'down-arrow', 'four-star', 'star', 'six-star',
    'callout', 'speech', 'cloud',
  ]);

  // --- History Stack ---
  let history = [];
  let historyStep = -1;
  let restoreVersion = 0;
  const MAX_HISTORY_STEPS = 60;

  function updateStatusCanvasSize() {
    if (statusCanvasSize) {
      statusCanvasSize.textContent = `${Math.round(artboard.width)} × ${Math.round(artboard.height)}px`;
    }
  }

  const ZOOM_PRESETS = [0.125, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];

  function updateStatusZoom() {
    const pct = Math.round(zoomLevel * 100);
    if (statusZoom) statusZoom.textContent = `${pct}%`;
    if (btnZoomReset) btnZoomReset.textContent = `${pct}%`;
    if (zoomSlider) zoomSlider.value = pct;
  }

  function setZoom(newZoom) {
    const clampedZoom = Math.min(8.0, Math.max(0.125, Math.round(newZoom * 1000) / 1000));
    zoomLevel = clampedZoom;

    stage.scale({ x: zoomLevel, y: zoomLevel });

    const minStageW = Math.max(window.innerWidth, (artboard.x + artboard.width + 120) * zoomLevel);
    const minStageH = Math.max(window.innerHeight - 164, (artboard.y + artboard.height + 120) * zoomLevel);
    stage.width(minStageW);
    stage.height(minStageH);

    updateStatusZoom();
    if (typeof updateSelectionOpacityBar === 'function') updateSelectionOpacityBar();
    if (typeof updateBrushCursorSize === 'function') updateBrushCursorSize();
    backgroundLayer.batchDraw();
    uiLayer.batchDraw();
    stage.batchDraw();
  }

  function zoomIn() {
    const nextPreset = ZOOM_PRESETS.find((p) => p > zoomLevel + 0.01) || 8.0;
    setZoom(nextPreset);
  }

  function zoomOut() {
    const prevPreset = [...ZOOM_PRESETS].reverse().find((p) => p < zoomLevel - 0.01) || 0.125;
    setZoom(prevPreset);
  }

  function resetZoom() {
    setZoom(1.0);
  }

  // --- Initialize Konva Stage & Core Layers ---
  const stage = new Konva.Stage({
    container: 'stage-container',
    width: Math.max(window.innerWidth, artboard.x + artboard.width + 120),
    height: Math.max(window.innerHeight - 164, artboard.y + artboard.height + 120),
  });

  const backgroundLayer = new Konva.Layer({ listening: true });

  // 1. Dark workspace background covering infinite canvas
  const workspaceBg = new Konva.Rect({
    x: 0,
    y: 0,
    width: 6000,
    height: 6000,
    fill: '#202020',
  });
  backgroundLayer.add(workspaceBg);

  // 2. White Bounded Artboard Rectangle
  const artboardBg = new Konva.Rect({
    x: artboard.x,
    y: artboard.y,
    width: artboard.width,
    height: artboard.height,
    fill: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.45)',
    shadowBlur: 14,
    shadowOffset: { x: 0, y: 3 },
    shadowOpacity: 0.5,
    listening: true,
  });
  backgroundLayer.add(artboardBg);
  stage.add(backgroundLayer);

  // 3. UI Layer (Transformers, Selection Marquee, Artboard Resize Handles)
  const uiLayer = new Konva.Layer();
  stage.add(uiLayer);

  const transformer = new Konva.Transformer({
    nodes: [],
    rotateEnabled: true,
    centeredScaling: false,
    keepRatio: false, // Non-uniform scaling by default
    enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'],
    anchorCornerRadius: 3,
    anchorSize: 9,
    anchorStroke: '#0078d4',
    anchorFill: '#ffffff',
    borderStroke: '#0078d4',
    borderDash: [4, 4],
    boundBoxFunc: (oldBox, newBox) => {
      if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
      return newBox;
    },
  });
  uiLayer.add(transformer);

  transformer.on('dragmove transform', () => {
    if (typeof updateSelectionOpacityBar === 'function') updateSelectionOpacityBar();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      transformer.centeredScaling(true);
      transformer.keepRatio(true);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      transformer.centeredScaling(false);
      transformer.keepRatio(false);
    }
  });

  // --- Artboard Resize Handles on UI Layer ---
  const artboardHandlesGroup = new Konva.Group({ listening: true });
  uiLayer.add(artboardHandlesGroup);

  const handlePositions = [
    { name: 'top-left', cursor: 'nwse-resize', getPos: (a) => ({ x: a.x, y: a.y }) },
    { name: 'top-center', cursor: 'ns-resize', getPos: (a) => ({ x: a.x + a.width / 2, y: a.y }) },
    { name: 'top-right', cursor: 'nesw-resize', getPos: (a) => ({ x: a.x + a.width, y: a.y }) },
    { name: 'middle-left', cursor: 'ew-resize', getPos: (a) => ({ x: a.x, y: a.y + a.height / 2 }) },
    { name: 'middle-right', cursor: 'ew-resize', getPos: (a) => ({ x: a.x + a.width, y: a.y + a.height / 2 }) },
    { name: 'bottom-left', cursor: 'nesw-resize', getPos: (a) => ({ x: a.x, y: a.y + a.height }) },
    { name: 'bottom-center', cursor: 'ns-resize', getPos: (a) => ({ x: a.x + a.width / 2, y: a.y + a.height }) },
    { name: 'bottom-right', cursor: 'nwse-resize', getPos: (a) => ({ x: a.x + a.width, y: a.y + a.height }) },
  ];

  const handleNodes = {};
  const HANDLE_SIZE = 7;

  handlePositions.forEach((hp) => {
    const handle = new Konva.Rect({
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      offsetX: HANDLE_SIZE / 2,
      offsetY: HANDLE_SIZE / 2,
      fill: '#ffffff',
      stroke: '#444444',
      strokeWidth: 1,
      draggable: true,
      name: 'artboard-handle',
    });

    handle.on('mouseenter', () => {
      stageContainer.style.cursor = hp.cursor;
    });

    handle.on('mouseleave', () => {
      stageContainer.style.cursor = 'default';
    });

    handle.on('dragmove', () => {
      const hx = handle.x();
      const hy = handle.y();

      if (hp.name === 'middle-right') {
        artboard.width = Math.max(64, hx - artboard.x);
      } else if (hp.name === 'bottom-center') {
        artboard.height = Math.max(64, hy - artboard.y);
      } else if (hp.name === 'bottom-right') {
        artboard.width = Math.max(64, hx - artboard.x);
        artboard.height = Math.max(64, hy - artboard.y);
      } else if (hp.name === 'top-center') {
        const newH = Math.max(64, artboard.y + artboard.height - hy);
        artboard.y = artboard.y + artboard.height - newH;
        artboard.height = newH;
      } else if (hp.name === 'middle-left') {
        const newW = Math.max(64, artboard.x + artboard.width - hx);
        artboard.x = artboard.x + artboard.width - newW;
        artboard.width = newW;
      } else if (hp.name === 'top-left') {
        const newW = Math.max(64, artboard.x + artboard.width - hx);
        const newH = Math.max(64, artboard.y + artboard.height - hy);
        artboard.x = artboard.x + artboard.width - newW;
        artboard.y = artboard.y + artboard.height - newH;
        artboard.width = newW;
        artboard.height = newH;
      } else if (hp.name === 'top-right') {
        artboard.width = Math.max(64, hx - artboard.x);
        const newH = Math.max(64, artboard.y + artboard.height - hy);
        artboard.y = artboard.y + artboard.height - newH;
        artboard.height = newH;
      } else if (hp.name === 'bottom-left') {
        const newW = Math.max(64, artboard.x + artboard.width - hx);
        artboard.x = artboard.x + artboard.width - newW;
        artboard.width = newW;
        artboard.height = Math.max(64, hy - artboard.y);
      }

      applyArtboardDimensions(false);
      updateStatusCanvasSize();
    });

    handle.on('dragend', () => {
      applyArtboardDimensions(true);
      updateStatusCanvasSize();
      saveHistory();
    });

    handleNodes[hp.name] = handle;
    artboardHandlesGroup.add(handle);
  });

  function applyArtboardDimensions(save = false) {
    artboardBg.setAttrs({
      x: artboard.x,
      y: artboard.y,
      width: artboard.width,
      height: artboard.height,
    });

    if (layerManager) {
      layerManager.clipAllLayers(artboard);
    }

    handlePositions.forEach((hp) => {
      const pos = hp.getPos(artboard);
      const hNode = handleNodes[hp.name];
      if (hNode) {
        hNode.position(pos);
      }
    });

    const headerH = typeof currentHeaderHeight !== 'undefined' ? currentHeaderHeight : 140;
    const minStageW = Math.max(window.innerWidth, artboard.x + artboard.width + 120);
    const minStageH = Math.max(window.innerHeight - headerH - 26, artboard.y + artboard.height + 120);
    if (stage.width() < minStageW || stage.height() < minStageH) {
      stage.width(minStageW);
      stage.height(minStageH);
    }

    backgroundLayer.batchDraw();
    uiLayer.batchDraw();
  }

  // --- Initialize Layer Manager ---
  const layerManager = new LayerManager({
    stage,
    Konva,
    backgroundLayer,
    uiLayer,
    getArtboard: () => artboard,
    onLayersChange: () => renderLayersPanelUI(),
    saveHistory,
  });

  layerManager.init();

  // Initial layout
  applyArtboardDimensions();
  updateStatusCanvasSize();
  updateStatusZoom();

  window.addEventListener('resize', () => {
    const headerH = typeof currentHeaderHeight !== 'undefined' ? currentHeaderHeight : 140;
    const minStageW = Math.max(window.innerWidth, artboard.x + artboard.width + 120);
    const minStageH = Math.max(window.innerHeight - headerH - 26, artboard.y + artboard.height + 120);
    stage.width(minStageW);
    stage.height(minStageH);
    backgroundLayer.batchDraw();
    uiLayer.batchDraw();
    stage.batchDraw();
  });

  // --- Raster Selection Manager (Scoped strictly to Active Layer) ---
  const rasterSelection = new RasterSelectionManager({
    stage,
    getActiveLayer: () => layerManager.getActiveLayer(),
    uiLayer,
    transformer,
    Konva,
    getColor1: () => color1,
    getColor2: () => color2,
    saveHistory,
    updateActionButtons,
    getCurrentTool: () => currentTool,
    setTool,
    getZoomLevel: () => zoomLevel,
  });

  // --- Project Manager (.rko Save / Load System) ---
  const projectManager = new ProjectManager({
    stage,
    layerManager,
    uiLayer,
    transformer,
    rasterSelection,
    Konva,
    artboard,
    applyArtboardDimensions,
    updateStatusCanvasSize,
    attachShapeEvents: (shape) => attachShapeEvents(shape),
    renderLayersPanelUI: () => renderLayersPanelUI(),
    updateActionButtons: () => updateActionButtons(),
    resetHistory: () => {
      history = [];
      historyStep = -1;
    },
    pushInitialHistory: () => {
      saveHistory();
    },
  });

  // --- File Menu Dropdown Interaction ---
  if (menuTabFile && fileDropdownMenu) {
    menuTabFile.addEventListener('click', (e) => {
      e.stopPropagation();
      fileDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!fileDropdownMenu.contains(e.target) && e.target !== menuTabFile) {
        fileDropdownMenu.classList.add('hidden');
      }
    });

    if (menuFileNew) {
      menuFileNew.addEventListener('click', () => {
        fileDropdownMenu.classList.add('hidden');
        projectManager.newProject();
      });
    }

    if (menuFileOpen) {
      menuFileOpen.addEventListener('click', () => {
        fileDropdownMenu.classList.add('hidden');
        projectManager.openProject();
      });
    }

    if (menuFileSave) {
      menuFileSave.addEventListener('click', () => {
        fileDropdownMenu.classList.add('hidden');
        projectManager.saveProject(false);
      });
    }

    if (menuFileSaveAs) {
      menuFileSaveAs.addEventListener('click', () => {
        fileDropdownMenu.classList.add('hidden');
        projectManager.saveProject(true);
      });
    }

    if (menuFileExport) {
      menuFileExport.addEventListener('click', () => {
        fileDropdownMenu.classList.add('hidden');
        exportCanvas();
      });
    }
  }

  // --- Help Menu Dropdown Interaction & Bug Report ---
  async function openBugReport() {
    let version = 'unknown';
    let osInfo = 'unknown';
    const tauri = window.__TAURI__;

    if (tauri) {
      try {
        if (tauri.app && typeof tauri.app.getVersion === 'function') {
          version = await tauri.app.getVersion();
        }
      } catch (e) {
        console.warn('Failed to get app version:', e);
      }

      try {
        if (tauri.os) {
          const type = typeof tauri.os.type === 'function' ? await tauri.os.type() : 'unknown';
          const ver = typeof tauri.os.version === 'function' ? await tauri.os.version() : 'unknown';
          osInfo = `${type} ${ver}`;
        }
      } catch (e) {
        console.warn('Failed to get OS info:', e);
      }
    }

    const template = `**Steps to reproduce:**
1. 
2. 

**Expected behavior:**


**Actual behavior:**


**System info** (auto-filled, please leave as-is):
- Rempaint version: ${version}
- OS: ${osInfo}
- Zoom level at time of report: ${Math.round(zoomLevel * 100)}%

*Screenshots are welcome — you can drag and drop an image directly into this box on GitHub.*`;

    const encodedBody = encodeURIComponent(template);
    const url = `https://github.com/flashwebby/Rempaint/issues/new?title=&body=${encodedBody}`;

    if (tauri && tauri.core && typeof tauri.core.invoke === 'function') {
      // In Tauri v2, opening URLs is handled by the opener plugin, not shell.
      tauri.core.invoke('plugin:opener|open_url', { url: url })
        .catch(() => tauri.core.invoke('plugin:opener|open_path', { path: url }))
        .catch(() => tauri.core.invoke('plugin:opener|open', { path: url }))
        .catch(() => tauri.core.invoke('plugin:shell|open', { path: url }))
        .catch((e) => console.error('Bug report open failed:', e));
    } else {
      // In a regular browser environment, open synchronously to bypass popup blockers
      window.open(url, '_blank');
    }
  }

  if (menuTabHelp && helpDropdownMenu) {
    menuTabHelp.addEventListener('click', (e) => {
      e.stopPropagation();
      helpDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!helpDropdownMenu.contains(e.target) && e.target !== menuTabHelp) {
        helpDropdownMenu.classList.add('hidden');
      }
    });

    if (menuHelpCheckUpdate) {
      menuHelpCheckUpdate.addEventListener('click', () => {
        helpDropdownMenu.classList.add('hidden');
        if (autoUpdater && typeof autoUpdater.checkForUpdates === 'function') {
          autoUpdater.checkForUpdates();
        }
      });
    }

    if (menuHelpReport) {
      menuHelpReport.addEventListener('click', () => {
        helpDropdownMenu.classList.add('hidden');
        openBugReport();
      });
    }
  }

  // --- Layers Panel UI Controller ---
  function renderLayersPanelUI() {
    if (!layersList) return;
    layersList.innerHTML = '';

    const allLayers = layerManager.getAllLayers();
    if (btnLayerDelete) {
      btnLayerDelete.disabled = allLayers.length <= 1;
    }

    allLayers.forEach((layerModel) => {
      const row = document.createElement('div');
      row.className = `layer-item ${layerModel.id === layerManager.activeLayerId ? 'active' : ''}`;
      row.dataset.layerId = layerModel.id;

      // Layer thumbnail
      const thumbBox = document.createElement('div');
      thumbBox.className = 'layer-thumb-box';
      try {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 32;
        thumbCanvas.height = 24;
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, 32, 24);

        if (layerModel.konvaLayer.getChildren().length > 0) {
          const lCanvas = layerModel.konvaLayer.toCanvas({
            x: artboard.x,
            y: artboard.y,
            width: artboard.width,
            height: artboard.height,
            pixelRatio: 0.1,
          });
          tCtx.drawImage(lCanvas, 0, 0, 32, 24);
        }
        thumbBox.appendChild(thumbCanvas);
      } catch (e) {
        thumbBox.innerHTML = '<span style="font-size:8px;color:#999;">img</span>';
      }

      // Layer name / Rename
      const nameContainer = document.createElement('div');
      nameContainer.className = 'layer-name-container';

      const nameLabel = document.createElement('span');
      nameLabel.className = 'layer-name';
      nameLabel.textContent = layerModel.name;

      nameLabel.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'layer-name-input';
        input.value = layerModel.name;
        nameContainer.replaceChild(input, nameLabel);
        input.focus();
        input.select();

        const finishRename = () => {
          const newName = input.value.trim() || layerModel.name;
          layerManager.renameLayer(layerModel.id, newName);
        };
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') input.blur();
          if (ke.key === 'Escape') renderLayersPanelUI();
        });
      });

      nameContainer.appendChild(nameLabel);

      // Controls (Eye: Visibility, Padlock: Lock)
      const controls = document.createElement('div');
      controls.className = 'layer-controls';

      // Visibility button
      const btnVis = document.createElement('button');
      btnVis.type = 'button';
      btnVis.className = `layer-icon-btn ${layerModel.visible ? '' : 'inactive'}`;
      btnVis.title = layerModel.visible ? 'Hide Layer' : 'Show Layer';
      btnVis.innerHTML = layerModel.visible
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        layerManager.setLayerVisibility(layerModel.id, !layerModel.visible);
      });

      // Lock button
      const btnLock = document.createElement('button');
      btnLock.type = 'button';
      btnLock.className = `layer-icon-btn ${layerModel.locked ? '' : 'inactive'}`;
      btnLock.title = layerModel.locked ? 'Unlock Layer' : 'Lock Layer';
      btnLock.innerHTML = layerModel.locked
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

      btnLock.addEventListener('click', (e) => {
        e.stopPropagation();
        layerManager.setLayerLock(layerModel.id, !layerModel.locked);
      });

      controls.appendChild(btnVis);
      controls.appendChild(btnLock);

      row.appendChild(thumbBox);
      row.appendChild(nameContainer);
      row.appendChild(controls);

      row.addEventListener('click', () => {
        layerManager.setActiveLayer(layerModel.id);
        const activeLayer = layerManager.getActiveLayer();
        const curNodes = transformer.nodes();
        const validNodes = curNodes.filter((n) => n.getLayer() === activeLayer);
        if (validNodes.length !== curNodes.length) {
          curNodes.forEach((n) => {
            if (!validNodes.includes(n)) n.draggable(false);
          });
          transformer.nodes(validNodes);
          uiLayer.batchDraw();
          updateActionButtons();
        }
      });

      layersList.appendChild(row);
    });
  }

  // Layers Toolbar Button Listeners
  if (btnToggleLayers) {
    btnToggleLayers.addEventListener('click', () => {
      layersPanel.classList.toggle('hidden');
      btnToggleLayers.classList.toggle('active', !layersPanel.classList.contains('hidden'));
    });
  }

  if (btnLayerAdd) {
    btnLayerAdd.addEventListener('click', () => layerManager.createLayer());
  }
  if (btnLayerDuplicate) {
    btnLayerDuplicate.addEventListener('click', () => layerManager.duplicateLayer(layerManager.activeLayerId));
  }
  if (btnLayerUp) {
    btnLayerUp.addEventListener('click', () => layerManager.moveLayerUp(layerManager.activeLayerId));
  }
  if (btnLayerDown) {
    btnLayerDown.addEventListener('click', () => layerManager.moveLayerDown(layerManager.activeLayerId));
  }
  if (btnLayerDelete) {
    btnLayerDelete.addEventListener('click', () => layerManager.deleteLayer(layerManager.activeLayerId));
  }

  // --- Desmos Modal Integration ---
  const desmosModal = new DesmosModalManager({
    onCommit: async (data) => {
      const activeLayer = layerManager.getActiveLayer();
      if (data.existingNode) {
        // Update existing graph node
        const node = data.existingNode;
        const img = new Image();
        img.onload = () => {
          node.image(img);
          node.setAttr('desmosState', data.desmosState);
          node.setAttr('displaySettings', data.displaySettings);
          node.setAttr('transparentBg', data.transparentBg);
          node.setAttr('mathBounds', data.mathBounds);
          const lyr = node.getLayer() || activeLayer;
          if (lyr) lyr.batchDraw();
          uiLayer.batchDraw();
          updateActionButtons();
          saveHistory();
        };
        img.src = data.dataUri;
      } else {
        // Create new graph node on its own new layer!
        const graphCount = layerManager.layers.filter((l) => l.name.startsWith('Graph')).length + 1;
        const layerName = `Graph ${graphCount}`;
        const newLayerModel = layerManager.createLayer(layerName);

        const img = new Image();
        img.onload = () => {
          const targetW = data.width || 600;
          const targetH = data.height || 450;
          const node = new Konva.Image({
            x: Math.round(artboard.x + (artboard.width - targetW) / 2),
            y: Math.round(artboard.y + (artboard.height - targetH) / 2),
            width: targetW,
            height: targetH,
            image: img,
            name: 'shape',
            draggable: true,
          });
          node.setAttr('shapeType', 'desmos-graph');
          node.setAttr('desmosState', data.desmosState);
          node.setAttr('displaySettings', data.displaySettings);
          node.setAttr('transparentBg', data.transparentBg);
          node.setAttr('mathBounds', data.mathBounds);

          newLayerModel.konvaLayer.add(node);
          attachShapeEvents(node);

          setTool('select-rect');
          transformer.nodes([node]);
          newLayerModel.konvaLayer.batchDraw();
          uiLayer.batchDraw();
          updateActionButtons();
          saveHistory();
        };
        img.src = data.dataUri;
      }
    },
  });

  if (btnInsertGraph) {
    btnInsertGraph.addEventListener('click', () => {
      desmosModal.open();
    });
  }

  // --- Settings Modal & API Key Handling ---
  function openSettingsModal() {
    if (inputDesmosKey) {
      inputDesmosKey.value = getDesmosApiKey();
      inputDesmosKey.type = 'password';
    }
    if (modalSettings) {
      modalSettings.classList.remove('hidden');
    }
  }

  function closeSettingsModal() {
    if (modalSettings) {
      modalSettings.classList.add('hidden');
    }
  }

  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  if (btnSettingsClose) btnSettingsClose.addEventListener('click', closeSettingsModal);
  if (btnSettingsCancel) btnSettingsCancel.addEventListener('click', closeSettingsModal);

  if (btnToggleKeyVis && inputDesmosKey) {
    btnToggleKeyVis.addEventListener('click', () => {
      inputDesmosKey.type = inputDesmosKey.type === 'password' ? 'text' : 'password';
    });
  }

  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      const keyVal = inputDesmosKey ? inputDesmosKey.value.trim() : '';
      setDesmosApiKey(keyVal);

      // Download / save as text file named desmos_api_key.txt
      try {
        const blob = new Blob([keyVal], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'desmos_api_key.txt';
        link.click();
      } catch (err) {
        console.warn('Could not export key file:', err);
      }

      closeSettingsModal();
    });
  }

  // --- History Management (Multi-Layer Snapshots) ---
  function serializeDrawingLayer() {
    const layersData = [];

    layerManager.getAllLayers().forEach((layerModel) => {
      const shapes = [];
      layerModel.konvaLayer.getChildren().forEach((node) => {
        if (rasterSelection && node === rasterSelection.floatingSelection) return;
        const name = node.name();
        if (name === 'shape' || name === 'baked-raster') {
          if (node.getClassName() === 'Group' && node.getAttr('shapeType')) {
            shapes.push({
              className: 'Group',
              shapeType: node.getAttr('shapeType'),
              shapeConfig: node.getAttr('shapeConfig'),
              attrs: {
                x: node.x(),
                y: node.y(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
                rotation: node.rotation(),
                opacity: node.opacity() !== undefined ? node.opacity() : 1,
                name: 'shape',
              },
            });
          } else if (node.getClassName() === 'Image' && node.getAttr('shapeType') === 'math-text') {
            shapes.push({
              className: 'Image',
              shapeType: 'math-text',
              latexSource: node.getAttr('latexSource'),
              baseFontSize: node.getAttr('baseFontSize'),
              textColor: node.getAttr('textColor'),
              attrs: {
                x: node.x(),
                y: node.y(),
                width: node.width(),
                height: node.height(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
                rotation: node.rotation(),
                name: 'shape',
              },
            });
          } else if (node.getClassName() === 'Image' && node.getAttr('shapeType') === 'desmos-graph') {
            const imgElement = node.image();
            shapes.push({
              className: 'Image',
              shapeType: 'desmos-graph',
              desmosState: node.getAttr('desmosState'),
              displaySettings: node.getAttr('displaySettings'),
              transparentBg: node.getAttr('transparentBg'),
              mathBounds: node.getAttr('mathBounds'),
              dataURL: imgElement ? (imgElement.src || (imgElement.toDataURL ? imgElement.toDataURL() : '')) : '',
              attrs: {
                x: node.x(),
                y: node.y(),
                width: node.width(),
                height: node.height(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
                rotation: node.rotation(),
                name: 'shape',
              },
            });
          } else if (node.getClassName() === 'Image') {
            const imgElement = node.image();
            shapes.push({
              className: 'Image',
              isBakedRaster: name === 'baked-raster',
              dataURL: imgElement ? (imgElement.src || (imgElement.toDataURL ? imgElement.toDataURL() : '')) : '',
              attrs: { ...node.attrs },
            });
          } else {
            shapes.push({
              className: node.getClassName(),
              attrs: { ...node.attrs },
            });
          }
        }
      });

      layersData.push({
        id: layerModel.id,
        name: layerModel.name,
        visible: layerModel.visible,
        locked: layerModel.locked,
        shapes,
      });
    });

    return JSON.stringify({
      artboard: { width: artboard.width, height: artboard.height, x: artboard.x, y: artboard.y },
      activeLayerId: layerManager.activeLayerId,
      layers: layersData,
    });
  }

  function saveHistory() {
    const snapshot = serializeDrawingLayer();
    if (historyStep >= 0 && history[historyStep] === snapshot) return;
    history = history.slice(0, historyStep + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY_STEPS) history.shift();
    else historyStep++;
    if (typeof projectManager !== 'undefined' && projectManager && historyStep > 0) {
      projectManager.markUnsaved();
    }
    updateActionButtons();
    renderLayersPanelUI();
  }
  window.__rempaintSaveHistory = saveHistory;

  function restoreState(serializedState) {
    if (!serializedState) return;
    const thisRestore = ++restoreVersion;
    if (rasterSelection && rasterSelection.hasActiveSelection()) {
      rasterSelection.clearFloatingSelection();
    }
    transformer.nodes([]);
    uiLayer.batchDraw();

    try {
      const parsed = JSON.parse(serializedState);

      // Handle artboard restoration
      if (parsed && parsed.artboard) {
        artboard.width = parsed.artboard.width || 1152;
        artboard.height = parsed.artboard.height || 648;
        if (parsed.artboard.x !== undefined) artboard.x = parsed.artboard.x;
        if (parsed.artboard.y !== undefined) artboard.y = parsed.artboard.y;
        applyArtboardDimensions(false);
        updateStatusCanvasSize();
      }

      // Clear existing layers
      layerManager.destroyAllLayers();

      // Check format: multi-layer vs legacy single layer
      let rawLayers = [];
      if (parsed && Array.isArray(parsed.layers)) {
        rawLayers = parsed.layers;
      } else if (parsed && Array.isArray(parsed.shapes)) {
        rawLayers = [{ id: 'layer_default', name: 'Layer 1', visible: true, locked: false, shapes: parsed.shapes }];
      } else if (Array.isArray(parsed)) {
        rawLayers = [{ id: 'layer_default', name: 'Layer 1', visible: true, locked: false, shapes: parsed }];
      }

      rawLayers.forEach((lData) => {
        const layerModel = layerManager.createLayer(lData.name, false);
        layerModel.id = lData.id || layerModel.id;
        layerModel.visible = lData.visible !== false;
        layerModel.locked = lData.locked === true;
        layerModel.konvaLayer.visible(layerModel.visible);
        layerModel.konvaLayer.listening(!layerModel.locked);

        (lData.shapes || []).forEach((item) => {
          if (item.className === 'Group' && item.shapeType === 'number-line') {
            const group = createNumberLineGroup(item.shapeConfig, Konva);
            group.setAttrs(item.attrs);
            group.name('shape');
            attachShapeEvents(group);
            layerModel.konvaLayer.add(group);
          } else if (item.className === 'Group' && item.shapeType === 'fixed-circle') {
            const group = createFixedCircleGroup(item.shapeConfig, Konva);
            group.setAttrs(item.attrs);
            group.name('shape');
            attachShapeEvents(group);
            layerModel.konvaLayer.add(group);
          } else if (item.className === 'Group' && item.shapeType === 'parametric-angle') {
            const group = createParametricAngleGroup(item.shapeConfig, Konva);
            group.setAttrs(item.attrs);
            group.name('shape');
            attachShapeEvents(group);
            layerModel.konvaLayer.add(group);
          } else if (item.className === 'Group' && item.shapeType === 'parametric-gear') {
            const group = createParametricGearGroup(item.shapeConfig, Konva);
            group.setAttrs(item.attrs);
            group.name('shape');
            attachShapeEvents(group);
            layerModel.konvaLayer.add(group);
          } else if (item.className === 'Image' && item.shapeType === 'math-text') {
            createMathTextImageNode({
              x: item.attrs.x,
              y: item.attrs.y,
              latexSource: item.latexSource,
              baseFontSize: item.baseFontSize,
              textColor: item.textColor,
            }, Konva).then((node) => {
              if (thisRestore !== restoreVersion) return;
              node.setAttrs(item.attrs);
              attachShapeEvents(node);
              layerModel.konvaLayer.add(node);
              layerModel.konvaLayer.batchDraw();
            });
          } else if (item.className === 'Image' && item.shapeType === 'desmos-graph') {
            const img = new window.Image();
            img.src = item.dataURL;
            img.onload = () => {
              if (thisRestore !== restoreVersion) return;
              const konvaImg = new Konva.Image({
                ...item.attrs,
                image: img,
                name: 'shape',
                draggable: true,
              });
              konvaImg.setAttr('shapeType', 'desmos-graph');
              konvaImg.setAttr('desmosState', item.desmosState);
              konvaImg.setAttr('displaySettings', item.displaySettings);
              konvaImg.setAttr('transparentBg', item.transparentBg);
              konvaImg.setAttr('mathBounds', item.mathBounds);

              attachShapeEvents(konvaImg);
              layerModel.konvaLayer.add(konvaImg);
              layerModel.konvaLayer.batchDraw();
            };
          } else if (item.className === 'Image') {
            const img = new window.Image();
            img.src = item.dataURL;
            img.onload = () => {
              if (thisRestore !== restoreVersion) return;
              const konvaImg = new Konva.Image({
                ...item.attrs,
                image: img,
                listening: !item.isBakedRaster,
              });
              konvaImg.name(item.isBakedRaster ? 'baked-raster' : 'shape');
              konvaImg.draggable(false);
              if (!item.isBakedRaster) {
                attachShapeEvents(konvaImg);
              }
              layerModel.konvaLayer.add(konvaImg);
              layerModel.konvaLayer.batchDraw();
            };
          } else {
            const NodeConstructor = Konva[item.className];
            if (NodeConstructor) {
              const shape = new NodeConstructor(item.attrs);
              const nodeName = item.attrs.name || 'shape';
              shape.name(nodeName);
              if (nodeName !== 'baked-raster' && item.attrs.draggable !== false && item.attrs.listening !== false) {
                attachShapeEvents(shape);
              } else {
                shape.draggable(false);
                shape.listening(false);
              }
              layerModel.konvaLayer.add(shape);
            }
          }
        });
      });

      if (parsed.activeLayerId && layerManager.getLayerById(parsed.activeLayerId)) {
        layerManager.setActiveLayer(parsed.activeLayerId, false);
      } else {
        layerManager.syncLayerInteractivity();
      }

      layerManager.updateStageZIndices();
      layerManager.clipAllLayers(artboard);
      stage.batchDraw();
      renderLayersPanelUI();
    } catch (err) {
      console.warn('Could not restore layer state:', err);
    }

    updateActionButtons();
  }

  function undo() {
    if (historyStep > 0) {
      historyStep--;
      restoreState(history[historyStep]);
    } else if (historyStep === 0) {
      historyStep--;
      layerManager.clearActiveLayer();
      updateActionButtons();
    }
  }

  function redo() {
    if (historyStep < history.length - 1) {
      historyStep++;
      restoreState(history[historyStep]);
    }
  }

  const selectionOpacityBar = document.getElementById('selection-opacity-bar');
  const selectionOpacitySlider = document.getElementById('selection-opacity-slider');
  const selectionOpacityValue = document.getElementById('selection-opacity-value');

  function syncAngleHandles() {
    const selectedNodes = transformer.nodes();
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer) return;

    activeLayer.find('.angle-handle').forEach((h) => {
      const parent = h.getParent();
      const isSelected = selectedNodes.includes(parent);
      h.visible(isSelected);
    });
    activeLayer.batchDraw();
  }

  function updateSelectionOpacityBar() {
    syncAngleHandles();
    if (!selectionOpacityBar) return;

    let selectedNode = null;
    if (rasterSelection.hasActiveSelection()) {
      selectedNode = rasterSelection.floatingSelection;
    } else {
      const nodes = transformer.nodes();
      if (nodes.length > 0) {
        selectedNode = nodes[0];
      }
    }

    if (!selectedNode) {
      selectionOpacityBar.classList.add('hidden');
      return;
    }

    const currentOp = selectedNode.opacity() !== undefined ? selectedNode.opacity() : 1.0;
    const pct = Math.round(currentOp * 100);

    if (selectionOpacitySlider) selectionOpacitySlider.value = pct;
    if (selectionOpacityValue) selectionOpacityValue.textContent = `${pct}%`;

    // Position floating bar right above the selected node
    try {
      const stageBox = stageContainer.getBoundingClientRect();
      const nodeRect = selectedNode.getClientRect(); // gets coordinates in stage (absolute) space

      // Convert absolute canvas coordinates to screen coordinates by accounting for container scroll (pan)
      const screenX = stageBox.left - stageContainer.scrollLeft + nodeRect.x + nodeRect.width / 2;
      const screenY = stageBox.top - stageContainer.scrollTop + nodeRect.y - 14;

      selectionOpacityBar.style.left = `${Math.max(140, Math.min(window.innerWidth - 140, screenX))}px`;
      selectionOpacityBar.style.top = `${Math.max(150, screenY)}px`;
      selectionOpacityBar.classList.remove('hidden');
    } catch (e) {
      selectionOpacityBar.classList.add('hidden');
    }
  }

  function setSelectionOpacity(pct) {
    const op = Math.max(0.05, Math.min(1.0, pct / 100));

    if (rasterSelection.hasActiveSelection() && rasterSelection.floatingSelection) {
      rasterSelection.floatingSelection.opacity(op);
    }

    const nodes = transformer.nodes();
    nodes.forEach((node) => {
      node.opacity(op);
    });

    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) activeLayer.batchDraw();
    uiLayer.batchDraw();

    const pctRound = Math.round(pct);
    if (selectionOpacityValue) selectionOpacityValue.textContent = `${pctRound}%`;
    if (selectionOpacitySlider && selectionOpacitySlider.value != pctRound) selectionOpacitySlider.value = pctRound;
  }

  if (selectionOpacitySlider) {
    selectionOpacitySlider.addEventListener('input', (e) => setSelectionOpacity(parseFloat(e.target.value)));
    selectionOpacitySlider.addEventListener('change', () => saveHistory());
  }

  function updateActionButtons() {
    btnUndo.disabled = historyStep < 0;
    btnRedo.disabled = historyStep >= history.length - 1;
    const hasSelection = transformer.nodes().length > 0 || rasterSelection.hasActiveSelection();
    btnDelete.disabled = !hasSelection;
    if (btnRotateRight) btnRotateRight.disabled = !hasSelection;
    if (btnRotateLeft) btnRotateLeft.disabled = !hasSelection;
    if (btnFlipH) btnFlipH.disabled = !hasSelection;
    if (btnFlipV) btnFlipV.disabled = !hasSelection;
    updateSelectionOpacityBar();
  }

  // --- Shape Event Handling ---
  function attachShapeEvents(shape) {
    shape.on('dragstart', (e) => {
      const activeLayer = layerManager.getActiveLayer();
      if (shape.getLayer() !== activeLayer) {
        e.target.stopDrag();
      }
    });

    shape.on('dragmove', () => updateSelectionOpacityBar());
    shape.on('dragend', () => saveHistory());

    shape.on('transform', () => {
      updateSelectionOpacityBar();
      if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'number-line') {
        const scaleX = shape.scaleX();
        const config = shape.getAttr('shapeConfig');

        const numTicks = Math.max(1, Math.round((config.end - config.start) / config.step) + 1);
        const margin = 35;
        const currentTotalWidth = margin * 2 + (numTicks - 1) * config.spacing;

        if (currentTotalWidth > 0) {
          const newTotalWidth = currentTotalWidth * scaleX;
          const totalTicksDelta = Math.round((newTotalWidth - currentTotalWidth) / config.spacing);
          const halfDelta = Math.round(totalTicksDelta / 2);

          if (halfDelta !== 0) {
            const newStart = config.start - halfDelta * config.step;
            const newEnd = config.end + halfDelta * config.step;
            const newConfig = { ...config, start: newStart, end: newEnd };

            shape.scaleX(1);
            shape.scaleY(1);

            renderNumberLine(shape, newConfig, Konva);
          } else {
            shape.scaleY(1);
          }
        }
      }
    });

    shape.on('transformend', async () => {
      const activeLayer = shape.getLayer() || layerManager.getActiveLayer();
      if (shape.getClassName() === 'Image' && shape.getAttr('shapeType') === 'math-text') {
        await refreshMathTextCrisp(shape);
        if (activeLayer) activeLayer.batchDraw();
        uiLayer.batchDraw();
      } else if (shape.getClassName() === 'Image' && shape.getAttr('shapeType') === 'desmos-graph') {
        const scaleX = Math.abs(shape.scaleX()) || 1;
        const scaleY = Math.abs(shape.scaleY()) || 1;
        const newWidth = Math.max(60, Math.round(shape.width() * scaleX));
        const newHeight = Math.max(40, Math.round(shape.height() * scaleY));

        shape.width(newWidth);
        shape.height(newHeight);
        shape.scaleX(1);
        shape.scaleY(1);

        try {
          const desmosState = shape.getAttr('desmosState');
          const transparent = shape.getAttr('transparentBg') !== false;
          if (window.Desmos && desmosState) {
            const hiddenDiv = document.createElement('div');
            hiddenDiv.style.width = `${newWidth}px`;
            hiddenDiv.style.height = `${newHeight}px`;
            hiddenDiv.style.position = 'fixed';
            hiddenDiv.style.left = '-9999px';
            hiddenDiv.style.top = '-9999px';
            document.body.appendChild(hiddenDiv);

            const tempCalc = window.Desmos.GraphingCalculator(hiddenDiv, {
              keypad: false,
              expressions: false,
              settingsMenu: false,
              zoomButtons: false,
              border: false,
            });
            tempCalc.setState(desmosState);

            const displaySettings = shape.getAttr('displaySettings') || {};
            const arrowMode = displaySettings.showArrows !== false
              ? window.Desmos.AxisArrowModes.BOTH
              : window.Desmos.AxisArrowModes.NONE;

            tempCalc.updateSettings({
              showGrid: displaySettings.showGrid !== false,
              showXAxis: displaySettings.showXAxis !== false,
              showYAxis: displaySettings.showYAxis !== false,
              xAxisNumbers: displaySettings.showAxisNumbers !== false,
              yAxisNumbers: displaySettings.showAxisNumbers !== false,
              xAxisArrowMode: arrowMode,
              yAxisArrowMode: arrowMode,
              degreeMode: displaySettings.degreeMode === true,
              xAxisLabel: displaySettings.xAxisLabel || '',
              yAxisLabel: displaySettings.yAxisLabel || '',
              xAxisStep: parseFloat(displaySettings.xAxisStep) || 0,
              yAxisStep: parseFloat(displaySettings.yAxisStep) || 0,
            });

            const { dataUri } = await captureDesmosScreenshot(tempCalc, newWidth, newHeight, transparent);
            tempCalc.destroy();
            hiddenDiv.remove();

            const img = new Image();
            img.onload = () => {
              shape.image(img);
              if (activeLayer) activeLayer.batchDraw();
              uiLayer.batchDraw();
            };
            img.src = dataUri;
          }
        } catch (err) {
          console.warn('Crisp Desmos re-render error:', err);
        }
      } else if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'fixed-circle') {
        const scale = Math.max(Math.abs(shape.scaleX()), Math.abs(shape.scaleY()));
        const cfg = shape.getAttr('shapeConfig');
        if (cfg) {
          cfg.radius = Math.max(5, Math.round(cfg.radius * scale));
          renderFixedCircle(shape, cfg, Konva);
          shape.scaleX(1);
          shape.scaleY(1);
          if (activeLayer) activeLayer.batchDraw();
          uiLayer.batchDraw();
        }
      } else if (shape.getClassName() === 'Text') {
        const scaleY = shape.scaleY();
        shape.fontSize(Math.max(8, Math.round(shape.fontSize() * scaleY)));
        shape.scaleX(1);
        shape.scaleY(1);
        if (activeLayer) activeLayer.batchDraw();
        uiLayer.batchDraw();
      }
      saveHistory();
    });

    shape.on('dblclick dbltap', (e) => {
      const activeLayer = layerManager.getActiveLayer();
      if (shape.getLayer() !== activeLayer) {
        return;
      }
      if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'number-line') {
        e.cancelBubble = true;
        openNumberLineModal(shape);
      } else if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'fixed-circle') {
        e.cancelBubble = true;
        openFixedCircleModal(shape);
      } else if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'parametric-angle') {
        e.cancelBubble = true;
        openAngleModal(shape);
      } else if (shape.getClassName() === 'Group' && shape.getAttr('shapeType') === 'parametric-gear') {
        e.cancelBubble = true;
        openGearModal(shape);
      } else if (shape.getClassName() === 'Image' && shape.getAttr('shapeType') === 'desmos-graph') {
        e.cancelBubble = true;
        desmosModal.open({ existingNode: shape });
      } else if (shape.getClassName() === 'Text') {
        e.cancelBubble = true;
        reEditTextNode(shape);
      } else if (shape.getClassName() === 'Image' && shape.getAttr('shapeType') === 'math-text') {
        e.cancelBubble = true;
        const stageBox = stageContainer.getBoundingClientRect();
        const clientX = stageBox.left + shape.x() * zoomLevel;
        const clientY = stageBox.top + shape.y() * zoomLevel;
        openMathTextEditor({
          x: shape.x(),
          y: shape.y(),
          clientX,
          clientY,
          initialLatex: shape.getAttr('latexSource') || '',
          initialFontSize: shape.getAttr('baseFontSize') || 28,
          initialColor: shape.getAttr('textColor') || color1,
          existingNode: shape,
          onCommit: async (data) => {
            shape.setAttr('latexSource', data.latexSource);
            shape.setAttr('baseFontSize', data.baseFontSize);
            shape.setAttr('textColor', data.textColor);
            await refreshMathTextCrisp(shape);
            setTool('select-rect');
            shape.draggable(true);
            transformer.nodes([shape]);
            const lyr = shape.getLayer() || layerManager.getActiveLayer();
            if (lyr) lyr.batchDraw();
            uiLayer.batchDraw();
            updateActionButtons();
            saveHistory();
          },
        });
      }
    });
  }

  // --- Tool Switching ---
  function setTool(toolName) {
    if (activeTextarea) {
      activeTextarea.blur();
    }

    // Commit any active floating raster selection
    if (currentTool === 'select-rect' || currentTool === 'select-lasso') {
      rasterSelection.commitSelection();
    }

    // Ensure any parametric shapes left in the transformer are frozen before clearing
    transformer.nodes().forEach((n) => n.draggable(false));
    transformer.nodes([]);
    uiLayer.batchDraw();

    currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      if (btn.dataset.tool === toolName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    stageContainer.className = '';
    const isSelectionMode = currentTool === 'select-rect' || currentTool === 'select-lasso';

    if (currentTool === 'select-rect') {
      stageContainer.classList.add('cursor-select-rect');
      statusMode.textContent = 'Rectangular Selection Tool (Click & drag to slice pixel region — V / M)';
    } else if (currentTool === 'select-lasso') {
      stageContainer.classList.add('cursor-select-lasso');
      statusMode.textContent = 'Free-form Lasso Selection Tool (Click & drag freehand outline — Shift+L)';
    } else if (currentTool === 'pen') {
      stageContainer.classList.add('cursor-pen');
      statusMode.textContent = 'Pencil Tool (P)';
    } else if (currentTool === 'eraser') {
      stageContainer.classList.add('cursor-eraser');
      statusMode.textContent = 'Eraser Tool (E)';
    } else if (currentTool === 'fill') {
      stageContainer.classList.add('cursor-fill');
      statusMode.textContent = 'Fill with Color Tool (Paint Bucket)';
    } else if (currentTool === 'picker') {
      stageContainer.classList.add('cursor-picker');
      statusMode.textContent = 'Color Picker (Eyedropper)';
    } else if (currentTool === 'text') {
      stageContainer.classList.add('cursor-text');
      statusMode.textContent = 'Text Tool (Click canvas to type text — T)';
    } else if (currentTool === 'math-text') {
      stageContainer.classList.add('cursor-math-text');
      statusMode.textContent = 'Math Text Tool (LaTeX formula — Shift+T)';
    } else if (currentTool === 'magnifier') {
      stageContainer.classList.add('cursor-magnifier');
      statusMode.textContent = `Magnifier (Left-click zoom in, Right-click zoom out — ${Math.round(zoomLevel * 100)}%)`;
    } else if (geometricTools.has(currentTool)) {
      stageContainer.classList.add('cursor-shape');
      statusMode.textContent = `${toolName.charAt(0).toUpperCase() + toolName.slice(1)} Tool`;
    } else {
      stageContainer.classList.add('cursor-pen');
      statusMode.textContent = `${toolName.charAt(0).toUpperCase() + toolName.slice(1)} Tool`;
    }

    // Toggle Quick Sliders (Visible strictly for Brush & Eraser)
    const quickSliders = document.getElementById('canvas-quick-sliders');
    if (quickSliders) {
      if (currentTool === 'pen' || currentTool === 'eraser') {
        quickSliders.classList.remove('hidden');
      } else {
        quickSliders.classList.add('hidden');
      }
    }

    if (brushCursor) {
      if (currentTool === 'pen' || currentTool === 'eraser') {
        stageContainer.classList.add('hide-native-cursor');
        if (isPointerInStage) brushCursor.classList.remove('hidden');
      } else {
        stageContainer.classList.remove('hide-native-cursor');
        brushCursor.classList.add('hidden');
      }
    }

    if (!isSelectionMode) {
      transformer.nodes([]);
      uiLayer.batchDraw();
    }

    updateActionButtons();
  }

  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool && !btn.classList.contains('disabled')) setTool(tool);
    });
  });

  // --- Color Slot Selection (Color 1 & Color 2) ---
  function setActiveColorSlot(slot) {
    activeColorSlot = slot;
    if (slot === 1) {
      slotColor1.classList.add('active');
      slotColor2.classList.remove('active');
      strokeColorInput.value = color1;
    } else {
      slotColor2.classList.add('active');
      slotColor1.classList.remove('active');
      strokeColorInput.value = color2;
    }
  }

  slotColor1.addEventListener('click', () => setActiveColorSlot(1));
  slotColor2.addEventListener('click', () => setActiveColorSlot(2));

  function updateColor(color) {
    if (activeColorSlot === 1) {
      color1 = color;
      color1Preview.style.backgroundColor = color;
    } else {
      color2 = color;
      color2Preview.style.backgroundColor = color;
    }
    strokeColorInput.value = color;

    // If an existing shape is selected in Select mode, update its color
    if ((currentTool === 'select-rect' || currentTool === 'select-lasso') && transformer.nodes().length > 0) {
      let modified = false;
      transformer.nodes().forEach((node) => {
        const targetLayer = node.getLayer() || layerManager.getActiveLayer();
        if (node.getClassName() === 'Group' && node.getAttr('shapeType') === 'number-line') {
          const newConfig = { ...node.getAttr('shapeConfig'), lineColor: color1 };
          renderNumberLine(node, newConfig, Konva);
          modified = true;
        } else if (node.getClassName() === 'Text') {
          node.fill(color1);
          modified = true;
        } else if (node.getClassName() === 'Image' && node.getAttr('shapeType') === 'math-text') {
          node.setAttr('textColor', color1);
          refreshMathTextCrisp(node).then(() => {
            if (targetLayer) targetLayer.batchDraw();
            uiLayer.batchDraw();
          });
          modified = true;
        } else if (activeColorSlot === 1 && node.stroke) {
          node.stroke(color1);
          modified = true;
        } else if (activeColorSlot === 2 && node.fill) {
          node.fill(color2);
          modified = true;
        }
      });
      if (modified) {
        stage.batchDraw();
        uiLayer.batchDraw();
        saveHistory();
      }
    }
  }

  strokeColorInput.addEventListener('input', (e) => updateColor(e.target.value));
  paletteDots.forEach((dot) => dot.addEventListener('click', () => updateColor(dot.dataset.color)));

  // --- Quick Sliders (Brush Size & Opacity) DOM Elements ---
  const pillSize = document.getElementById('pill-size');
  const trackContainerSize = document.getElementById('track-container-size');
  const fillSize = document.getElementById('fill-size');
  const thumbSize = document.getElementById('thumb-size');
  const tooltipSize = document.getElementById('tooltip-size');

  const pillOpacity = document.getElementById('pill-opacity');
  const trackContainerOpacity = document.getElementById('track-container-opacity');
  const fillOpacity = document.getElementById('fill-opacity');
  const thumbOpacity = document.getElementById('thumb-opacity');
  const tooltipOpacity = document.getElementById('tooltip-opacity');

  function syncQuickSliders() {
    // Size (1 to 200px)
    const sizePct = Math.max(0, Math.min(1, (currentStrokeWidth - 1) / (200 - 1)));
    if (fillSize) fillSize.style.height = `${sizePct * 100}%`;
    if (thumbSize) {
      thumbSize.style.bottom = `${sizePct * 100}%`;
      thumbSize.setAttribute('aria-valuenow', Math.round(currentStrokeWidth));
    }
    if (tooltipSize) tooltipSize.textContent = `${Math.round(currentStrokeWidth)}px`;

    // Opacity (5% to 100%)
    const opPct = Math.max(0, Math.min(1, (currentOpacity - 0.05) / (1.0 - 0.05)));
    if (fillOpacity) fillOpacity.style.height = `${opPct * 100}%`;
    if (thumbOpacity) {
      thumbOpacity.style.bottom = `${opPct * 100}%`;
      thumbOpacity.setAttribute('aria-valuenow', Math.round(currentOpacity * 100));
    }
    if (tooltipOpacity) tooltipOpacity.textContent = `${Math.round(currentOpacity * 100)}%`;
  }

  // --- Brush Cursor Update ---
  function updateBrushCursorSize() {
    if (brushCursor) {
      const scaledSize = currentStrokeWidth * stage.scaleX();
      brushCursor.style.width = `${scaledSize}px`;
      brushCursor.style.height = `${scaledSize}px`;
    }
  }

  // --- Stroke Width Controls ---
  function updateStrokeWidth(width) {
    currentStrokeWidth = Math.max(1, Math.min(200, width));
    strokeWidthInput.value = currentStrokeWidth;
    if (strokeWidthNumeric) strokeWidthNumeric.value = currentStrokeWidth;
    strokePreviewLine.style.height = `${Math.min(currentStrokeWidth, 20)}px`;
    strokePreviewLine.style.borderRadius = `${currentStrokeWidth / 2}px`;
    syncQuickSliders();
    updateBrushCursorSize();

    if ((currentTool === 'select-rect' || currentTool === 'select-lasso') && transformer.nodes().length > 0) {
      let modified = false;
      transformer.nodes().forEach((node) => {
        if (node.getClassName() === 'Group' && node.getAttr('shapeType') === 'number-line') {
          const newConfig = { ...node.getAttr('shapeConfig'), strokeWidth: currentStrokeWidth };
          renderNumberLine(node, newConfig, Konva);
          modified = true;
        } else if (node.strokeWidth) {
          node.strokeWidth(currentStrokeWidth);
          modified = true;
        }
      });
      if (modified) {
        stage.batchDraw();
        uiLayer.batchDraw();
        saveHistory();
      }
    }
  }

  function updateStrokeOpacity(opacity) {
    currentOpacity = Math.max(0.05, Math.min(1.0, Math.round(opacity * 100) / 100));
    syncQuickSliders();

    if ((currentTool === 'select-rect' || currentTool === 'select-lasso') && transformer.nodes().length > 0) {
      let modified = false;
      transformer.nodes().forEach((node) => {
        if (node.opacity) {
          node.opacity(currentOpacity);
          modified = true;
        }
      });
      if (modified) {
        stage.batchDraw();
        uiLayer.batchDraw();
        saveHistory();
      }
    }
  }

  strokeWidthInput.addEventListener('input', (e) => updateStrokeWidth(parseInt(e.target.value, 10)));
  if (strokeWidthNumeric) {
    strokeWidthNumeric.addEventListener('input', (e) => updateStrokeWidth(parseInt(e.target.value, 10)));
  }

  function setupVerticalSlider(trackContainer, pill, thumb, onValueChange, getValueRatio) {
    if (!trackContainer || !pill) return;

    let isDragging = false;

    function handlePointer(clientY) {
      const rect = trackContainer.getBoundingClientRect();
      if (rect.height <= 0) return;
      const relY = Math.max(0, Math.min(rect.height, rect.bottom - clientY));
      const ratio = Math.max(0, Math.min(1, relY / rect.height));
      onValueChange(ratio);
    }

    trackContainer.addEventListener('pointerdown', (e) => {
      isDragging = true;
      pill.classList.add('active');
      if (thumb) thumb.classList.add('dragging');
      trackContainer.setPointerCapture(e.pointerId);
      handlePointer(e.clientY);
    });

    trackContainer.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      handlePointer(e.clientY);
    });

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        pill.classList.remove('active');
        if (thumb) thumb.classList.remove('dragging');
      }
    };

    trackContainer.addEventListener('pointerup', stopDrag);
    trackContainer.addEventListener('pointercancel', stopDrag);

    // Mouse wheel over pill to adjust smoothly
    pill.addEventListener('wheel', (e) => {
      e.preventDefault();
      const currentRatio = getValueRatio();
      const step = e.deltaY < 0 ? 0.04 : -0.04;
      const newRatio = Math.max(0, Math.min(1, currentRatio + step));
      onValueChange(newRatio);
    }, { passive: false });
  }

  setupVerticalSlider(
    trackContainerSize,
    pillSize,
    thumbSize,
    (ratio) => {
      const newWidth = Math.round(1 + ratio * 199);
      updateStrokeWidth(newWidth);
    },
    () => (currentStrokeWidth - 1) / 199
  );

  setupVerticalSlider(
    trackContainerOpacity,
    pillOpacity,
    thumbOpacity,
    (ratio) => {
      const newOpacity = Math.round((0.05 + ratio * 0.95) * 100) / 100;
      updateStrokeOpacity(newOpacity);
    },
    () => (currentOpacity - 0.05) / 0.95
  );

  syncQuickSliders();

  // --- Rotate & Flip Controls ---
  function rotateSelected(degrees) {
    const nodes = transformer.nodes();
    if (nodes.length === 0) return;
    nodes.forEach((node) => {
      node.rotation((node.rotation() + degrees + 360) % 360);
    });
    transformer.forceUpdate();
    uiLayer.batchDraw();
    stage.batchDraw();
    saveHistory();
  }

  function flipSelected(horizontal) {
    const nodes = transformer.nodes();
    if (nodes.length === 0) return;
    nodes.forEach((node) => {
      if (horizontal) {
        node.scaleX(node.scaleX() * -1);
      } else {
        node.scaleY(node.scaleY() * -1);
      }
    });
    transformer.forceUpdate();
    uiLayer.batchDraw();
    stage.batchDraw();
    saveHistory();
  }

  if (btnRotateRight) btnRotateRight.addEventListener('click', () => rotateSelected(90));
  if (btnRotateLeft) btnRotateLeft.addEventListener('click', () => rotateSelected(-90));
  if (btnFlipH) btnFlipH.addEventListener('click', () => flipSelected(true));
  if (btnFlipV) btnFlipV.addEventListener('click', () => flipSelected(false));

  function paintColorFor(mode) {
    if (mode === 'color1') return color1;
    if (mode === 'color2') return color2;
    return undefined;
  }

  function shapeStyle() {
    return {
      stroke: paintColorFor(shapeOutlineInput.value),
      strokeWidth: currentStrokeWidth,
      opacity: currentOpacity,
      fill: paintColorFor(shapeFillInput.value),
      lineJoin: 'round',
      lineCap: 'round',
      name: 'shape',
    };
  }

  function regularPolygonPoints(cx, cy, rx, ry, sides, rotation = -Math.PI / 2) {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = rotation + (i * Math.PI * 2) / sides;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    return points;
  }

  function starPoints(cx, cy, rx, ry, tips) {
    const points = [];
    for (let i = 0; i < tips * 2; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / tips;
      const scale = i % 2 === 0 ? 1 : 0.45;
      points.push(cx + Math.cos(angle) * rx * scale, cy + Math.sin(angle) * ry * scale);
    }
    return points;
  }

  function shapePoints(tool, x, y, width, height) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const arrow = [x, y + height * .28, x + width * .55, y + height * .28, x + width * .55, y, x + width, cy, x + width * .55, y + height, x + width * .55, y + height * .72, x, y + height * .72];
    switch (tool) {
      case 'triangle': return [cx, y, x, y + height, x + width, y + height];
      case 'right-triangle': return [x, y, x, y + height, x + width, y + height];
      case 'diamond': return [cx, y, x + width, cy, cx, y + height, x, cy];
      case 'pentagon': return regularPolygonPoints(cx, cy, width / 2, height / 2, 5);
      case 'hexagon': return regularPolygonPoints(cx, cy, width / 2, height / 2, 6, 0);
      case 'polygon': return regularPolygonPoints(cx, cy, width / 2, height / 2, 6);
      case 'arrow': return arrow;
      case 'left-arrow': return arrow.map((value, index) => index % 2 === 0 ? x + width - (value - x) : value);
      case 'up-arrow': return [x + width * .28, y + height, x + width * .28, y + height * .55, x, y + height * .55, cx, y, x + width, y + height * .55, x + width * .72, y + height * .55, x + width * .72, y + height];
      case 'down-arrow': return [x + width * .28, y, x + width * .28, y + height * .45, x, y + height * .45, cx, y + height, x + width, y + height * .45, x + width * .72, y + height * .45, x + width * .72, y];
      case 'four-star': return starPoints(cx, cy, width / 2, height / 2, 4);
      case 'star': return starPoints(cx, cy, width / 2, height / 2, 5);
      case 'six-star': return starPoints(cx, cy, width / 2, height / 2, 6);
      case 'callout': return [x, y, x + width, y, x + width, y + height * .75, x + width * .55, y + height * .75, x + width * .38, y + height, x + width * .38, y + height * .75, x, y + height * .75];
      case 'speech': return [x + width * .12, y, x + width * .88, y, x + width, y + height * .16, x + width, y + height * .65, x + width * .88, y + height * .78, x + width * .5, y + height * .78, x + width * .32, y + height, x + width * .32, y + height * .78, x + width * .12, y + height * .78, x, y + height * .65, x, y + height * .16];
      case 'cloud': return [x + width * .15, y + height * .75, x, y + height * .58, x + width * .12, y + height * .36, x + width * .28, y + height * .4, x + width * .38, y + height * .12, x + width * .62, y, x + width * .78, y + height * .3, x + width, y + height * .42, x + width * .9, y + height * .75];
      default: return [];
    }
  }

  function getCanvasPointerPosition() {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  }

  function pickCanvasColor(pos) {
    const oldScale = stage.scaleX();
    const oldPos = stage.position();
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });

    const canvas = stage.toCanvas({
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      pixelRatio: 1
    });

    stage.scale({ x: oldScale, y: oldScale });
    stage.position(oldPos);

    const context = canvas.getContext('2d');
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    updateColor(`#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`);
  }

  // --- Helper: Flood Fill Algorithm ---
  function hexToRgba(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return [r, g, b, 255];
  }

  function doFloodFill(startX, startY, colorHex) {
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer) return;

    uiLayer.visible(false);

    const oldScale = stage.scaleX();
    const oldPos = stage.position();
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });

    const canvas = stage.toCanvas({
      x: artboard.x,
      y: artboard.y,
      width: artboard.width,
      height: artboard.height,
      pixelRatio: 1
    });

    stage.scale({ x: oldScale, y: oldScale });
    stage.position(oldPos);

    uiLayer.visible(true);

    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = new Uint32Array(imgData.data.buffer);

    const width = canvas.width;
    const height = canvas.height;

    const fillLocalX = Math.floor(startX - artboard.x);
    const fillLocalY = Math.floor(startY - artboard.y);

    if (fillLocalX < 0 || fillLocalX >= width || fillLocalY < 0 || fillLocalY >= height) return;

    const startPos = fillLocalY * width + fillLocalX;
    const targetColor = data[startPos];

    const fillRgba = hexToRgba(colorHex);
    const fillColor32 = ((255 << 24) | (fillRgba[2] << 16) | (fillRgba[1] << 8) | fillRgba[0]) >>> 0;

    if (targetColor === fillColor32) return;

    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    const newCtx = newCanvas.getContext('2d');
    const newImgData = newCtx.createImageData(width, height);
    const newData = new Uint32Array(newImgData.data.buffer);

    const stack = [[fillLocalX, fillLocalY]];

    while (stack.length) {
      let [x, y] = stack.pop();
      let idx = y * width + x;

      while (y >= 0 && data[idx] === targetColor) {
        y--;
        idx -= width;
      }
      y++;
      idx += width;

      let reachLeft = false;
      let reachRight = false;

      while (y < height && data[idx] === targetColor) {
        data[idx] = fillColor32;
        newData[idx] = fillColor32;

        if (x > 0) {
          if (data[idx - 1] === targetColor) {
            if (!reachLeft) {
              stack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < width - 1) {
          if (data[idx + 1] === targetColor) {
            if (!reachRight) {
              stack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }
        y++;
        idx += width;
      }
    }

    newCtx.putImageData(newImgData, 0, 0);
    const image = new window.Image();
    image.src = newCanvas.toDataURL();
    image.onload = () => {
      const konvaImg = new Konva.Image({
        x: artboard.x,
        y: artboard.y,
        image: image,
        name: 'shape',
      });
      activeLayer.add(konvaImg);
      konvaImg.moveToBottom();
      attachShapeEvents(konvaImg);
      activeLayer.batchDraw();
      saveHistory();
    };
  }

  // --- Text Inline Editor ---
  function openTextEditor(x, y, clientX, clientY, initialText = '', existingNode = null) {
    if (activeTextarea) {
      activeTextarea.blur();
    }

    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.top = `${clientY}px`;
    textarea.style.left = `${clientX}px`;
    textarea.style.color = color1;
    textarea.style.fontSize = `${Math.max(14, currentStrokeWidth * 4)}px`;
    textarea.style.fontFamily = 'Segoe UI, Tahoma, sans-serif';
    textarea.style.fontWeight = '500';
    textarea.style.background = '#ffffff';
    textarea.style.border = '1px dashed #0078d4';
    textarea.style.borderRadius = '3px';
    textarea.style.padding = '4px 8px';
    textarea.style.outline = 'none';
    textarea.style.resize = 'both';
    textarea.style.minWidth = '140px';
    textarea.style.minHeight = '36px';
    textarea.style.zIndex = '10000';
    textarea.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    textarea.value = initialText;

    document.body.appendChild(textarea);
    activeTextarea = textarea;

    setTimeout(() => {
      textarea.focus();
      if (initialText) textarea.select();
    }, 20);

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const textVal = textarea.value.trim();
      const activeLayer = layerManager.getActiveLayer();

      if (textVal.length > 0) {
        let targetNode = existingNode;
        if (existingNode) {
          existingNode.text(textarea.value);
          existingNode.fontSize(Math.max(14, currentStrokeWidth * 4));
          existingNode.fill(color1);
        } else if (activeLayer) {
          const textNode = new Konva.Text({
            x: x,
            y: y,
            text: textarea.value,
            fontSize: Math.max(14, currentStrokeWidth * 4),
            fontFamily: 'Segoe UI, Tahoma, sans-serif',
            fontStyle: '500',
            fill: color1,
            name: 'shape',
            draggable: true,
          });
          activeLayer.add(textNode);
          attachShapeEvents(textNode);
          targetNode = textNode;
        }

        if (targetNode) {
          setTool('select-rect');
          targetNode.draggable(true);
          transformer.nodes([targetNode]);
          const lyr = targetNode.getLayer() || activeLayer;
          if (lyr) lyr.batchDraw();
          uiLayer.batchDraw();
          updateActionButtons();
          saveHistory();
        }
      } else if (existingNode) {
        const lyr = existingNode.getLayer();
        existingNode.destroy();
        if (lyr) lyr.batchDraw();
        saveHistory();
      }

      textarea.remove();
      if (activeTextarea === textarea) activeTextarea = null;
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        commit();
      }
    });

    textarea.addEventListener('blur', commit);
  }

  function reEditTextNode(textNode) {
    const stageBox = stageContainer.getBoundingClientRect();
    const clientX = stageBox.left + textNode.x() * zoomLevel;
    const clientY = stageBox.top + textNode.y() * zoomLevel;
    openTextEditor(textNode.x(), textNode.y(), clientX, clientY, textNode.text(), textNode);
  }

  // --- Stage Pointer Events ---
  stage.on('pointerdown', (e) => {
    const pos = getCanvasPointerPosition();
    if (!pos) return;

    if (activeTextarea) {
      activeTextarea.blur();
      return;
    }

    // Handle Selection Tools (select-rect & select-lasso)
    if (currentTool === 'select-rect' || currentTool === 'select-lasso') {
      rasterSelection.handlePointerDown(e, pos);
      return;
    }

    const activeModel = layerManager.getActiveLayerModel();
    if (!activeModel || !activeModel.visible || activeModel.locked) {
      statusMode.textContent = activeModel?.locked ? 'Active layer is locked' : 'Active layer is hidden';
      return;
    }

    const activeLayer = activeModel.konvaLayer;
    isDrawing = true;
    startPos = { x: pos.x, y: pos.y };
    currentShape = null;

    if (geometricTools.has(currentTool)) {
      const style = shapeStyle();
      if (currentTool === 'rectangle' || currentTool === 'rounded-rectangle') {
        currentShape = new Konva.Rect({ x: pos.x, y: pos.y, width: 0, height: 0, cornerRadius: currentTool === 'rounded-rectangle' ? 12 : 0, ...style });
      } else if (currentTool === 'ellipse') {
        currentShape = new Konva.Ellipse({ x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, ...style });
      } else if (currentTool === 'line') {
        currentShape = new Konva.Line({ points: [pos.x, pos.y, pos.x, pos.y], ...style });
      } else if (currentTool === 'curve') {
        currentShape = new Konva.Line({ points: [pos.x, pos.y, pos.x, pos.y], tension: 0.5, ...style });
      } else {
        currentShape = new Konva.Line({ points: [pos.x, pos.y], closed: true, ...style });
      }
    } else switch (currentTool) {
      case 'pen': {
        currentShape = new Konva.Line({
          stroke: color1,
          strokeWidth: currentStrokeWidth,
          opacity: currentOpacity,
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.35,
          points: [pos.x, pos.y, pos.x, pos.y],
          name: 'shape',
        });
        break;
      }
      case 'eraser': {
        currentShape = new Konva.Line({
          stroke: '#000000',
          strokeWidth: currentStrokeWidth,
          opacity: currentOpacity,
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.35,
          points: [pos.x, pos.y, pos.x, pos.y],
          globalCompositeOperation: 'destination-out',
          name: 'shape',
        });
        break;
      }
      case 'text': {
        isDrawing = false;
        openTextEditor(pos.x, pos.y, e.evt.clientX, e.evt.clientY);
        break;
      }
      case 'math-text': {
        isDrawing = false;
        const stageBox = stageContainer.getBoundingClientRect();
        const clientX = e.evt.clientX;
        const clientY = e.evt.clientY;
        openMathTextEditor({
          x: pos.x,
          y: pos.y,
          clientX,
          clientY,
          initialLatex: '',
          initialFontSize: Math.max(16, currentStrokeWidth * 6),
          initialColor: color1,
          onCommit: async (data) => {
            const node = await createMathTextImageNode({
              x: data.x,
              y: data.y,
              latexSource: data.latexSource,
              baseFontSize: data.baseFontSize,
              textColor: data.textColor,
            }, Konva);
            const targetLyr = layerManager.getActiveLayer();
            if (targetLyr) {
              targetLyr.add(node);
              attachShapeEvents(node);
              setTool('select-rect');
              node.draggable(true);
              transformer.nodes([node]);
              targetLyr.batchDraw();
              uiLayer.batchDraw();
              updateActionButtons();
              saveHistory();
            }
          },
        });
        break;
      }
      case 'fill': {
        isDrawing = false;
        doFloodFill(pos.x, pos.y, color1);
        break;
      }
      case 'picker': {
        isDrawing = false;
        pickCanvasColor(pos);
        break;
      }
      case 'magnifier': {
        isDrawing = false;
        if (e.evt && (e.evt.button === 2 || e.evt.shiftKey)) {
          zoomOut();
        } else {
          zoomIn();
        }
        statusMode.textContent = `Magnifier (Left-click zoom in, Right-click zoom out — ${Math.round(zoomLevel * 100)}%)`;
        break;
      }
    }

    if (currentShape && activeLayer) {
      activeLayer.add(currentShape);
      activeLayer.batchDraw();
    }
  });

  stage.on('pointermove', (e) => {
    const pos = getCanvasPointerPosition();
    if (!pos) return;

    if (statusCoords) {
      const relX = Math.round(pos.x - artboard.x);
      const relY = Math.round(pos.y - artboard.y);
      statusCoords.textContent = `${relX}, ${relY}px`;
    }

    if (brushCursor && (currentTool === 'pen' || currentTool === 'eraser')) {
      if (e.evt) {
        brushCursor.style.left = `${e.evt.pageX}px`;
        brushCursor.style.top = `${e.evt.pageY}px`;
      }
    }

    // Handle Raster Selection Tools
    if (currentTool === 'select-rect' || currentTool === 'select-lasso') {
      if (rasterSelection.handlePointerMove(pos)) {
        return;
      }
    }

    if (!isDrawing || !currentShape) return;

    const x1 = startPos.x;
    const y1 = startPos.y;
    const w = pos.x - startPos.x;
    const h = pos.y - startPos.y;
    const isShift = e && e.evt && e.evt.shiftKey;

    if (geometricTools.has(currentTool)) {
      if (currentTool === 'rectangle' || currentTool === 'rounded-rectangle') {
        let curW = Math.abs(w);
        let curH = Math.abs(h);
        if (isShift) {
          const side = Math.max(curW, curH);
          curW = side;
          curH = side;
          const posX = pos.x >= startPos.x ? startPos.x : startPos.x - side;
          const posY = pos.y >= startPos.y ? startPos.y : startPos.y - side;
          currentShape.position({ x: posX, y: posY });
        } else {
          currentShape.position({ x: Math.min(x1, pos.x), y: Math.min(y1, pos.y) });
        }
        currentShape.size({ width: curW, height: curH });
      } else if (currentTool === 'ellipse') {
        let curRx = Math.abs(w) / 2;
        let curRy = Math.abs(h) / 2;
        if (isShift) {
          const r = Math.max(curRx, curRy);
          curRx = r;
          curRy = r;
          const posX = pos.x >= startPos.x ? startPos.x + r : startPos.x - r;
          const posY = pos.y >= startPos.y ? startPos.y + r : startPos.y - r;
          currentShape.position({ x: posX, y: posY });
        } else {
          currentShape.position({ x: x1 + w / 2, y: y1 + h / 2 });
        }
        currentShape.radius({ x: curRx, y: curRy });
      } else if (currentTool === 'line') {
        let endX = pos.x;
        let endY = pos.y;
        if (isShift) {
          const dx = pos.x - startPos.x;
          const dy = pos.y - startPos.y;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          if (absX > 2 * absY) {
            endY = startPos.y; // Horizontal
          } else if (absY > 2 * absX) {
            endX = startPos.x; // Vertical
          } else {
            const dist = Math.max(absX, absY); // 45 degree diagonal
            endX = startPos.x + Math.sign(dx) * dist;
            endY = startPos.y + Math.sign(dy) * dist;
          }
        }
        currentShape.points([startPos.x, startPos.y, endX, endY]);
      } else if (currentTool === 'curve') {
        currentShape.points([startPos.x, startPos.y, startPos.x + (pos.x - startPos.x) * .5, startPos.y, pos.x, pos.y]);
      } else {
        currentShape.points(shapePoints(currentTool, Math.min(x1, pos.x), Math.min(y1, pos.y), Math.abs(w), Math.abs(h)));
      }
    } else if (['pen', 'eraser'].includes(currentTool)) {
      if (isShift) {
        // Holding Shift with Pencil/Eraser: draws a straight line!
        // Snap to horizontal, vertical, or 45-degree angle
        const dx = pos.x - startPos.x;
        const dy = pos.y - startPos.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        let endX = pos.x;
        let endY = pos.y;

        if (absX > 2 * absY) {
          endY = startPos.y; // Snap horizontal
        } else if (absY > 2 * absX) {
          endX = startPos.x; // Snap vertical
        } else {
          const dist = Math.max(absX, absY); // Snap 45 degree diagonal
          endX = startPos.x + Math.sign(dx) * dist;
          endY = startPos.y + Math.sign(dy) * dist;
        }
        currentShape.points([startPos.x, startPos.y, endX, endY]);
      } else {
        currentShape.points(currentShape.points().concat([pos.x, pos.y]));
      }
    }

    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) activeLayer.batchDraw();
  });

  stage.on('pointerup', () => {
    // Handle Raster Selection Tools
    if (currentTool === 'select-rect' || currentTool === 'select-lasso') {
      if (rasterSelection.handlePointerUp()) {
        return;
      }
    }

    if (isDrawing && currentShape) {
      const activeLayer = layerManager.getActiveLayer();
      let shouldKeep = true;
      if (geometricTools.has(currentTool) && currentTool !== 'line' && currentTool !== 'curve' && currentTool !== 'ellipse') {
        const bbox = currentShape.getClientRect();
        if (bbox.width < 3 && bbox.height < 3) shouldKeep = false;
      } else if (currentTool === 'ellipse') {
        if (currentShape.radiusX() < 2 && currentShape.radiusY() < 2) shouldKeep = false;
      } else if (currentTool === 'line') {
        const pts = currentShape.points();
        if (Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) < 3) shouldKeep = false;
      }

      if (shouldKeep) {
        attachShapeEvents(currentShape);
        saveHistory();

        // Auto-select geometric shapes after drawing
        if (geometricTools.has(currentTool)) {
          const newShape = currentShape;
          setTimeout(() => {
            setTool('select-rect');
            newShape.draggable(true);
            transformer.nodes([newShape]);
            uiLayer.batchDraw();
            updateActionButtons();
          }, 0);
        }
      } else {
        currentShape.destroy();
        if (activeLayer) activeLayer.batchDraw();
      }
      currentShape = null;
    }
    isDrawing = false;
  });


  stageContainer.addEventListener('pointerenter', () => {
    isPointerInStage = true;
    if (brushCursor && (currentTool === 'pen' || currentTool === 'eraser')) {
      brushCursor.classList.remove('hidden');
    }
  });

  stageContainer.addEventListener('pointerleave', () => {
    isPointerInStage = false;
    if (brushCursor) {
      brushCursor.classList.add('hidden');
    }
  });

  // --- Toolbar Actions ---
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);

  btnDelete.addEventListener('click', () => {
    if (rasterSelection.hasActiveSelection()) {
      rasterSelection.deleteSelection();
      return;
    }

    const selectedNodes = transformer.nodes();
    if (selectedNodes.length > 0) {
      selectedNodes.forEach((n) => {
        const lyr = n.getLayer();
        n.destroy();
        if (lyr) lyr.batchDraw();
      });
      transformer.nodes([]);
      uiLayer.batchDraw();
      stage.batchDraw();
      updateActionButtons();
      saveHistory();
    }
  });

  btnClear.addEventListener('click', () => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer && activeLayer.getChildren().length > 0 && confirm('Clear active layer?')) {
      rasterSelection.commitSelection(true);
      transformer.nodes([]);
      uiLayer.batchDraw();
      activeLayer.destroyChildren();
      activeLayer.batchDraw();
      updateActionButtons();
      saveHistory();
    }
  });

  // --- Shape Clipboard (Vector & Parametric Copy/Paste) ---
  let shapeClipboard = null;
  let shapePasteCount = 0;
  let lastClipboardType = null;

  function copySelectedShapes() {
    const nodes = transformer.nodes();
    if (!nodes || nodes.length === 0) return false;

    shapeClipboard = nodes.map((node) => ({
      clone: node.clone(),
      origX: node.x(),
      origY: node.y(),
    }));
    shapePasteCount = 0;
    lastClipboardType = 'shape';
    return true;
  }

  function cutSelectedShapes() {
    if (copySelectedShapes()) {
      btnDelete.click();
      return true;
    }
    return false;
  }

  function pasteSelectedShapes() {
    if (!shapeClipboard || shapeClipboard.length === 0) return false;

    const activeModel = layerManager.getActiveLayerModel();
    if (!activeModel || !activeModel.visible || activeModel.locked) return false;
    const activeLayer = activeModel.konvaLayer;

    // Deselect current transformer nodes
    transformer.nodes().forEach((n) => n.draggable(false));
    transformer.nodes([]);

    shapePasteCount++;
    const offset = shapePasteCount * 20;

    const newNodes = [];
    shapeClipboard.forEach((item) => {
      const newNode = item.clone.clone();
      newNode.position({
        x: item.origX + offset,
        y: item.origY + offset,
      });
      newNode.draggable(true);
      activeLayer.add(newNode);
      attachShapeEvents(newNode);
      newNodes.push(newNode);
    });

    transformer.nodes(newNodes);
    activeLayer.batchDraw();
    uiLayer.batchDraw();
    updateActionButtons();
    saveHistory();
    return true;
  }

  async function exportCanvas() {
    const prev = transformer.nodes();
    transformer.nodes([]);
    syncAngleHandles();
    uiLayer.visible(false);

    // Composite all visible layers clipped to the artboard at 2x resolution
    const dataURL = stage.toDataURL({
      x: artboard.x,
      y: artboard.y,
      width: artboard.width,
      height: artboard.height,
      pixelRatio: 2,
    });

    uiLayer.visible(true);
    if (prev.length) transformer.nodes(prev);
    uiLayer.batchDraw();

    const fileName = `rempaint-${Date.now()}.png`;

    // 1. Try Tauri v2 environment
    const tauri = window.__TAURI__;
    if (tauri) {
      try {
        let savePath = null;
        if (tauri.dialog && typeof tauri.dialog.save === 'function') {
          savePath = await tauri.dialog.save({
            filters: [{ name: 'PNG Image (*.png)', extensions: ['png'] }],
            defaultPath: fileName,
          });
        } else if (tauri.core && typeof tauri.core.invoke === 'function') {
          savePath = await tauri.core.invoke('save_file_dialog', {
            defaultName: fileName,
            filterName: 'PNG Image',
            extensions: ['png'],
          }).catch(() => null);
        }

        if (savePath) {
          if (tauri.core && typeof tauri.core.invoke === 'function') {
            await tauri.core.invoke('save_base64_file', {
              path: savePath,
              base64_data: dataURL,
            });
            return true;
          }
        }
      } catch (err) {
        console.warn('Tauri export failed, using fallback:', err);
      }
    }

    // 2. Try Modern File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PNG Image (*.png)',
            accept: { 'image/png': ['.png'] },
          }],
        });
        const res = await fetch(dataURL);
        const blob = await res.blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.warn('File System Access API export failed:', err);
      }
    }

    // 3. Universal Web Download Fallback
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataURL;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 300);
    return true;
  }

  btnExport.addEventListener('click', () => exportCanvas());
  if (btnSave) btnSave.addEventListener('click', () => projectManager.saveProject(false));

  function insertImage(dataUrl) {
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer) return;

    const image = new window.Image();
    image.onload = () => {
      const maxWidth = Math.max(120, artboard.width * 0.8);
      const maxHeight = Math.max(120, artboard.height * 0.8);
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const node = new Konva.Image({
        image,
        x: artboard.x + (artboard.width - image.width * scale) / 2,
        y: artboard.y + (artboard.height - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
        name: 'shape',
        draggable: true,
      });
      activeLayer.add(node);
      attachShapeEvents(node);
      setTool('select-rect');
      transformer.nodes([node]);
      activeLayer.batchDraw();
      uiLayer.batchDraw();
      updateActionButtons();
      saveHistory();
    };
    image.src = dataUrl;
  }

  if (btnOpenImage && imageFileInput) {
    btnOpenImage.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', () => {
      const [file] = imageFileInput.files;
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => insertImage(reader.result);
      reader.readAsDataURL(file);
      imageFileInput.value = '';
    });
  }

  // --- Number Line Modal Logic ---
  btnNewNumberLine.addEventListener('click', () => openNumberLineModal());

  function openNumberLineModal(groupToEdit = null) {
    editingNumberLineGroup = groupToEdit;
    nlHighlightsList.innerHTML = '';

    if (groupToEdit) {
      modalNlTitle.textContent = 'Edit Number Line';
      btnModalNlSubmitText.textContent = 'Update';
      const cfg = groupToEdit.getAttr('shapeConfig');
      nlStartInput.value = cfg.start;
      nlEndInput.value = cfg.end;
      nlStepInput.value = cfg.step;
      nlSpacingInput.value = cfg.spacing;
      nlLabelIntervalInput.value = cfg.labelInterval;
      nlLineColorInput.value = cfg.lineColor;
      nlLineColorHex.textContent = cfg.lineColor;
      nlLabelColorInput.value = cfg.labelColor;
      nlLabelColorHex.textContent = cfg.labelColor;

      cfg.highlights.forEach((hl) => {
        nlHighlightsList.appendChild(createHighlightRow(hl.value, hl.label, hl.color));
      });
    } else {
      modalNlTitle.textContent = 'Configure Number Line';
      btnModalNlSubmitText.textContent = 'Insert';
      nlStartInput.value = 0;
      nlEndInput.value = 10;
      nlStepInput.value = 1;
      nlSpacingInput.value = 50;
      nlLabelIntervalInput.value = 1;
      nlLineColorInput.value = color1;
      nlLineColorHex.textContent = color1;
      nlLabelColorInput.value = color1;
      nlLabelColorHex.textContent = color1;
    }

    modalBackdrop.classList.remove('hidden');
  }

  let previousStartValue = 0;
  nlStartInput.addEventListener('focus', () => {
    previousStartValue = parseFloat(nlStartInput.value) || 0;
  });
  nlStartInput.addEventListener('change', () => {
    const currentStart = parseFloat(nlStartInput.value) || 0;
    const currentEnd = parseFloat(nlEndInput.value) || 0;
    const diff = currentStart - previousStartValue;
    nlEndInput.value = currentEnd + diff;
    previousStartValue = currentStart;
  });

  function closeModal() {
    modalBackdrop.classList.add('hidden');
    editingNumberLineGroup = null;
  }

  btnModalNlClose.addEventListener('click', closeModal);
  btnModalNlCancel.addEventListener('click', closeModal);

  btnAddHighlight.addEventListener('click', () => {
    const val = parseFloat(((parseFloat(nlStartInput.value) + parseFloat(nlEndInput.value)) / 2).toFixed(2));
    nlHighlightsList.appendChild(createHighlightRow(val, '', '#e81123'));
  });

  function createHighlightRow(value, label, color) {
    const row = document.createElement('div');
    row.className = 'highlight-row';
    row.innerHTML = `<input type="number" step="any" placeholder="Val" class="nl-hl-val" value="${value}" required /><input type="text" placeholder="Label" class="nl-hl-label" value="${label}" /><input type="color" class="nl-hl-color" value="${color}" /><button type="button" class="btn-remove-row">✕</button>`;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    return row;
  }

  formNumberLine.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeLayer = layerManager.getActiveLayer();
    if (!activeLayer) return;

    const highlights = [];
    nlHighlightsList.querySelectorAll('.highlight-row').forEach((row) => {
      highlights.push({
        value: parseFloat(row.querySelector('.nl-hl-val').value),
        label: row.querySelector('.nl-hl-label').value,
        color: row.querySelector('.nl-hl-color').value,
      });
    });

    const config = {
      start: parseFloat(nlStartInput.value),
      end: parseFloat(nlEndInput.value),
      step: parseFloat(nlStepInput.value),
      spacing: parseFloat(nlSpacingInput.value),
      labelInterval: parseInt(nlLabelIntervalInput.value, 10),
      lineColor: nlLineColorInput.value,
      labelColor: nlLabelColorInput.value,
      strokeWidth: currentStrokeWidth,
      highlights,
    };

    if (editingNumberLineGroup) {
      renderNumberLine(editingNumberLineGroup, config, Konva);
      transformer.nodes([editingNumberLineGroup]);
      const lyr = editingNumberLineGroup.getLayer() || activeLayer;
      if (lyr) lyr.batchDraw();
    } else {
      const group = createNumberLineGroup(config, Konva);
      group.position({
        x: artboard.x + artboard.width / 2,
        y: artboard.y + artboard.height / 2,
      });
      group.name('shape');
      group.draggable(true);
      attachShapeEvents(group);
      activeLayer.add(group);
      setTool('select-rect');
      transformer.nodes([group]);
      activeLayer.batchDraw();
    }

    uiLayer.batchDraw();
    saveHistory();
    closeModal();
  });

  // --- Fixed Circle Modal Logic ---
  const btnNewFixedCircle = document.getElementById('btn-new-fixed-circle');
  const modalFixedCircle = document.getElementById('modal-fixed-circle');
  const formFixedCircle = document.getElementById('form-fixed-circle');
  const btnModalFcClose = document.getElementById('btn-modal-fc-close');
  const btnModalFcCancel = document.getElementById('btn-modal-fc-cancel');
  const modalFcTitle = document.getElementById('modal-fc-title');
  const btnModalFcSubmit = document.getElementById('btn-modal-fc-submit');
  const fcRadiusInput = document.getElementById('fc-radius');
  const fcCustomLabelInput = document.getElementById('fc-custom-label');
  const fcStrokeWidthInput = document.getElementById('fc-stroke-width');
  const fcStrokeColorInput = document.getElementById('fc-stroke-color');
  const fcStrokeColorHex = document.getElementById('fc-stroke-color-hex');
  const fcFillColorInput = document.getElementById('fc-fill-color');
  const fcFillColorHex = document.getElementById('fc-fill-color-hex');
  const fcTransparentFill = document.getElementById('fc-transparent-fill');
  const fcShowCenter = document.getElementById('fc-show-center');
  const fcShowRadiusLine = document.getElementById('fc-show-radius-line');
  const fcShowLabel = document.getElementById('fc-show-label');
  let editingFixedCircleGroup = null;

  function openFixedCircleModal(groupToEdit = null) {
    editingFixedCircleGroup = groupToEdit;
    if (groupToEdit) {
      if (modalFcTitle) modalFcTitle.textContent = 'Edit Fixed Circle';
      if (btnModalFcSubmit) btnModalFcSubmit.textContent = 'Update Circle';
      const cfg = groupToEdit.getAttr('shapeConfig') || {};
      if (fcRadiusInput) fcRadiusInput.value = cfg.radius || 80;
      if (fcCustomLabelInput) fcCustomLabelInput.value = cfg.customLabel !== undefined ? cfg.customLabel : '';
      if (fcStrokeWidthInput) fcStrokeWidthInput.value = cfg.strokeWidth || 2;
      if (fcStrokeColorInput) {
        fcStrokeColorInput.value = cfg.stroke || '#0078d4';
        if (fcStrokeColorHex) fcStrokeColorHex.textContent = cfg.stroke || '#0078d4';
      }
      const isTransparent = !cfg.fill || cfg.fill === 'transparent' || cfg.fill === 'none';
      if (fcTransparentFill) fcTransparentFill.checked = isTransparent;
      if (fcFillColorInput) {
        fcFillColorInput.value = isTransparent ? '#ffffff' : cfg.fill;
        if (fcFillColorHex) fcFillColorHex.textContent = isTransparent ? 'Transparent' : cfg.fill;
      }
      if (fcShowCenter) fcShowCenter.checked = cfg.showCenter !== false;
      if (fcShowRadiusLine) fcShowRadiusLine.checked = cfg.showRadiusLine !== false;
      if (fcShowLabel) fcShowLabel.checked = cfg.showLabel !== false;
    } else {
      if (modalFcTitle) modalFcTitle.textContent = 'Circle with Fixed Radius';
      if (btnModalFcSubmit) btnModalFcSubmit.textContent = 'Insert Circle';
      if (fcRadiusInput) fcRadiusInput.value = 80;
      if (fcCustomLabelInput) fcCustomLabelInput.value = '';
      if (fcStrokeWidthInput) fcStrokeWidthInput.value = currentStrokeWidth || 2;
      if (fcStrokeColorInput) {
        fcStrokeColorInput.value = color1 || '#0078d4';
        if (fcStrokeColorHex) fcStrokeColorHex.textContent = color1 || '#0078d4';
      }
      if (fcTransparentFill) fcTransparentFill.checked = true;
      if (fcFillColorInput) {
        fcFillColorInput.value = color2 || '#ffffff';
        if (fcFillColorHex) fcFillColorHex.textContent = 'Transparent';
      }
      if (fcShowCenter) fcShowCenter.checked = true;
      if (fcShowRadiusLine) fcShowRadiusLine.checked = true;
      if (fcShowLabel) fcShowLabel.checked = true;
    }
    if (modalFixedCircle) modalFixedCircle.classList.remove('hidden');
  }

  function closeFixedCircleModal() {
    if (modalFixedCircle) modalFixedCircle.classList.add('hidden');
    editingFixedCircleGroup = null;
  }

  if (btnNewFixedCircle) btnNewFixedCircle.addEventListener('click', () => openFixedCircleModal());
  if (btnModalFcClose) btnModalFcClose.addEventListener('click', closeFixedCircleModal);
  if (btnModalFcCancel) btnModalFcCancel.addEventListener('click', closeFixedCircleModal);

  if (fcStrokeColorInput) {
    fcStrokeColorInput.addEventListener('input', (e) => {
      if (fcStrokeColorHex) fcStrokeColorHex.textContent = e.target.value;
    });
  }

  if (fcFillColorInput) {
    fcFillColorInput.addEventListener('input', (e) => {
      if (fcTransparentFill) fcTransparentFill.checked = false;
      if (fcFillColorHex) fcFillColorHex.textContent = e.target.value;
    });
  }

  if (fcTransparentFill) {
    fcTransparentFill.addEventListener('change', (e) => {
      if (fcFillColorHex) fcFillColorHex.textContent = e.target.checked ? 'Transparent' : fcFillColorInput.value;
    });
  }

  if (formFixedCircle) {
    formFixedCircle.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeLayer = layerManager.getActiveLayer();
      if (!activeLayer) return;

      const config = {
        radius: parseFloat(fcRadiusInput.value) || 80,
        customLabel: fcCustomLabelInput ? fcCustomLabelInput.value : '',
        strokeWidth: parseFloat(fcStrokeWidthInput.value) || 2,
        stroke: fcStrokeColorInput.value,
        fill: fcTransparentFill.checked ? 'transparent' : fcFillColorInput.value,
        showCenter: fcShowCenter.checked,
        showRadiusLine: fcShowRadiusLine.checked,
        showLabel: fcShowLabel.checked,
      };

      if (editingFixedCircleGroup) {
        const parent = editingFixedCircleGroup.parent || activeLayer;
        const x = editingFixedCircleGroup.x();
        const y = editingFixedCircleGroup.y();
        const scaleX = editingFixedCircleGroup.scaleX();
        const scaleY = editingFixedCircleGroup.scaleY();
        const rotation = editingFixedCircleGroup.rotation();
        editingFixedCircleGroup.destroy();

        const updatedGroup = createFixedCircleGroup(config, Konva);
        updatedGroup.position({ x, y });
        updatedGroup.scaleX(scaleX);
        updatedGroup.scaleY(scaleY);
        updatedGroup.rotation(rotation);
        updatedGroup.name('shape');
        updatedGroup.draggable(true);
        attachShapeEvents(updatedGroup);
        parent.add(updatedGroup);
        transformer.nodes([updatedGroup]);
        parent.batchDraw();
      } else {
        const group = createFixedCircleGroup(config, Konva);
        group.position({
          x: artboard.x + artboard.width / 2,
          y: artboard.y + artboard.height / 2,
        });
        group.name('shape');
        group.draggable(true);
        attachShapeEvents(group);
        activeLayer.add(group);
        setTool('select-rect');
        transformer.nodes([group]);
        activeLayer.batchDraw();
      }

      uiLayer.batchDraw();
      saveHistory();
      closeFixedCircleModal();
    });
  }

  // --- Angle Maker Modal Logic ---
  const btnNewAngle = document.getElementById('btn-new-angle');
  const modalAngle = document.getElementById('modal-angle');
  const formAngle = document.getElementById('form-angle');
  const btnModalAngClose = document.getElementById('btn-modal-ang-close');
  const btnModalAngCancel = document.getElementById('btn-modal-ang-cancel');
  const modalAngTitle = document.getElementById('modal-ang-title');
  const btnModalAngSubmit = document.getElementById('btn-modal-ang-submit');
  const angDegreesInput = document.getElementById('ang-degrees');
  const angLabelInput = document.getElementById('ang-label');
  const angRayLengthInput = document.getElementById('ang-ray-length');
  const angArcRadiusInput = document.getElementById('ang-arc-radius');
  const angStrokeColorInput = document.getElementById('ang-stroke-color');
  const angStrokeColorHex = document.getElementById('ang-stroke-color-hex');
  const angArcColorInput = document.getElementById('ang-arc-color');
  const angArcColorHex = document.getElementById('ang-arc-color-hex');
  const angShowArrows = document.getElementById('ang-show-arrows');
  const presetAngleButtons = document.querySelectorAll('.preset-angle-btn');
  let editingAngleGroup = null;

  function openAngleModal(groupToEdit = null) {
    editingAngleGroup = groupToEdit;
    if (groupToEdit) {
      if (modalAngTitle) modalAngTitle.textContent = 'Edit Parametric Angle';
      if (btnModalAngSubmit) btnModalAngSubmit.textContent = 'Update Angle';
      const cfg = groupToEdit.getAttr('shapeConfig') || {};
      if (angDegreesInput) angDegreesInput.value = cfg.angle || 45;
      if (angLabelInput) angLabelInput.value = cfg.label !== undefined ? cfg.label : `${cfg.angle || 45}°`;
      if (angRayLengthInput) angRayLengthInput.value = cfg.rayLength || 120;
      if (angArcRadiusInput) angArcRadiusInput.value = cfg.arcRadius || 36;
      if (angStrokeColorInput) {
        angStrokeColorInput.value = cfg.stroke || '#10b981';
        if (angStrokeColorHex) angStrokeColorHex.textContent = cfg.stroke || '#10b981';
      }
      if (angArcColorInput) {
        angArcColorInput.value = cfg.arcColor || '#f59e0b';
        if (angArcColorHex) angArcColorHex.textContent = cfg.arcColor || '#f59e0b';
      }
      if (angShowArrows) angShowArrows.checked = cfg.showArrows !== false;
    } else {
      if (modalAngTitle) modalAngTitle.textContent = 'Parametric Angle Maker';
      if (btnModalAngSubmit) btnModalAngSubmit.textContent = 'Insert Angle';
      if (angDegreesInput) angDegreesInput.value = 45;
      if (angLabelInput) angLabelInput.value = '45°';
      if (angRayLengthInput) angRayLengthInput.value = 120;
      if (angArcRadiusInput) angArcRadiusInput.value = 36;
      if (angStrokeColorInput) {
        angStrokeColorInput.value = '#10b981';
        if (angStrokeColorHex) angStrokeColorHex.textContent = '#10b981';
      }
      if (angArcColorInput) {
        angArcColorInput.value = '#f59e0b';
        if (angArcColorHex) angArcColorHex.textContent = '#f59e0b';
      }
      if (angShowArrows) angShowArrows.checked = true;
    }
    if (modalAngle) modalAngle.classList.remove('hidden');
  }

  function closeAngleModal() {
    if (modalAngle) modalAngle.classList.add('hidden');
    editingAngleGroup = null;
  }

  if (btnNewAngle) btnNewAngle.addEventListener('click', () => openAngleModal());
  if (btnModalAngClose) btnModalAngClose.addEventListener('click', closeAngleModal);
  if (btnModalAngCancel) btnModalAngCancel.addEventListener('click', closeAngleModal);

  presetAngleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.angle;
      if (angDegreesInput) angDegreesInput.value = a;
      if (angLabelInput) angLabelInput.value = `${a}°`;
    });
  });

  if (angDegreesInput) {
    angDegreesInput.addEventListener('input', (e) => {
      if (angLabelInput && (angLabelInput.value.endsWith('°') || !angLabelInput.value)) {
        angLabelInput.value = `${e.target.value}°`;
      }
    });
  }

  if (angStrokeColorInput) {
    angStrokeColorInput.addEventListener('input', (e) => {
      if (angStrokeColorHex) angStrokeColorHex.textContent = e.target.value;
    });
  }

  if (angArcColorInput) {
    angArcColorInput.addEventListener('input', (e) => {
      if (angArcColorHex) angArcColorHex.textContent = e.target.value;
    });
  }

  if (formAngle) {
    formAngle.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeLayer = layerManager.getActiveLayer();
      if (!activeLayer) return;

      const config = {
        angle: parseFloat(angDegreesInput.value) || 45,
        label: angLabelInput.value,
        rayLength: parseFloat(angRayLengthInput.value) || 120,
        arcRadius: parseFloat(angArcRadiusInput.value) || 36,
        stroke: angStrokeColorInput.value,
        arcColor: angArcColorInput.value,
        strokeWidth: currentStrokeWidth || 2.5,
        showArrows: angShowArrows.checked,
      };

      if (editingAngleGroup) {
        renderParametricAngle(editingAngleGroup, config, Konva);
        transformer.nodes([editingAngleGroup]);
        const lyr = editingAngleGroup.getLayer() || activeLayer;
        if (lyr) lyr.batchDraw();
      } else {
        const group = createParametricAngleGroup(config, Konva);
        group.position({
          x: artboard.x + artboard.width / 2 - 40,
          y: artboard.y + artboard.height / 2 + 40,
        });
        group.name('shape');
        group.draggable(true);
        attachShapeEvents(group);
        activeLayer.add(group);
        setTool('select-rect');
        transformer.nodes([group]);
        activeLayer.batchDraw();
      }

      uiLayer.batchDraw();
      saveHistory();
      closeAngleModal();
    });
  }

  // --- Gear Maker Modal Logic ---
  const btnNewGear = document.getElementById('btn-new-gear');
  const modalGear = document.getElementById('modal-gear');
  const formGear = document.getElementById('form-gear');
  const btnModalGrClose = document.getElementById('btn-modal-gr-close');
  const btnModalGrCancel = document.getElementById('btn-modal-gr-cancel');
  const modalGrTitle = document.getElementById('modal-gr-title');
  const btnModalGrSubmit = document.getElementById('btn-modal-gr-submit');
  const grTeethInput = document.getElementById('gr-teeth');
  const grOuterRadiusInput = document.getElementById('gr-outer-radius');
  const grInnerRadiusInput = document.getElementById('gr-inner-radius');
  const grHoleRadiusInput = document.getElementById('gr-hole-radius');
  const grFillColorInput = document.getElementById('gr-fill-color');
  const grFillColorHex = document.getElementById('gr-fill-color-hex');
  const grStrokeColorInput = document.getElementById('gr-stroke-color');
  const grStrokeColorHex = document.getElementById('gr-stroke-color-hex');
  let editingGearGroup = null;

  function openGearModal(groupToEdit = null) {
    editingGearGroup = groupToEdit;
    if (groupToEdit) {
      if (modalGrTitle) modalGrTitle.textContent = 'Edit Parametric Gear';
      if (btnModalGrSubmit) btnModalGrSubmit.textContent = 'Update Gear';
      const cfg = groupToEdit.getAttr('shapeConfig') || {};
      if (grTeethInput) grTeethInput.value = cfg.teeth || 12;
      if (grOuterRadiusInput) grOuterRadiusInput.value = cfg.outerRadius || 75;
      if (grInnerRadiusInput) grInnerRadiusInput.value = cfg.innerRadius || 55;
      if (grHoleRadiusInput) grHoleRadiusInput.value = cfg.holeRadius !== undefined ? cfg.holeRadius : 18;
      if (grFillColorInput) {
        grFillColorInput.value = cfg.fill || '#334155';
        if (grFillColorHex) grFillColorHex.textContent = cfg.fill || '#334155';
      }
      if (grStrokeColorInput) {
        grStrokeColorInput.value = cfg.stroke || '#f59e0b';
        if (grStrokeColorHex) grStrokeColorHex.textContent = cfg.stroke || '#f59e0b';
      }
    } else {
      if (modalGrTitle) modalGrTitle.textContent = 'Parametric Gear Maker';
      if (btnModalGrSubmit) btnModalGrSubmit.textContent = 'Insert Gear';
      if (grTeethInput) grTeethInput.value = 12;
      if (grOuterRadiusInput) grOuterRadiusInput.value = 75;
      if (grInnerRadiusInput) grInnerRadiusInput.value = 55;
      if (grHoleRadiusInput) grHoleRadiusInput.value = 18;
      if (grFillColorInput) {
        grFillColorInput.value = '#334155';
        if (grFillColorHex) grFillColorHex.textContent = '#334155';
      }
      if (grStrokeColorInput) {
        grStrokeColorInput.value = '#f59e0b';
        if (grStrokeColorHex) grStrokeColorHex.textContent = '#f59e0b';
      }
    }
    if (modalGear) modalGear.classList.remove('hidden');
  }

  function closeGearModal() {
    if (modalGear) modalGear.classList.add('hidden');
    editingGearGroup = null;
  }

  if (btnNewGear) btnNewGear.addEventListener('click', () => openGearModal());
  if (btnModalGrClose) btnModalGrClose.addEventListener('click', closeGearModal);
  if (btnModalGrCancel) btnModalGrCancel.addEventListener('click', closeGearModal);

  if (grFillColorInput) {
    grFillColorInput.addEventListener('input', (e) => {
      if (grFillColorHex) grFillColorHex.textContent = e.target.value;
    });
  }

  if (grStrokeColorInput) {
    grStrokeColorInput.addEventListener('input', (e) => {
      if (grStrokeColorHex) grStrokeColorHex.textContent = e.target.value;
    });
  }

  if (formGear) {
    formGear.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeLayer = layerManager.getActiveLayer();
      if (!activeLayer) return;

      const config = {
        teeth: parseInt(grTeethInput.value, 10) || 12,
        outerRadius: parseFloat(grOuterRadiusInput.value) || 75,
        innerRadius: parseFloat(grInnerRadiusInput.value) || 55,
        holeRadius: parseFloat(grHoleRadiusInput.value) || 0,
        fill: grFillColorInput.value,
        stroke: grStrokeColorInput.value,
        strokeWidth: currentStrokeWidth || 2,
      };

      if (editingGearGroup) {
        const parent = editingGearGroup.parent || activeLayer;
        const x = editingGearGroup.x();
        const y = editingGearGroup.y();
        const scaleX = editingGearGroup.scaleX();
        const scaleY = editingGearGroup.scaleY();
        const rotation = editingGearGroup.rotation();
        editingGearGroup.destroy();

        const updatedGroup = createParametricGearGroup(config, Konva);
        updatedGroup.position({ x, y });
        updatedGroup.scaleX(scaleX);
        updatedGroup.scaleY(scaleY);
        updatedGroup.rotation(rotation);
        updatedGroup.name('shape');
        updatedGroup.draggable(true);
        attachShapeEvents(updatedGroup);
        parent.add(updatedGroup);
        transformer.nodes([updatedGroup]);
        parent.batchDraw();
      } else {
        const group = createParametricGearGroup(config, Konva);
        group.position({
          x: artboard.x + artboard.width / 2,
          y: artboard.y + artboard.height / 2,
        });
        group.name('shape');
        group.draggable(true);
        attachShapeEvents(group);
        activeLayer.add(group);
        setTool('select-rect');
        transformer.nodes([group]);
        activeLayer.batchDraw();
      }

      uiLayer.batchDraw();
      saveHistory();
      closeGearModal();
    });
  }

  // --- Deselect / Clear Ghost Selections ---
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      rasterSelection.deselectAll();
    });
  }

  // --- Zoom Controls Listeners ---
  if (btnZoomReset) btnZoomReset.addEventListener('click', () => resetZoom());
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => zoomOut());
  if (btnZoomIn) btnZoomIn.addEventListener('click', () => zoomIn());
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 12.5) {
        setZoom(val / 100);
      }
    });
  }

  // Ctrl + Wheel to Zoom
  stageContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey || currentTool === 'magnifier') {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  }, { passive: false });

  // Suppress context menu on canvas for magnifier tool (right click zooms out)
  stageContainer.addEventListener('contextmenu', (e) => {
    if (currentTool === 'magnifier') {
      e.preventDefault();
      zoomOut();
    }
  });

  stageContainer.addEventListener('scroll', () => {
    if (typeof updateSelectionOpacityBar === 'function') updateSelectionOpacityBar();
  });

  window.addEventListener('resize', () => {
    if (typeof updateSelectionOpacityBar === 'function') updateSelectionOpacityBar();
  });

  window.addEventListener('pointerup', () => {
    if (rasterSelection.isSelecting) {
      rasterSelection.handlePointerUp();
    }
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    if (activeTextarea || document.getElementById('math-editor-popover')) return;

    if (e.key === 'Escape') {
      rasterSelection.deselectAll();
      return;
    }

    // Zoom Shortcuts
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
      return;
    } else if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      zoomOut();
      return;
    } else if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      resetZoom();
      return;
    }

    const key = e.key.toLowerCase();

    if (e.key === 'F7') {
      e.preventDefault();
      if (btnToggleLayers) btnToggleLayers.click();
    } else if (e.ctrlKey && key === 's') {
      e.preventDefault();
      projectManager.saveProject(e.shiftKey);
      return;
    } else if (e.ctrlKey && key === 'o') {
      e.preventDefault();
      projectManager.openProject();
      return;
    } else if (e.ctrlKey && key === 'n') {
      e.preventDefault();
      projectManager.newProject();
      return;
    } else if (e.ctrlKey && key === 'e') {
      e.preventDefault();
      exportCanvas();
      return;
    } else if (e.ctrlKey && key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.ctrlKey && key === 'y') {
      e.preventDefault();
      redo();
    } else if (e.ctrlKey && key === 'c') {
      if (rasterSelection.hasActiveSelection()) {
        e.preventDefault();
        rasterSelection.copySelection();
        lastClipboardType = 'raster';
      } else if (transformer.nodes().length > 0) {
        e.preventDefault();
        copySelectedShapes();
      }
    } else if (e.ctrlKey && key === 'x') {
      if (rasterSelection.hasActiveSelection()) {
        e.preventDefault();
        rasterSelection.cutSelection();
        lastClipboardType = 'raster';
      } else if (transformer.nodes().length > 0) {
        e.preventDefault();
        cutSelectedShapes();
      }
    } else if (e.ctrlKey && key === 'v') {
      if (lastClipboardType === 'shape' && shapeClipboard && shapeClipboard.length > 0) {
        e.preventDefault();
        pasteSelectedShapes();
      } else if (rasterSelection.clipboard) {
        e.preventDefault();
        rasterSelection.pasteSelection();
      } else if (shapeClipboard && shapeClipboard.length > 0) {
        e.preventDefault();
        pasteSelectedShapes();
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (rasterSelection.hasActiveSelection()) {
        e.preventDefault();
        rasterSelection.deleteSelection();
      } else if (transformer.nodes().length > 0) {
        e.preventDefault();
        btnDelete.click();
      }
    } else if (e.shiftKey && key === 'l') {
      e.preventDefault();
      setTool('select-lasso');
    } else if (e.shiftKey && key === 't') {
      e.preventDefault();
      setTool('math-text');
    } else if (!e.shiftKey && (key === 'm' || key === 'v' || key === 's')) {
      setTool('select-rect');
    } else if (!e.shiftKey && key === 'p') {
      setTool('pen');
    } else if (!e.shiftKey && key === 'e') {
      setTool('eraser');
    } else if (!e.shiftKey && key === 't') {
      setTool('text');
    } else if (!e.shiftKey && key === 'l') {
      setTool('line');
    } else if (!e.shiftKey && key === 'r') {
      setTool('rectangle');
    } else if (!e.shiftKey && (key === 'c' || key === 'o')) {
      setTool('ellipse');
    }
  });

  window.addEventListener('paste', (event) => {
    if (activeTextarea || document.getElementById('math-editor-popover')) return;

    if (lastClipboardType === 'shape' && shapeClipboard && shapeClipboard.length > 0) {
      event.preventDefault();
      pasteSelectedShapes();
      return;
    }
    if (rasterSelection.clipboard) {
      event.preventDefault();
      rasterSelection.pasteSelection();
      return;
    }
    const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => insertImage(reader.result);
    reader.readAsDataURL(file);
  });

  // Prompt before exiting with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (projectManager && projectManager.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes in your Rempaint project. Are you sure you want to exit?';
      return e.returnValue;
    }
  });

  const ribbonScrollLeft = document.getElementById('ribbon-scroll-left');
  const ribbonScrollRight = document.getElementById('ribbon-scroll-right');
  const ribbonContainer = document.querySelector('.ribbon');

  function updateRibbonScrollArrows() {
    if (!ribbonContainer) return;
    const maxScroll = ribbonContainer.scrollWidth - ribbonContainer.clientWidth;
    const currentScroll = ribbonContainer.scrollLeft;

    if (maxScroll <= 4) {
      if (ribbonScrollLeft) ribbonScrollLeft.classList.add('hidden');
      if (ribbonScrollRight) ribbonScrollRight.classList.add('hidden');
      return;
    }

    if (ribbonScrollLeft) {
      if (currentScroll > 6) {
        ribbonScrollLeft.classList.remove('hidden');
      } else {
        ribbonScrollLeft.classList.add('hidden');
      }
    }

    if (ribbonScrollRight) {
      if (currentScroll < maxScroll - 6) {
        ribbonScrollRight.classList.remove('hidden');
      } else {
        ribbonScrollRight.classList.add('hidden');
      }
    }
  }

  if (ribbonContainer) {
    ribbonContainer.addEventListener('scroll', updateRibbonScrollArrows, { passive: true });
    window.addEventListener('resize', updateRibbonScrollArrows, { passive: true });

    if (ribbonScrollLeft) {
      ribbonScrollLeft.addEventListener('click', () => {
        ribbonContainer.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }

    if (ribbonScrollRight) {
      ribbonScrollRight.addEventListener('click', () => {
        ribbonContainer.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }

    // Check initial state
    setTimeout(updateRibbonScrollArrows, 50);
  }

  // Initial tool setup
  setTool('pen');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
