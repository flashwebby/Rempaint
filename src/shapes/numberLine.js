/**
 * Number Line Shape Generator for Rempaint
 * Generates a fully editable Konva.Group representing a parametric number line
 * with ticks, numerical labels, and highlight downward arrow markers.
 */

function formatNumber(num) {
  return parseFloat(num.toFixed(6));
}

export function renderNumberLine(group, config, KonvaInstance) {
  const Konva = KonvaInstance || window.Konva;
  group.destroyChildren();

  const start = parseFloat(config.start ?? 0);
  const end = parseFloat(config.end ?? 10);
  const step = Math.max(0.0001, parseFloat(config.step ?? 1));
  const spacing = Math.max(10, parseFloat(config.spacing ?? 50));
  const labelInterval = Math.max(1, parseInt(config.labelInterval ?? 1, 10));
  const lineColor = config.lineColor || '#1e293b';
  const labelColor = config.labelColor || '#1e293b';
  const strokeWidth = parseFloat(config.strokeWidth ?? 2);
  const highlights = Array.isArray(config.highlights) ? config.highlights : [];

  const range = end - start;
  const numTicks = Math.max(1, Math.round(range / step) + 1);

  const margin = 35;
  const totalTicksSpan = (numTicks - 1) * spacing;
  const totalWidth = margin * 2 + totalTicksSpan;
  const lineY = 55;
  const tickHeight = 16;

  group.offsetX(totalWidth / 2);
  group.offsetY(lineY);

  group.setAttr('shapeType', 'number-line');
  group.setAttr('shapeConfig', {
    start,
    end,
    step,
    spacing,
    labelInterval,
    lineColor,
    labelColor,
    strokeWidth,
    highlights: JSON.parse(JSON.stringify(highlights)),
  });

  const hitBox = new Konva.Rect({
    x: 0,
    y: 0,
    width: totalWidth,
    height: lineY + 40,
    fill: 'transparent',
  });
  group.add(hitBox);

  const mainLine = new Konva.Line({
    points: [0, lineY, totalWidth, lineY],
    stroke: lineColor,
    strokeWidth: strokeWidth,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  });
  group.add(mainLine);

  const leftArrow = new Konva.Line({
    points: [8, lineY - 5, 0, lineY, 8, lineY + 5],
    stroke: lineColor,
    strokeWidth: strokeWidth,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  });
  const rightArrow = new Konva.Line({
    points: [totalWidth - 8, lineY - 5, totalWidth, lineY, totalWidth - 8, lineY + 5],
    stroke: lineColor,
    strokeWidth: strokeWidth,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  });
  group.add(leftArrow);
  group.add(rightArrow);

  for (let i = 0; i < numTicks; i++) {
    const tickVal = formatNumber(start + i * step);
    const tickX = margin + i * spacing;

    const tickLine = new Konva.Line({
      points: [tickX, lineY - tickHeight / 2, tickX, lineY + tickHeight / 2],
      stroke: lineColor,
      strokeWidth: Math.max(1.5, strokeWidth * 0.9),
      lineCap: 'round',
      listening: false,
    });
    group.add(tickLine);

    if (i % labelInterval === 0) {
      const textVal = String(tickVal);
      const approxCharWidth = 7;
      const textWidth = Math.max(16, textVal.length * approxCharWidth);

      const label = new Konva.Text({
        x: tickX - textWidth / 2,
        y: lineY + tickHeight / 2 + 5,
        width: textWidth,
        text: textVal,
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontStyle: '500',
        fill: labelColor,
        align: 'center',
        listening: false,
      });
      group.add(label);
    }
  }

  highlights.forEach((hl) => {
    if (hl.value === undefined || hl.value === null || isNaN(parseFloat(hl.value))) return;
    const val = parseFloat(hl.value);
    const hlColor = hl.color || '#ef4444';
    const hlLabelText = hl.label !== undefined && hl.label !== null && hl.label !== '' ? String(hl.label) : String(val);

    const fraction = range !== 0 ? (val - start) / range : 0;
    const hlX = margin + fraction * totalTicksSpan;

    const arrowHeight = 10;
    const arrowHalfWidth = 6;
    const arrowTipY = lineY - (tickHeight / 2 + 2);
    const arrowTopY = arrowTipY - arrowHeight;

    const arrowTriangle = new Konva.Line({
      points: [
        hlX - arrowHalfWidth, arrowTopY,
        hlX + arrowHalfWidth, arrowTopY,
        hlX, arrowTipY,
      ],
      fill: hlColor,
      stroke: hlColor,
      strokeWidth: 1,
      closed: true,
      listening: false,
    });
    group.add(arrowTriangle);

    const approxWidth = Math.max(20, hlLabelText.length * 8 + 6);
    const hlText = new Konva.Text({
      x: hlX - approxWidth / 2,
      y: arrowTopY - 16,
      width: approxWidth,
      text: hlLabelText,
      fontSize: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontStyle: 'bold',
      fill: hlColor,
      align: 'center',
      listening: false,
    });
    group.add(hlText);
  });
}

export function createNumberLineGroup(config, KonvaInstance) {
  const Konva = KonvaInstance || window.Konva;
  if (!Konva) {
    throw new Error('Konva is required to create Number Line shape');
  }

  const group = new Konva.Group({
    name: 'shape',
    draggable: false,
  });

  renderNumberLine(group, config, Konva);

  return group;
}
