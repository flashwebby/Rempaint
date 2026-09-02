/**
 * Rempaint Project Save / Load Manager (.rko format)
 * Handles full-state project serialization, Tauri file dialogs & filesystem I/O,
 * rehydration of vector shapes, Number Lines, Math Text, Desmos Graphs, and layers,
 * plus unsaved changes safety tracking.
 */

import { createNumberLineGroup, renderNumberLine } from '../shapes/numberLine.js';
import { createMathTextImageNode } from '../shapes/mathText.js';
import {
  createFixedCircleGroup,
  createParametricAngleGroup,
  createParametricGearGroup,
} from '../tools/parametricTools.js';

export class ProjectManager {
  constructor(options = {}) {
    this.stage = options.stage;
    this.layerManager = options.layerManager;
    this.uiLayer = options.uiLayer;
    this.transformer = options.transformer;
    this.Konva = options.Konva || window.Konva;
    this.artboard = options.artboard;
    this.applyArtboardDimensions = options.applyArtboardDimensions || (() => {});
    this.updateStatusCanvasSize = options.updateStatusCanvasSize || (() => {});
    this.attachShapeEvents = options.attachShapeEvents || (() => {});
    this.renderLayersPanelUI = options.renderLayersPanelUI || (() => {});
    this.updateActionButtons = options.updateActionButtons || (() => {});
    this.resetHistory = options.resetHistory || (() => {});
    this.pushInitialHistory = options.pushInitialHistory || (() => {});
    this.rasterSelection = options.rasterSelection;

    // State
    this.currentFilePath = null;
    this.hasUnsavedChanges = false;
    this.projectName = 'Untitled';
    this.fileInputEl = null;

    this.setupFileInputFallback();
    this.updateTitleBar();
  }

  setupFileInputFallback() {
    let input = document.getElementById('project-file-input-fallback');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'project-file-input-fallback';
      input.accept = '.rko,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            await this.loadProjectFromContent(evt.target.result, file.name);
          } catch (err) {
            console.error('Failed to open project:', err);
            alert(`Could not open project: ${err.message}`);
          }
          input.value = '';
        };
        reader.readAsText(file);
      }
    });
    this.fileInputEl = input;
  }

  markUnsaved() {
    this.hasUnsavedChanges = true;
    this.updateTitleBar();
  }

  markSaved(filePath = this.currentFilePath) {
    this.currentFilePath = filePath;
    this.hasUnsavedChanges = false;
    if (filePath) {
      const parts = filePath.split(/[/\\]/);
      this.projectName = parts[parts.length - 1].replace(/\.rko$/i, '');
    } else {
      this.projectName = 'Untitled';
    }
    this.updateTitleBar();
  }

  updateTitleBar() {
    const titleText = `${this.hasUnsavedChanges ? '● ' : ''}${this.projectName}.rko — Rempaint`;
    document.title = titleText;

    const brandEl = document.querySelector('.app-brand');
    if (brandEl) {
      let nameBadge = brandEl.querySelector('.project-filename-badge');
      if (!nameBadge) {
        nameBadge = document.createElement('span');
        nameBadge.className = 'project-filename-badge';
        brandEl.appendChild(nameBadge);
      }
      nameBadge.textContent = `${this.projectName}${this.hasUnsavedChanges ? '*' : ''}`;
    }
  }

  /**
   * Serialize entire project state into a .rko JSON string
   */
  serializeProject() {
    const layersData = [];

    this.layerManager.getAllLayers().forEach((layerModel) => {
      const shapes = [];
      layerModel.konvaLayer.getChildren().forEach((node) => {
        if (this.rasterSelection && node === this.rasterSelection.floatingSelection) return;
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
                opacity: node.opacity() !== undefined ? node.opacity() : 1,
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
                opacity: node.opacity() !== undefined ? node.opacity() : 1,
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

    const project = {
      format: 'rempaint-project',
      version: '1.0',
      generator: 'Rempaint Canvas',
      savedAt: new Date().toISOString(),
      artboard: {
        width: this.artboard.width,
        height: this.artboard.height,
        x: this.artboard.x,
        y: this.artboard.y,
      },
      activeLayerId: this.layerManager.activeLayerId,
      layers: layersData,
    };

    return JSON.stringify(project, null, 2);
  }

  /**
   * Save project to disk
   * @param {boolean} saveAs Force prompt for a new filename/location
   */
  async saveProject(saveAs = false) {
    const jsonContent = this.serializeProject();

    // 1. Try Tauri v2 environment
    const tauri = window.__TAURI__;
    if (tauri) {
      let targetPath = !saveAs ? this.currentFilePath : null;

      if (!targetPath) {
        try {
          if (tauri.dialog && typeof tauri.dialog.save === 'function') {
            targetPath = await tauri.dialog.save({
              filters: [{ name: 'Rempaint Project (*.rko)', extensions: ['rko'] }],
              defaultPath: this.projectName ? `${this.projectName}.rko` : 'project.rko',
            });
          } else if (tauri.core && typeof tauri.core.invoke === 'function') {
            targetPath = await tauri.core.invoke('save_file_dialog', {
              defaultName: `${this.projectName || 'project'}.rko`,
              filterName: 'Rempaint Project',
              extensions: ['rko'],
            }).catch(() => null);
          }
        } catch (e) {
          console.warn('Tauri dialog save failed:', e);
        }
      }

      if (targetPath) {
        try {
          if (tauri.core && typeof tauri.core.invoke === 'function') {
            await tauri.core.invoke('save_project_file', {
              path: targetPath,
              contents: jsonContent,
            });
            this.markSaved(targetPath);
            return true;
          } else if (tauri.fs && typeof tauri.fs.writeTextFile === 'function') {
            await tauri.fs.writeTextFile(targetPath, jsonContent);
            this.markSaved(targetPath);
            return true;
          }
        } catch (err) {
          console.error('Tauri save failed, attempting web fallback:', err);
        }
      }
    }

    // 2. Try Modern File System Access API
    if ('showSaveFilePicker' in window && (!this.currentFilePath || saveAs)) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${this.projectName || 'project'}.rko`,
          types: [{
            description: 'Rempaint Project (*.rko)',
            accept: { 'application/json': ['.rko', '.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonContent);
        await writable.close();
        this.markSaved(handle.name);
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.warn('File System Access API save failed:', err);
      }
    }

    // 3. Browser Blob Download Fallback (guaranteed to trigger file download)
    try {
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.projectName || 'project'}.rko`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 300);
      this.markSaved(`${this.projectName || 'project'}.rko`);
      return true;
    } catch (err) {
      console.error('Blob download fallback failed:', err);
    }

    return false;
  }

  /**
   * Prompt user to open a project file
   */
  async openProject() {
    if (this.hasUnsavedChanges) {
      const confirmDiscard = confirm('You have unsaved changes in your project.\nDo you want to discard them and open a new project?');
      if (!confirmDiscard) return false;
    }

    // 1. Try Tauri v2 environment
    const tauri = window.__TAURI__;
    if (tauri) {
      try {
        let selectedPath = null;
        if (tauri.dialog && typeof tauri.dialog.open === 'function') {
          selectedPath = await tauri.dialog.open({
            multiple: false,
            filters: [{ name: 'Rempaint Project (*.rko)', extensions: ['rko', 'json'] }],
          });
        } else if (tauri.core && typeof tauri.core.invoke === 'function') {
          selectedPath = await tauri.core.invoke('open_file_dialog', {
            filterName: 'Rempaint Project',
            extensions: ['rko', 'json'],
          }).catch(() => null);
        }

        if (selectedPath) {
          const filePath = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
          let fileData = null;

          if (tauri.core && typeof tauri.core.invoke === 'function') {
            fileData = await tauri.core.invoke('read_project_file', { path: filePath }).catch(() => null);
          } else if (tauri.fs && typeof tauri.fs.readTextFile === 'function') {
            fileData = await tauri.fs.readTextFile(filePath).catch(() => null);
          }

          if (fileData) {
            await this.loadProjectFromContent(fileData, filePath);
            return true;
          }
        }
      } catch (err) {
        console.warn('Tauri open failed, using fallback:', err);
      }
    }

    // 2. Try Modern File System Access API
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Rempaint Project (*.rko)',
            accept: { 'application/json': ['.rko', '.json'] },
          }],
          multiple: false,
        });
        if (handle) {
          const file = await handle.getFile();
          const content = await file.text();
          await this.loadProjectFromContent(content, file.name);
          return true;
        }
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.warn('File System Access open failed:', err);
      }
    }

    // 3. Hidden File Input Fallback
    if (this.fileInputEl) {
      this.fileInputEl.click();
      return true;
    }

    return false;
  }

  /**
   * Reset canvas to a fresh new project
   */
  newProject() {
    if (this.hasUnsavedChanges) {
      const confirmDiscard = confirm('You have unsaved changes in your project.\nDo you want to discard them and create a new project?');
      if (!confirmDiscard) return false;
    }

    // Reset Artboard to default
    this.artboard.width = 1152;
    this.artboard.height = 648;
    this.artboard.x = 60;
    this.artboard.y = 40;
    this.applyArtboardDimensions(false);
    this.updateStatusCanvasSize();

    // Reset Layers
    this.transformer.nodes([]);
    this.uiLayer.batchDraw();
    this.layerManager.destroyAllLayers();
    this.layerManager.createLayer('Layer 1', true);
    this.renderLayersPanelUI();

    this.resetHistory();
    this.pushInitialHistory();
    this.markSaved(null);
    this.projectName = 'Untitled';
    this.updateTitleBar();
    return true;
  }

  /**
   * Parse and reconstruct all layers and shapes from project JSON content
   */
  async loadProjectFromContent(jsonString, filePath = null) {
    if (!jsonString) throw new Error('Empty project content');

    const projectData = JSON.parse(jsonString);

    // Validate structure
    const rawLayers = Array.isArray(projectData.layers)
      ? projectData.layers
      : (Array.isArray(projectData.shapes) ? [{ id: 'layer_default', name: 'Layer 1', visible: true, locked: false, shapes: projectData.shapes }] : null);

    if (!rawLayers) {
      throw new Error('Unrecognized project format. Expected valid .rko project structure.');
    }

    // 1. Restore Artboard Dimensions
    if (projectData.artboard) {
      this.artboard.width = projectData.artboard.width || 1152;
      this.artboard.height = projectData.artboard.height || 648;
      if (projectData.artboard.x !== undefined) this.artboard.x = projectData.artboard.x;
      if (projectData.artboard.y !== undefined) this.artboard.y = projectData.artboard.y;
      this.applyArtboardDimensions(false);
      this.updateStatusCanvasSize();
    }

    // 2. Clear current workspace
    this.transformer.nodes([]);
    this.uiLayer.batchDraw();
    this.layerManager.destroyAllLayers();

    // 3. Rehydrate each layer and all enclosed nodes
    const pendingPromises = [];

    rawLayers.forEach((lData) => {
      const layerModel = this.layerManager.createLayer(lData.name || 'Layer', false);
      if (lData.id) layerModel.id = lData.id;
      layerModel.visible = lData.visible !== false;
      layerModel.locked = lData.locked === true;
      layerModel.konvaLayer.visible(layerModel.visible);
      layerModel.konvaLayer.listening(!layerModel.locked);

      (lData.shapes || []).forEach((item) => {
        if (item.className === 'Group' && item.shapeType === 'number-line') {
          // Rehydrate parametric Number Line using its native generator
          const group = createNumberLineGroup(item.shapeConfig, this.Konva);
          if (item.attrs) group.setAttrs(item.attrs);
          group.name('shape');
          group.draggable(true);
          this.attachShapeEvents(group);
          layerModel.konvaLayer.add(group);
        } else if (item.className === 'Group' && item.shapeType === 'fixed-circle') {
          // Rehydrate Circle with fixed radius
          const group = createFixedCircleGroup(item.shapeConfig, this.Konva);
          if (item.attrs) group.setAttrs(item.attrs);
          group.name('shape');
          group.draggable(true);
          this.attachShapeEvents(group);
          layerModel.konvaLayer.add(group);
        } else if (item.className === 'Group' && item.shapeType === 'parametric-angle') {
          // Rehydrate Parametric Angle
          const group = createParametricAngleGroup(item.shapeConfig, this.Konva);
          if (item.attrs) group.setAttrs(item.attrs);
          group.name('shape');
          group.draggable(true);
          this.attachShapeEvents(group);
          layerModel.konvaLayer.add(group);
        } else if (item.className === 'Group' && item.shapeType === 'parametric-gear') {
          // Rehydrate Parametric Gear
          const group = createParametricGearGroup(item.shapeConfig, this.Konva);
          if (item.attrs) group.setAttrs(item.attrs);
          group.name('shape');
          group.draggable(true);
          this.attachShapeEvents(group);
          layerModel.konvaLayer.add(group);
        } else if (item.className === 'Image' && item.shapeType === 'math-text') {
          // Rehydrate LaTeX Math formula
          const p = createMathTextImageNode({
            x: item.attrs?.x || 0,
            y: item.attrs?.y || 0,
            latexSource: item.latexSource,
            baseFontSize: item.baseFontSize,
            textColor: item.textColor,
          }, this.Konva).then((node) => {
            if (item.attrs) node.setAttrs(item.attrs);
            node.name('shape');
            node.draggable(true);
            this.attachShapeEvents(node);
            layerModel.konvaLayer.add(node);
            layerModel.konvaLayer.batchDraw();
          });
          pendingPromises.push(p);
        } else if (item.className === 'Image' && item.shapeType === 'desmos-graph') {
          // Rehydrate Desmos Graph with full state and live settings
          const img = new window.Image();
          const p = new Promise((resolve) => {
            img.onload = () => {
              const konvaImg = new this.Konva.Image({
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

              this.attachShapeEvents(konvaImg);
              layerModel.konvaLayer.add(konvaImg);
              layerModel.konvaLayer.batchDraw();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = item.dataURL;
          });
          pendingPromises.push(p);
        } else if (item.className === 'Image') {
          // Regular or Baked Raster Image
          const img = new window.Image();
          const p = new Promise((resolve) => {
            img.onload = () => {
              const konvaImg = new this.Konva.Image({
                ...item.attrs,
                image: img,
                listening: !item.isBakedRaster,
              });
              konvaImg.name(item.isBakedRaster ? 'baked-raster' : 'shape');
              konvaImg.draggable(!item.isBakedRaster);
              if (!item.isBakedRaster) {
                this.attachShapeEvents(konvaImg);
              }
              layerModel.konvaLayer.add(konvaImg);
              layerModel.konvaLayer.batchDraw();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = item.dataURL;
          });
          pendingPromises.push(p);
        } else {
          // General Konva Vector Shapes (Line, Rect, Ellipse, Text, etc.)
          const NodeConstructor = this.Konva[item.className];
          if (NodeConstructor) {
            const shape = new NodeConstructor(item.attrs);
            const nodeName = item.attrs.name || 'shape';
            shape.name(nodeName);
            if (nodeName !== 'baked-raster' && item.attrs.draggable !== false && item.attrs.listening !== false) {
              shape.draggable(true);
              this.attachShapeEvents(shape);
            } else {
              shape.draggable(false);
              shape.listening(false);
            }
            layerModel.konvaLayer.add(shape);
          }
        }
      });
    });

    await Promise.all(pendingPromises);

    // 4. Set Active Layer & Z-Indices
    if (projectData.activeLayerId && this.layerManager.getLayerById(projectData.activeLayerId)) {
      this.layerManager.setActiveLayer(projectData.activeLayerId, false);
    } else {
      this.layerManager.syncLayerInteractivity();
    }

    this.layerManager.updateStageZIndices();
    this.layerManager.clipAllLayers(this.artboard);
    this.stage.batchDraw();
    this.renderLayersPanelUI();
    this.updateActionButtons();

    // 5. Initialize fresh history baseline from this loaded project
    this.resetHistory();
    this.pushInitialHistory();
    this.markSaved(filePath);
  }
}
