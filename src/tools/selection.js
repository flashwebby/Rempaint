/**
 * MS-Paint-Style Raster Selection Tool for Rempaint
 * Supports Rectangular Marquee and Free-Form Lasso Selection,
 * Transparent vs Opaque mode, Floating Selections with non-uniform scaling,
 * Copy, Cut, Paste, Duplicate (Ctrl+Drag), and Commit on deselect.
 */

export class RasterSelectionManager {
  constructor(options) {
    this.stage = options.stage;
    this.getActiveLayer = options.getActiveLayer || (() => options.drawingLayer);
    this.drawingLayer = options.drawingLayer;
    this.uiLayer = options.uiLayer;
    this.transformer = options.transformer;
    this.Konva = options.Konva;
    this.getColor1 = options.getColor1 || (() => '#000000');
    this.getColor2 = options.getColor2 || (() => '#ffffff');
    this.saveHistory = options.saveHistory || (() => {});
    this.updateActionButtons = options.updateActionButtons || (() => {});
    this.getCurrentTool = options.getCurrentTool || (() => 'select-rect');
    this.setTool = options.setTool || (() => {});
    this.getZoomLevel = options.getZoomLevel || (() => 1);

    // State
    this.isSelecting = false;
    this.isDraggingFloating = false;
    this.isCtrlDragDuplicating = false;
    this.startPos = { x: 0, y: 0 };
    this.selectionRect = null;
    this.selectionLassoLine = null;
    this.lassoPoints = [];

    // Floating selection node
    this.floatingSelection = null;
    this.isTransparentMode = true; // Default to Transparent selection

    // Internal clipboard for raster selections
    this.clipboard = null; // { dataUrl, width, height }
  }

  get activeLayer() {
    if (this.getActiveLayer) {
      return this.getActiveLayer();
    }
    return this.drawingLayer;
  }

  setTransparentMode(enabled) {
    this.isTransparentMode = enabled;
  }

  getTransparentMode() {
    return this.isTransparentMode;
  }

  hasActiveSelection() {
    return this.floatingSelection !== null;
  }

  // --- Color Matching Helper for Transparent Mode ---
  isColorMatch(r1, g1, b1, r2, g2, b2, tolerance = 35) {
    return Math.abs(r1 - r2) <= tolerance && Math.abs(g1 - g2) <= tolerance && Math.abs(b1 - b2) <= tolerance;
  }

  hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  // --- Clear Ghost Marquees & Stray UI Elements ---
  cleanupMarquees() {
    this.isSelecting = false;
    if (this.selectionRect) {
      this.selectionRect.destroy();
      this.selectionRect = null;
    }
    if (this.selectionLassoLine) {
      this.selectionLassoLine.destroy();
      this.selectionLassoLine = null;
    }
    this.lassoPoints = [];

    // Sweep and destroy any stray marquee rects/lines in uiLayer
    try {
      const strays = this.uiLayer.find('.selection-marquee');
      strays.forEach((node) => node.destroy());
    } catch (e) {
      // Ignore
    }
    this.uiLayer.batchDraw();
  }

  // --- Complete Deselect & Clear All Selection UI ---
  deselectAll() {
    this.cleanupMarquees();
    if (this.floatingSelection) {
      this.commitSelection();
    }
    this.transformer.nodes([]);
    this.uiLayer.batchDraw();
    this.updateActionButtons();
  }

  // --- Commit Floating Selection to Drawing Layer ---
  commitSelection(skipHistory = false) {
    this.cleanupMarquees();
    if (!this.floatingSelection) return;

    const node = this.floatingSelection;
    this.floatingSelection = null;
    this.transformer.nodes([]);
    this.uiLayer.batchDraw();

    // Strip all interactive event listeners and make it an inert pixel image on active layer
    node.off('dragend transformend dragstart pointerdown click tap dblclick');
    node.name('baked-raster');
    node.draggable(false);
    node.listening(false);
    this.activeLayer.batchDraw();

    if (!skipHistory) {
      this.saveHistory();
    }
    this.updateActionButtons();
  }

  // --- Pointer Down ---
  handlePointerDown(e, pos) {
    // 0. Sweep any previous uncompleted marquee
    this.cleanupMarquees();

    const activeSelectedNodes = this.transformer.nodes().filter((n) => n.getLayer() === this.activeLayer);
    if (this.transformer.nodes().length !== activeSelectedNodes.length) {
      this.transformer.nodes(activeSelectedNodes);
      this.uiLayer.batchDraw();
    }

    // 1. Check if clicking on the active transformer, its resize/rotate handles, or currently selected node(s)
    const isTransformerOrHandleClicked = e.target && (
      e.target === this.transformer ||
      e.target.getParent?.() === this.transformer ||
      activeSelectedNodes.includes(e.target) ||
      (e.target.findAncestor && activeSelectedNodes.some((n) => n === e.target.findAncestor((p) => p === n)))
    );

    if (isTransformerOrHandleClicked) {
      if (this.floatingSelection && e.target === this.floatingSelection && e.evt && e.evt.ctrlKey) {
        this.duplicateFloatingSelection();
      }
      return false; // Let Konva/Transformer handle moving or resizing the active selection!
    }

    // 2. Clicking outside the active selection -> commit floating selection and clear transformer
    if (this.floatingSelection) {
      this.commitSelection();
    }

    this.transformer.nodes([]);
    this.uiLayer.batchDraw();
    this.updateActionButtons();

    const tool = this.getCurrentTool();
    if (tool !== 'select-rect' && tool !== 'select-lasso') {
      return false;
    }

    // 3. Always start a fresh selection marquee on mousedown!
    this.isSelecting = true;
    this.startPos = { x: pos.x, y: pos.y };

    if (tool === 'select-rect') {
      this.selectionRect = new this.Konva.Rect({
        name: 'selection-marquee',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: 'rgba(0, 120, 212, 0.15)',
        stroke: '#0078d4',
        strokeWidth: 1,
        dash: [4, 4],
        listening: false,
      });
      this.uiLayer.add(this.selectionRect);
    } else if (tool === 'select-lasso') {
      this.lassoPoints = [pos.x, pos.y];
      this.selectionLassoLine = new this.Konva.Line({
        name: 'selection-marquee',
        points: this.lassoPoints,
        stroke: '#0078d4',
        strokeWidth: 1,
        dash: [4, 4],
        fill: 'rgba(0, 120, 212, 0.15)',
        closed: false,
        listening: false,
      });
      this.uiLayer.add(this.selectionLassoLine);
    }

    this.uiLayer.batchDraw();
    return true;
  }

  // --- Pointer Move ---
  handlePointerMove(pos) {
    if (!this.isSelecting) return false;

    const tool = this.getCurrentTool();
    if (tool === 'select-rect' && this.selectionRect) {
      this.selectionRect.setAttrs({
        x: Math.min(this.startPos.x, pos.x),
        y: Math.min(this.startPos.y, pos.y),
        width: Math.abs(pos.x - this.startPos.x),
        height: Math.abs(pos.y - this.startPos.y),
      });
      this.uiLayer.batchDraw();
      return true;
    } else if (tool === 'select-lasso' && this.selectionLassoLine) {
      this.lassoPoints.push(pos.x, pos.y);
      this.selectionLassoLine.points(this.lassoPoints);
      this.uiLayer.batchDraw();
      return true;
    }

    return false;
  }

  // --- Pointer Up: Finish & Rasterize Selection ---
  handlePointerUp() {
    if (!this.isSelecting) return false;

    this.isSelecting = false;
    const tool = this.getCurrentTool();

    if (tool === 'select-rect' && this.selectionRect) {
      const box = {
        x: Math.round(this.selectionRect.x()),
        y: Math.round(this.selectionRect.y()),
        width: Math.round(this.selectionRect.width()),
        height: Math.round(this.selectionRect.height()),
      };
      this.selectionRect.destroy();
      this.selectionRect = null;
      this.uiLayer.batchDraw();

      if (box.width > 4 && box.height > 4) {
        this.rasterizeRectangularSelection(box);
      }
      return true;
    } else if (tool === 'select-lasso' && this.selectionLassoLine) {
      const points = [...this.lassoPoints];
      this.selectionLassoLine.destroy();
      this.selectionLassoLine = null;
      this.uiLayer.batchDraw();

      if (points.length >= 6) {
        this.rasterizeLassoSelection(points);
      }
      return true;
    }

    return false;
  }

  // --- Rasterize Rectangle Selection ---
  rasterizeRectangularSelection(box) {
    const layerCanvas = this.activeLayer.toCanvas({ pixelRatio: 1 });
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = box.width;
    cropCanvas.height = box.height;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
    cropCtx.drawImage(layerCanvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

    const imgData = cropCtx.getImageData(0, 0, box.width, box.height);
    const data = imgData.data;

    let hasPixels = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 5) {
        hasPixels = true;
        break;
      }
    }

    if (!hasPixels) return;

    const bgRgb = this.hexToRgb(this.getColor2());

    // Apply Transparent Selection mode: make background-matching pixels transparent
    if (this.isTransparentMode) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          if (this.isColorMatch(data[i], data[i + 1], data[i + 2], bgRgb.r, bgRgb.g, bgRgb.b)) {
            data[i + 3] = 0; // Alpha transparent
          }
        }
      }
      cropCtx.putImageData(imgData, 0, 0);
    }

    // Process parametric/vector nodes intersecting this selection:
    // destroy fully-contained nodes and split partially-overlapping ones into plain raster remnants
    this.handleIntersectingNodes(box, false);

    // Clear original area from activeLayer
    this.clearSourceAreaRect(box);

    // Create floating selection
    this.createFloatingNode(cropCanvas.toDataURL(), box.x, box.y, box.width, box.height);
  }

  // --- Rasterize Freeform Lasso Selection ---
  rasterizeLassoSelection(points) {
    // Calculate bounding box of lasso polygon
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const box = {
      x: Math.round(minX),
      y: Math.round(minY),
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
    };

    if (box.width < 4 || box.height < 4) return;

    const layerCanvas = this.activeLayer.toCanvas({ pixelRatio: 1 });
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = box.width;
    cropCanvas.height = box.height;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

    // Clip to lasso polygon
    cropCtx.save();
    cropCtx.beginPath();
    cropCtx.moveTo(points[0] - box.x, points[1] - box.y);
    for (let i = 2; i < points.length; i += 2) {
      cropCtx.lineTo(points[i] - box.x, points[i + 1] - box.y);
    }
    cropCtx.closePath();
    cropCtx.clip();

    // Draw the layer snapshot within the lasso clip
    cropCtx.drawImage(layerCanvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    cropCtx.restore();

    const imgData = cropCtx.getImageData(0, 0, box.width, box.height);
    const data = imgData.data;

    let hasPixels = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 5) {
        hasPixels = true;
        break;
      }
    }

    if (!hasPixels) return;

    const bgRgb = this.hexToRgb(this.getColor2());

    if (this.isTransparentMode) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          if (this.isColorMatch(data[i], data[i + 1], data[i + 2], bgRgb.r, bgRgb.g, bgRgb.b)) {
            data[i + 3] = 0;
          }
        }
      }
      cropCtx.putImageData(imgData, 0, 0);
    }

    // Process parametric/vector nodes intersecting this lasso selection:
    // destroy fully-contained nodes and split partially-overlapping ones into plain raster remnants
    this.handleIntersectingNodes(box, true, points);

    // Clear original polygon area from activeLayer
    this.clearSourceAreaPolygon(points);

    // Create floating selection
    this.createFloatingNode(cropCanvas.toDataURL(), box.x, box.y, box.width, box.height);
  }

  // --- Process Intersecting Parametric & Vector Nodes ---
  handleIntersectingNodes(selectionBox, isLasso = false, lassoPoints = null) {
    const shapeNodes = this.activeLayer.getChildren().filter((n) => n.name() === 'shape');
    const nodesToDestroy = [];

    shapeNodes.forEach((node) => {
      // Don't process destination-out punch shapes or floating node
      if (node.globalCompositeOperation() === 'destination-out') return;
      if (node === this.floatingSelection) return;

      const clientRect = node.getClientRect({ skipTransform: false });
      const nodeBox = {
        x: clientRect.x,
        y: clientRect.y,
        width: clientRect.width,
        height: clientRect.height,
      };

      // Check if nodeBox intersects selectionBox
      const intersects = !(
        nodeBox.x + nodeBox.width < selectionBox.x ||
        nodeBox.x > selectionBox.x + selectionBox.width ||
        nodeBox.y + nodeBox.height < selectionBox.y ||
        nodeBox.y > selectionBox.y + selectionBox.height
      );

      if (!intersects) return;

      // Check if fully contained within selectionBox
      const isFullyContained = (
        nodeBox.x >= selectionBox.x &&
        nodeBox.y >= selectionBox.y &&
        nodeBox.x + nodeBox.width <= selectionBox.x + selectionBox.width &&
        nodeBox.y + nodeBox.height <= selectionBox.y + selectionBox.height
      );

      if (isFullyContained) {
        nodesToDestroy.push(node);
      } else {
        // Partially overlapping node:
        // Render node to standalone canvas, keep remnant outside selection, destroy live node
        try {
          const nodeCanvas = node.toCanvas({ pixelRatio: 1 });
          const remnantCanvas = document.createElement('canvas');
          remnantCanvas.width = Math.max(1, Math.ceil(nodeBox.width));
          remnantCanvas.height = Math.max(1, Math.ceil(nodeBox.height));
          const rCtx = remnantCanvas.getContext('2d');
          rCtx.drawImage(nodeCanvas, 0, 0);

          rCtx.save();
          rCtx.globalCompositeOperation = 'destination-out';
          if (isLasso && lassoPoints) {
            rCtx.beginPath();
            rCtx.moveTo(lassoPoints[0] - nodeBox.x, lassoPoints[1] - nodeBox.y);
            for (let i = 2; i < lassoPoints.length; i += 2) {
              rCtx.lineTo(lassoPoints[i] - nodeBox.x, lassoPoints[i + 1] - nodeBox.y);
            }
            rCtx.closePath();
            rCtx.fill();
          } else {
            const cutX = Math.max(0, selectionBox.x - nodeBox.x);
            const cutY = Math.max(0, selectionBox.y - nodeBox.y);
            const cutW = Math.min(nodeBox.width - cutX, selectionBox.x + selectionBox.width - (nodeBox.x + cutX));
            const cutH = Math.min(nodeBox.height - cutY, selectionBox.y + selectionBox.height - (nodeBox.y + cutY));
            if (cutW > 0 && cutH > 0) {
              rCtx.fillRect(cutX, cutY, cutW, cutH);
            }
          }
          rCtx.restore();

          const remnantImg = new window.Image();
          remnantImg.onload = () => {
            const remnantNode = new this.Konva.Image({
              x: nodeBox.x,
              y: nodeBox.y,
              width: nodeBox.width,
              height: nodeBox.height,
              image: remnantImg,
              name: 'shape',
            });
            this.activeLayer.add(remnantNode);
            this.activeLayer.batchDraw();
          };
          remnantImg.src = remnantCanvas.toDataURL();
        } catch (err) {
          console.warn('Could not split overlapping node remnant:', err);
        }

        nodesToDestroy.push(node);
      }
    });

    nodesToDestroy.forEach((n) => n.destroy());
  }

  // --- Clear Original Pixels from Active Layer ---
  clearSourceAreaRect(box) {
    if (this.isTransparentMode) {
      const punch = new this.Konva.Rect({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: '#000000',
        globalCompositeOperation: 'destination-out',
        name: 'shape',
        listening: false,
      });
      this.activeLayer.add(punch);
    } else {
      const fillPatch = new this.Konva.Rect({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: this.getColor2(),
        name: 'shape',
        listening: false,
      });
      this.activeLayer.add(fillPatch);
    }
    this.activeLayer.batchDraw();
  }

  clearSourceAreaPolygon(points) {
    if (this.isTransparentMode) {
      const punch = new this.Konva.Line({
        points: points,
        closed: true,
        fill: '#000000',
        globalCompositeOperation: 'destination-out',
        name: 'shape',
        listening: false,
      });
      this.activeLayer.add(punch);
    } else {
      const fillPatch = new this.Konva.Line({
        points: points,
        closed: true,
        fill: this.getColor2(),
        name: 'shape',
        listening: false,
      });
      this.activeLayer.add(fillPatch);
    }
    this.activeLayer.batchDraw();
  }

  // --- Create & Attach Floating Node ---
  createFloatingNode(dataUrl, x, y, width, height) {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => {
      const node = new this.Konva.Image({
        x: x,
        y: y,
        width: width,
        height: height,
        image: img,
        name: 'shape',
        draggable: true,
      });

      this.activeLayer.add(node);
      this.floatingSelection = node;

      // Configure transformer for non-uniform scaling
      this.transformer.keepRatio(false);
      this.transformer.centeredScaling(false);
      this.transformer.nodes([node]);

      // Wire drag and transform history
      node.on('dragend', () => this.saveHistory());
      node.on('transformend', () => this.saveHistory());

      this.activeLayer.batchDraw();
      this.uiLayer.batchDraw();
      this.updateActionButtons();
      this.saveHistory();
    };
  }

  // --- Duplicate Floating Selection (Ctrl+Drag) ---
  duplicateFloatingSelection() {
    if (!this.floatingSelection) return;

    const current = this.floatingSelection;
    // Create a clone and stamp it permanently at the current position
    const clone = new this.Konva.Image({
      x: current.x(),
      y: current.y(),
      width: current.width(),
      height: current.height(),
      scaleX: current.scaleX(),
      scaleY: current.scaleY(),
      rotation: current.rotation(),
      image: current.image(),
      name: 'baked-raster',
      draggable: false,
      listening: false,
    });

    this.activeLayer.add(clone);
    // Keep floatingSelection on top so the user continues dragging it
    current.moveToTop();
    this.activeLayer.batchDraw();
    this.saveHistory();
  }

  // --- Action: Delete Selection ---
  deleteSelection() {
    if (!this.floatingSelection) return false;

    this.floatingSelection.destroy();
    this.floatingSelection = null;
    this.transformer.nodes([]);
    this.uiLayer.batchDraw();
    this.activeLayer.batchDraw();
    this.updateActionButtons();
    this.saveHistory();
    return true;
  }

  // --- Action: Copy Selection ---
  copySelection() {
    if (!this.floatingSelection) return false;

    const img = this.floatingSelection.image();
    if (!img) return false;

    this.clipboard = {
      dataUrl: img.src || (img.toDataURL ? img.toDataURL() : ''),
      width: this.floatingSelection.width() * Math.abs(this.floatingSelection.scaleX() || 1),
      height: this.floatingSelection.height() * Math.abs(this.floatingSelection.scaleY() || 1),
    };
    return true;
  }

  // --- Action: Cut Selection ---
  cutSelection() {
    if (!this.floatingSelection) return false;

    this.copySelection();
    this.deleteSelection();
    return true;
  }

  // --- Action: Paste Clipboard Selection ---
  pasteSelection() {
    if (!this.clipboard) return false;

    this.commitSelection();

    // Paste near top-left of canvas or center
    const x = 30;
    const y = 30;
    this.createFloatingNode(this.clipboard.dataUrl, x, y, this.clipboard.width, this.clipboard.height);
    return true;
  }
}
