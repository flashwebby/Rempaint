/**
 * Layer Manager for Rempaint
 * Manages multiple Konva.Layer instances, visual stacking order,
 * active layer state, visibility, locking, thumbnails, and history serialization.
 */

export class LayerManager {
  constructor(options) {
    this.stage = options.stage;
    this.Konva = options.Konva;
    this.backgroundLayer = options.backgroundLayer;
    this.uiLayer = options.uiLayer;
    this.getArtboard = options.getArtboard || (() => ({ x: 60, y: 40, width: 1152, height: 648 }));
    this.onLayersChange = options.onLayersChange || (() => {});
    this.saveHistory = options.saveHistory || (() => {});

    // Array of layer models: [{ id, name, visible, locked, konvaLayer }]
    // Stored in visual order (index 0 is the topmost layer on screen)
    this.layers = [];
    this.activeLayerId = null;
    this._nextLayerNumber = 1;
  }

  init() {
    // Initialize default project with Layer 1
    const defaultLayer = this.createLayer('Layer 1', false);
    this.setActiveLayer(defaultLayer.id, false);
    this.onLayersChange();
  }

  createLayer(name = null, triggerHistory = true) {
    const layerName = name || `Layer ${this._nextLayerNumber++}`;
    const id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
    const konvaLayer = new this.Konva.Layer({ id });

    // Apply artboard clipping to the new layer
    const artboard = this.getArtboard();
    if (artboard) {
      konvaLayer.clip({
        x: artboard.x,
        y: artboard.y,
        width: artboard.width,
        height: artboard.height,
      });
    }

    const layerModel = {
      id,
      name: layerName,
      visible: true,
      locked: false,
      konvaLayer,
    };

    // In visual order, new layer is added on top of active layer or on top of list
    const activeIndex = this.layers.findIndex((l) => l.id === this.activeLayerId);
    if (activeIndex !== -1) {
      this.layers.splice(activeIndex, 0, layerModel);
    } else {
      this.layers.unshift(layerModel);
    }

    this.stage.add(konvaLayer);
    this.updateStageZIndices();

    this.setActiveLayer(id, false);
    this.stage.batchDraw();
    this.onLayersChange();

    if (triggerHistory) {
      this.saveHistory();
    }
    return layerModel;
  }

  duplicateLayer(id) {
    const source = this.getLayerById(id);
    if (!source) return null;

    const newName = `${source.name} Copy`;
    const newLayer = this.createLayer(newName, false);

    // Clone all shapes from source layer to duplicate layer
    source.konvaLayer.getChildren().forEach((child) => {
      const clone = child.clone();
      newLayer.konvaLayer.add(clone);
    });

    newLayer.konvaLayer.batchDraw();
    this.setActiveLayer(newLayer.id, false);
    this.onLayersChange();
    this.saveHistory();
    return newLayer;
  }

  deleteLayer(id) {
    if (this.layers.length <= 1) {
      return false;
    }

    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) return false;

    const layerToDelete = this.layers[index];
    layerToDelete.konvaLayer.destroy();
    this.layers.splice(index, 1);

    // If deleted layer was active, activate adjacent layer
    if (this.activeLayerId === id) {
      const nextActiveIndex = Math.min(index, this.layers.length - 1);
      this.setActiveLayer(this.layers[nextActiveIndex].id, false);
    }

    this.updateStageZIndices();
    this.stage.batchDraw();
    this.onLayersChange();
    this.saveHistory();
    return true;
  }

  setActiveLayer(id, triggerUpdate = true) {
    const layer = this.getLayerById(id);
    if (!layer) return;
    this.activeLayerId = id;
    this.syncLayerInteractivity();
    if (triggerUpdate) {
      this.onLayersChange();
    }
  }

  syncLayerInteractivity() {
    this.layers.forEach((l) => {
      const isActive = l.id === this.activeLayerId;
      const canListen = isActive && !l.locked && l.visible;
      l.konvaLayer.listening(canListen);
      l.konvaLayer.getChildren().forEach((child) => {
        if (child.name() === 'shape') {
          child.draggable(isActive && !l.locked);
        }
      });
    });
    this.stage.batchDraw();
  }

  getActiveLayer() {
    const model = this.getActiveLayerModel();
    return model ? model.konvaLayer : null;
  }

  getActiveLayerModel() {
    return this.layers.find((l) => l.id === this.activeLayerId) || this.layers[0] || null;
  }

  getLayerById(id) {
    return this.layers.find((l) => l.id === id);
  }

  getLayerByKonvaNode(konvaNode) {
    if (!konvaNode) return null;
    const parentLayer = konvaNode.getLayer ? konvaNode.getLayer() : null;
    if (!parentLayer) return null;
    return this.layers.find((l) => l.konvaLayer === parentLayer) || null;
  }

  getAllLayers() {
    return [...this.layers]; // Topmost is index 0
  }

  setLayerVisibility(id, visible) {
    const layer = this.getLayerById(id);
    if (!layer) return;
    layer.visible = visible;
    layer.konvaLayer.visible(visible);
    this.syncLayerInteractivity();
    this.stage.batchDraw();
    this.onLayersChange();
    this.saveHistory();
  }

  setLayerLock(id, locked) {
    const layer = this.getLayerById(id);
    if (!layer) return;
    layer.locked = locked;
    this.syncLayerInteractivity();
    this.onLayersChange();
    this.saveHistory();
  }

  renameLayer(id, newName) {
    const layer = this.getLayerById(id);
    if (!layer || !newName || !newName.trim()) return;
    layer.name = newName.trim();
    this.onLayersChange();
    this.saveHistory();
  }

  reorderLayer(id, targetVisualIndex) {
    const currentIndex = this.layers.findIndex((l) => l.id === id);
    if (currentIndex === -1 || targetVisualIndex < 0 || targetVisualIndex >= this.layers.length) return;
    if (currentIndex === targetVisualIndex) return;

    const [movedLayer] = this.layers.splice(currentIndex, 1);
    this.layers.splice(targetVisualIndex, 0, movedLayer);

    this.updateStageZIndices();
    this.stage.batchDraw();
    this.onLayersChange();
    this.saveHistory();
  }

  moveLayerUp(id) {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index > 0) {
      this.reorderLayer(id, index - 1);
    }
  }

  moveLayerDown(id) {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index !== -1 && index < this.layers.length - 1) {
      this.reorderLayer(id, index + 1);
    }
  }

  updateStageZIndices() {
    // 1. backgroundLayer always stays at bottom
    this.backgroundLayer.moveToBottom();

    // 2. this.layers is visual order (0 is topmost).
    // In Konva, earlier moveToTop calls get covered by later moveToTop calls.
    // So we iterate in reverse (bottommost to topmost) and call moveToTop.
    const reversed = [...this.layers].reverse();
    reversed.forEach((layerModel) => {
      layerModel.konvaLayer.moveToTop();
    });

    // 3. uiLayer always stays at the absolute top of the stage
    this.uiLayer.moveToTop();
  }

  clipAllLayers(artboard) {
    this.layers.forEach((layerModel) => {
      layerModel.konvaLayer.clip({
        x: artboard.x,
        y: artboard.y,
        width: artboard.width,
        height: artboard.height,
      });
    });
    this.stage.batchDraw();
  }

  clearActiveLayer() {
    const active = this.getActiveLayer();
    if (active) {
      active.destroyChildren();
      active.batchDraw();
      this.onLayersChange();
      this.saveHistory();
    }
  }

  destroyAllLayers() {
    this.layers.forEach((l) => l.konvaLayer.destroy());
    this.layers = [];
    this.activeLayerId = null;
  }
}
