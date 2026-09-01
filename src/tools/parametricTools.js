/**
 * Parametric shape generator and rendering functions for Rempaint.
 * Generates Konva.Group objects with rich interactive mathematical geometry and stored shapeConfig.
 */

/**
 * Re-renders a Circle with a fixed radius, center marker, and custom radius dimension label.
 * @param {Konva.Group} group
 * @param {Object} config
 * @param {number} config.radius - Radius in pixels
 * @param {boolean} [config.showCenter] - Whether to draw a center crosshair/dot
 * @param {boolean} [config.showRadiusLine] - Whether to draw the radius guide line
 * @param {boolean} [config.showLabel] - Whether to display the radius label
 * @param {string} [config.customLabel] - Custom label text (e.g. '1km', '1mm', '1m')
 * @param {string} [config.fill] - Fill color (or 'transparent')
 * @param {string} [config.stroke] - Stroke color
 * @param {number} [config.strokeWidth] - Outline stroke width
 * @param {Object} Konva - The Konva namespace
 */
export function renderFixedCircle(group, config, Konva) {
  group.destroyChildren();

  const radius = Math.max(5, parseFloat(config.radius) || 80);
  const showCenter = config.showCenter !== false;
  const showRadiusLine = config.showRadiusLine !== false;
  const showLabel = config.showLabel !== false;
  const customLabel = config.customLabel !== undefined ? config.customLabel : '';
  const fill = config.fill || 'transparent';
  const stroke = config.stroke || '#0078d4';
  const strokeWidth = parseFloat(config.strokeWidth) || 2;

  group.setAttr('shapeType', 'fixed-circle');
  group.setAttr('shapeConfig', {
    radius,
    showCenter,
    showRadiusLine,
    showLabel,
    customLabel,
    fill,
    stroke,
    strokeWidth,
  });

  // Main Circle Shape
  const circle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: radius,
    fill: fill === 'none' || fill === 'transparent' ? undefined : fill,
    stroke: stroke,
    strokeWidth: strokeWidth,
    listening: true,
  });
  group.add(circle);

  // Radius Line
  if (showRadiusLine) {
    const radiusLine = new Konva.Line({
      points: [0, 0, radius, 0],
      stroke: '#ef4444',
      strokeWidth: Math.max(1.5, strokeWidth * 0.8),
      dash: [4, 3],
      listening: false,
    });
    group.add(radiusLine);

    // Custom or dynamic dimension Label
    if (showLabel) {
      const displayText = customLabel && customLabel.trim() !== ''
        ? customLabel.trim()
        : `r = ${radius}px`;

      const labelText = new Konva.Text({
        x: radius / 2,
        y: -14,
        text: displayText,
        fontSize: 12,
        fontFamily: 'Segoe UI, -apple-system, sans-serif',
        fontStyle: 'bold',
        fill: '#ef4444',
        align: 'center',
        listening: false,
      });
      labelText.offsetX(labelText.width() / 2);
      group.add(labelText);
    }
  }

  // Center Marker Dot
  if (showCenter) {
    const centerMark = new Konva.Circle({
      x: 0,
      y: 0,
      radius: Math.max(2.5, strokeWidth * 1.2),
      fill: stroke,
      listening: false,
    });
    group.add(centerMark);
  }
}

/**
 * Creates a Circle with a fixed radius, center marker, and customizable dimension label.
 */
export function createFixedCircleGroup(config, Konva) {
  const group = new Konva.Group({
    x: 0,
    y: 0,
    draggable: true,
    name: 'shape',
  });
  renderFixedCircle(group, config, Konva);
  return group;
}

/**
 * Re-renders an interactive Angle shape with draggable ray-tip handles and arc extension.
 * Operates with in-place geometry updates for butter-smooth 60fps manipulation.
 * @param {Konva.Group} group
 * @param {Object} config
 * @param {Object} Konva - The Konva namespace
 */
export function renderParametricAngle(group, config, Konva) {
  group.destroyChildren();

  let ray1X = config.ray1X !== undefined ? parseFloat(config.ray1X) : undefined;
  let ray1Y = config.ray1Y !== undefined ? parseFloat(config.ray1Y) : undefined;
  let ray2X = config.ray2X !== undefined ? parseFloat(config.ray2X) : undefined;
  let ray2Y = config.ray2Y !== undefined ? parseFloat(config.ray2Y) : undefined;

  const rayLength = parseFloat(config.rayLength) || 130;
  let angleDeg = parseFloat(config.angle) || 45;

  if (ray1X === undefined || ray1Y === undefined) {
    ray1X = rayLength;
    ray1Y = 0;
  }
  if (ray2X === undefined || ray2Y === undefined) {
    const initRad = (angleDeg * Math.PI) / 180;
    ray2X = rayLength * Math.cos(-initRad);
    ray2Y = rayLength * Math.sin(-initRad);
  }

  let arcRadius = parseFloat(config.arcRadius) || 38;
  const customLabel = config.customLabel !== undefined ? config.customLabel : '';
  const showArrows = config.showArrows !== false;
  const stroke = config.stroke || '#10b981';
  const arcColor = config.arcColor || '#f59e0b';
  const strokeWidth = parseFloat(config.strokeWidth) || 2.5;

  // Geometry calculations helper
  const computeGeometry = (r1x, r1y, r2x, r2y, arcR) => {
    const a1 = Math.atan2(r1y, r1x);
    const a2 = Math.atan2(r2y, r2x);

    let diff = a2 - a1;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    const angleRad = Math.abs(diff);
    let deg = Math.round((angleRad * 180) / Math.PI);
    if (deg === 0) deg = 360;

    const anticlockwise = diff < 0;
    const midAngle = a1 + diff / 2;

    const len1 = Math.sqrt(r1x * r1x + r1y * r1y);
    const len2 = Math.sqrt(r2x * r2x + r2y * r2y);
    const clampedArcR = Math.max(15, Math.min(arcR, Math.min(len1, len2) * 0.95));

    return {
      a1,
      a2,
      diff,
      angleDeg: deg,
      anticlockwise,
      midAngle,
      len1,
      len2,
      arcRadius: clampedArcR,
    };
  };

  let geom = computeGeometry(ray1X, ray1Y, ray2X, ray2Y, arcRadius);

  // Stored state on group
  group.setAttr('shapeType', 'parametric-angle');
  group.setAttr('shapeConfig', {
    angle: geom.angleDeg,
    rayLength: Math.round((geom.len1 + geom.len2) / 2),
    arcRadius: Math.round(geom.arcRadius),
    ray1X,
    ray1Y,
    ray2X,
    ray2Y,
    customLabel,
    label: customLabel || `${geom.angleDeg}°`,
    showArrows,
    stroke,
    arcColor,
    strokeWidth,
  });

  // Arc Shape (Clean outline without inner wedge fill)
  const arcShape = new Konva.Shape({
    sceneFunc: (ctx, shape) => {
      ctx.beginPath();
      if (Math.abs(geom.angleDeg - 90) < 1.5) {
        // Right-angle square indicator
        const sqSize = Math.min(geom.arcRadius, 22);
        const u1x = (ray1X / geom.len1) * sqSize;
        const u1y = (ray1Y / geom.len1) * sqSize;
        const u2x = (ray2X / geom.len2) * sqSize;
        const u2y = (ray2Y / geom.len2) * sqSize;
        ctx.moveTo(u1x, u1y);
        ctx.lineTo(u1x + u2x, u1y + u2y);
        ctx.lineTo(u2x, u2y);
      } else {
        ctx.arc(0, 0, geom.arcRadius, geom.a1, geom.a2, geom.anticlockwise);
      }
      ctx.strokeShape(shape);
    },
    stroke: arcColor,
    strokeWidth: Math.max(1.5, strokeWidth * 0.75),
    listening: false,
  });
  group.add(arcShape);

  // Rays
  const ray1Node = showArrows
    ? new Konva.Arrow({
        points: [0, 0, ray1X, ray1Y],
        pointerLength: 10,
        pointerWidth: 8,
        fill: stroke,
        stroke: stroke,
        strokeWidth: strokeWidth,
        listening: false,
      })
    : new Konva.Line({
        points: [0, 0, ray1X, ray1Y],
        stroke: stroke,
        strokeWidth: strokeWidth,
        listening: false,
      });
  group.add(ray1Node);

  const ray2Node = showArrows
    ? new Konva.Arrow({
        points: [0, 0, ray2X, ray2Y],
        pointerLength: 10,
        pointerWidth: 8,
        fill: stroke,
        stroke: stroke,
        strokeWidth: strokeWidth,
        listening: false,
      })
    : new Konva.Line({
        points: [0, 0, ray2X, ray2Y],
        stroke: stroke,
        strokeWidth: strokeWidth,
        listening: false,
      });
  group.add(ray2Node);

  // Vertex Marker
  const vertex = new Konva.Circle({
    x: 0,
    y: 0,
    radius: Math.max(3.5, strokeWidth * 1.3),
    fill: stroke,
    listening: false,
  });
  group.add(vertex);

  // Label
  const labelDist = geom.arcRadius + 18;
  const labelText = new Konva.Text({
    x: labelDist * Math.cos(geom.midAngle),
    y: labelDist * Math.sin(geom.midAngle),
    text: customLabel && customLabel.trim() !== '' ? customLabel : `${geom.angleDeg}°`,
    fontSize: 13,
    fontFamily: 'Cambria Math, Segoe UI, sans-serif',
    fontStyle: 'bold',
    fill: arcColor,
    align: 'center',
    listening: false,
  });
  labelText.offsetX(labelText.width() / 2);
  labelText.offsetY(labelText.height() / 2);
  group.add(labelText);

  // --- Interactive Control Points on the Tips of the Arrows (Visible only when selected) ---
  const handle1 = new Konva.Circle({
    x: ray1X,
    y: ray1Y,
    radius: 8,
    fill: '#ffffff',
    stroke: stroke,
    strokeWidth: 2.5,
    hitStrokeWidth: 16,
    draggable: true,
    name: 'angle-handle',
    visible: false,
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowBlur: 5,
    shadowOffset: { x: 0, y: 1 },
    shadowOpacity: 0.6,
  });

  const handle2 = new Konva.Circle({
    x: ray2X,
    y: ray2Y,
    radius: 8,
    fill: '#ffffff',
    stroke: stroke,
    strokeWidth: 2.5,
    hitStrokeWidth: 16,
    draggable: true,
    name: 'angle-handle',
    visible: false,
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowBlur: 5,
    shadowOffset: { x: 0, y: 1 },
    shadowOpacity: 0.6,
  });

  // Arc Radius handle (on the arc midpoint)
  const handleArc = new Konva.Circle({
    x: geom.arcRadius * Math.cos(geom.midAngle),
    y: geom.arcRadius * Math.sin(geom.midAngle),
    radius: 6,
    fill: '#ffffff',
    stroke: arcColor,
    strokeWidth: 2,
    hitStrokeWidth: 16,
    draggable: true,
    name: 'angle-handle',
    visible: false,
    shadowColor: 'rgba(0,0,0,0.4)',
    shadowBlur: 4,
  });

  // Fast In-Place Dynamic Sync (Without Destroying Nodes on drag!)
  let lastSavedR1 = { x: ray1X, y: ray1Y };
  let lastSavedR2 = { x: ray2X, y: ray2Y };

  const syncLiveGeometry = (activeHandle, isShift) => {
    if (activeHandle === handle1) {
      if (isShift) {
        // Shift is held: lock Ray 1 position, scale arc radius
        const d = Math.sqrt(handle1.x() * handle1.x() + handle1.y() * handle1.y());
        arcRadius = d;
        handle1.position({ x: lastSavedR1.x, y: lastSavedR1.y });
      } else {
        ray1X = handle1.x();
        ray1Y = handle1.y();
        lastSavedR1 = { x: ray1X, y: ray1Y };
      }
    } else if (activeHandle === handle2) {
      if (isShift) {
        // Shift is held: lock Ray 2 position, scale arc radius
        const d = Math.sqrt(handle2.x() * handle2.x() + handle2.y() * handle2.y());
        arcRadius = d;
        handle2.position({ x: lastSavedR2.x, y: lastSavedR2.y });
      } else {
        ray2X = handle2.x();
        ray2Y = handle2.y();
        lastSavedR2 = { x: ray2X, y: ray2Y };
      }
    } else if (activeHandle === handleArc) {
      const d = Math.sqrt(handleArc.x() * handleArc.x() + handleArc.y() * handleArc.y());
      arcRadius = d;
    }

    geom = computeGeometry(ray1X, ray1Y, ray2X, ray2Y, arcRadius);

    // Update Ray Lines
    ray1Node.points([0, 0, ray1X, ray1Y]);
    ray2Node.points([0, 0, ray2X, ray2Y]);

    // Update Arc Handle
    handleArc.position({
      x: geom.arcRadius * Math.cos(geom.midAngle),
      y: geom.arcRadius * Math.sin(geom.midAngle),
    });

    // Update Label
    const curLabel = customLabel && customLabel.trim() !== '' ? customLabel : `${geom.angleDeg}°`;
    labelText.text(curLabel);
    labelText.offsetX(labelText.width() / 2);
    labelText.offsetY(labelText.height() / 2);
    const lDist = geom.arcRadius + 18;
    labelText.position({
      x: lDist * Math.cos(geom.midAngle),
      y: lDist * Math.sin(geom.midAngle),
    });

    // Store latest state
    group.setAttr('shapeConfig', {
      angle: geom.angleDeg,
      rayLength: Math.round((geom.len1 + geom.len2) / 2),
      arcRadius: Math.round(geom.arcRadius),
      ray1X,
      ray1Y,
      ray2X,
      ray2Y,
      customLabel,
      label: curLabel,
      showArrows,
      stroke,
      arcColor,
      strokeWidth,
    });

    const layer = group.getLayer();
    if (layer) layer.batchDraw();

    const stage = group.getStage();
    if (stage) {
      const tr = stage.findOne('Transformer');
      if (tr && tr.nodes().includes(group)) {
        tr.forceUpdate();
      }
    }
  };

  handle1.on('dragmove', (e) => {
    e.cancelBubble = true;
    syncLiveGeometry(handle1, e.evt.shiftKey);
  });

  handle2.on('dragmove', (e) => {
    e.cancelBubble = true;
    syncLiveGeometry(handle2, e.evt.shiftKey);
  });

  handleArc.on('dragmove', (e) => {
    e.cancelBubble = true;
    syncLiveGeometry(handleArc, false);
  });

  const onDragEnd = (e) => {
    e.cancelBubble = true;
    if (typeof window.__rempaintSaveHistory === 'function') {
      window.__rempaintSaveHistory();
    }
  };

  handle1.on('dragend', onDragEnd);
  handle2.on('dragend', onDragEnd);
  handleArc.on('dragend', onDragEnd);

  // Add handles on top
  group.add(handleArc);
  group.add(handle1);
  group.add(handle2);
}

/**
 * Creates an Angle shape with two rays, an arc wedge, degree label, and interactive tip handles.
 */
export function createParametricAngleGroup(config, Konva) {
  const group = new Konva.Group({
    x: 0,
    y: 0,
    draggable: true,
    name: 'shape',
  });
  renderParametricAngle(group, config, Konva);
  return group;
}

/**
 * Creates a mathematically accurate Spur Gear with customizable teeth, pitch, and center hole.
 * @param {Object} config
 * @param {number} [config.teeth] - Number of teeth (e.g. 12)
 * @param {number} [config.outerRadius] - Tip radius in px (default 75)
 * @param {number} [config.innerRadius] - Root radius in px (default 55)
 * @param {number} [config.holeRadius] - Center axle hole radius in px (default 18, 0 for none)
 * @param {string} [config.fill] - Body fill color
 * @param {string} [config.stroke] - Outline stroke color
 * @param {number} [config.strokeWidth] - Outline width
 * @param {Object} Konva - The Konva namespace
 * @returns {Konva.Group}
 */
export function createParametricGearGroup(config, Konva) {
  const numTeeth = Math.max(4, Math.min(60, parseInt(config.teeth, 10) || 12));
  const outerRadius = Math.max(20, parseFloat(config.outerRadius) || 75);
  const innerRadius = Math.max(10, Math.min(outerRadius - 5, parseFloat(config.innerRadius) || 55));
  const holeRadius = Math.max(0, Math.min(innerRadius - 5, parseFloat(config.holeRadius) || 18));
  const fill = config.fill || '#334155';
  const stroke = config.stroke || '#f59e0b';
  const strokeWidth = parseFloat(config.strokeWidth) || 2;

  const group = new Konva.Group({
    x: 0,
    y: 0,
    draggable: true,
    name: 'shape',
  });

  group.setAttr('shapeType', 'parametric-gear');
  group.setAttr('shapeConfig', {
    teeth: numTeeth,
    outerRadius,
    innerRadius,
    holeRadius,
    fill,
    stroke,
    strokeWidth,
  });

  // Calculate gear points: 4 points per tooth
  const points = [];
  const toothAngle = (2 * Math.PI) / numTeeth;

  for (let i = 0; i < numTeeth; i++) {
    const baseAngle = i * toothAngle;
    
    // Root start (at inner radius)
    const a1 = baseAngle;
    points.push(innerRadius * Math.cos(a1), innerRadius * Math.sin(a1));

    // Tip start (at outer radius, slight taper)
    const a2 = baseAngle + toothAngle * 0.25;
    points.push(outerRadius * Math.cos(a2), outerRadius * Math.sin(a2));

    // Tip end (at outer radius)
    const a3 = baseAngle + toothAngle * 0.55;
    points.push(outerRadius * Math.cos(a3), outerRadius * Math.sin(a3));

    // Root end (at inner radius)
    const a4 = baseAngle + toothAngle * 0.8;
    points.push(innerRadius * Math.cos(a4), innerRadius * Math.sin(a4));
  }

  const gearOutline = new Konva.Line({
    points: points,
    closed: true,
    fill: fill === 'none' || fill === 'transparent' ? undefined : fill,
    stroke: stroke,
    strokeWidth: strokeWidth,
    listening: true,
  });
  group.add(gearOutline);

  // Axle Center Hole
  if (holeRadius > 0) {
    const centerHole = new Konva.Circle({
      x: 0,
      y: 0,
      radius: holeRadius,
      fill: '#18182b', // Background dark canvas color
      stroke: stroke,
      strokeWidth: strokeWidth,
      listening: true,
    });
    group.add(centerHole);
  }

  // Pitch Circle Reference Line (subtle dashed line)
  const pitchCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: (outerRadius + innerRadius) / 2,
    stroke: 'rgba(255, 255, 255, 0.2)',
    strokeWidth: 1,
    dash: [3, 3],
    listening: false,
  });
  group.add(pitchCircle);

  return group;
}
