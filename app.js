// ihatephotoshop - Advanced Browser Image & Design Studio Engine

export function initEditor() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $('#editorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const stage = $('#canvasStage');
  const wrap = $('#canvasWrap');

  // Application State
  const state = {
    width: 1400,
    height: 900,
    background: '#ffffff', // hex or 'transparent'
    layers: [],
    selected: null,
    zoom: 1,
    activeTool: 'select', // 'select' | 'hand' | 'crop' | 'text' | 'rect' | 'circle' | 'eyedropper'
    cropState: null, // { target: 'canvas' | 'layer', layerId, x, y, w, h, origBounds }
    pan: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    dragState: null,
    undo: [],
    redo: [],
  };

  let assets = [];
  let pdfLibPromise = null;
  let toastTimer = null;
  let activeCanvas = 0;
  const canvases = [{ name: 'Canvas 1', customName: false, data: null }];

  const HANDLE_SIZE = 9;
  const ROTATE_HANDLE_OFFSET = 26;

  // -------------------------------------------------------------------------
  // Helper Functions
  // -------------------------------------------------------------------------
  function escapeHtml(v) {
    return String(v).replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }

  function showToast(text) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el?.classList.remove('show'), 2400);
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  function formatCssFilter(f) {
    if (!f) return 'none';
    const parts = [];
    if (f.brightness !== undefined && f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
    if (f.contrast !== undefined && f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
    if (f.saturate !== undefined && f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
    if (f.blur !== undefined && f.blur > 0) parts.push(`blur(${f.blur}px)`);
    if (f.invert !== undefined && f.invert > 0) parts.push(`invert(${f.invert}%)`);
    if (f.sepia !== undefined && f.sepia > 0) parts.push(`sepia(${f.sepia}%)`);
    if (f.grayscale !== undefined && f.grayscale > 0) parts.push(`grayscale(${f.grayscale}%)`);
    if (f.hueRotate !== undefined && f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
    return parts.length ? parts.join(' ') : 'none';
  }

  function defaultFilters() {
    return { brightness: 100, contrast: 100, saturate: 100, blur: 0, invert: 0, sepia: 0, grayscale: 0, hueRotate: 0 };
  }

  // -------------------------------------------------------------------------
  // Multi-Canvas Document Management
  // -------------------------------------------------------------------------
  function storeCanvas() {
    if (!canvases[activeCanvas]) return;
    canvases[activeCanvas].data = {
      width: state.width,
      height: state.height,
      background: state.background,
      layers: state.layers,
      selected: state.selected,
      undo: state.undo,
      redo: state.redo,
    };
  }

  function renumberCanvasNames() {
    canvases.forEach((doc, idx) => {
      if (!doc.customName) doc.name = `Canvas ${idx + 1}`;
    });
  }

  function renderCanvasTabs() {
    const host = $('#canvasTabs');
    if (!host) return;
    host.innerHTML = '';
    canvases.forEach((doc, idx) => {
      const item = document.createElement('div');
      item.className = `canvas-tab ${idx === activeCanvas ? 'active' : ''}`;
      
      const title = document.createElement('button');
      title.className = 'tab-title';
      title.textContent = doc.name;
      title.title = 'Click to switch · Double-click to rename';
      title.onclick = () => switchCanvas(idx);
      title.ondblclick = () => renameCanvas(idx);

      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = '×';
      close.title = `Delete ${doc.name}`;
      close.disabled = canvases.length === 1;
      close.onclick = (e) => {
        e.stopPropagation();
        deleteCanvas(idx);
      };

      item.append(title, close);
      host.append(item);
    });
  }

  function switchCanvas(idx) {
    if (idx === activeCanvas || !canvases[idx]) return;
    storeCanvas();
    activeCanvas = idx;
    const data = canvases[idx].data;
    if (data) Object.assign(state, data);
    resizeCanvas();
    updateUI();
    renderCanvasTabs();
    showToast(`Switched to ${canvases[idx].name}`);
  }

  function createCanvas() {
    storeCanvas();
    canvases.push({
      name: '',
      customName: false,
      data: {
        width: 1400,
        height: 900,
        background: '#ffffff',
        layers: [],
        selected: null,
        zoom: 1,
        activeTool: 'select',
        pan: { x: 0, y: 0 },
        isPanning: false,
        panStart: { x: 0, y: 0 },
        dragState: null,
        undo: [],
        redo: [],
      },
    });
    renumberCanvasNames();
    activeCanvas = canvases.length - 1;
    Object.assign(state, canvases[activeCanvas].data);
    resizeCanvas();
    updateUI();
    renderCanvasTabs();
    showToast(`${canvases[activeCanvas].name} created`);
  }

  function renameCanvas(idx) {
    const canvasDoc = canvases[idx];
    if (!canvasDoc) return;
    const name = window.prompt('Rename canvas', canvasDoc.name);
    if (name === null) return;
    const cleaned = name.trim().slice(0, 32);
    if (!cleaned) {
      showToast('Canvas name cannot be empty');
      return;
    }
    canvasDoc.name = cleaned;
    canvasDoc.customName = true;
    renderCanvasTabs();
    showToast('Canvas renamed');
  }

  function deleteCanvas(idx = activeCanvas) {
    if (canvases.length <= 1) {
      showToast('Keep at least one canvas open');
      return;
    }
    const target = canvases[idx];
    if (!target || !window.confirm(`Delete ${target.name}? This cannot be undone.`)) return;
    storeCanvas();
    canvases.splice(idx, 1);
    renumberCanvasNames();
    activeCanvas = idx === activeCanvas ? Math.max(0, idx - 1) : (idx < activeCanvas ? activeCanvas - 1 : activeCanvas);
    const data = canvases[activeCanvas].data;
    if (data) Object.assign(state, data);
    resizeCanvas();
    updateUI();
    renderCanvasTabs();
    showToast('Canvas deleted');
  }

  // -------------------------------------------------------------------------
  // History Undo / Redo
  // -------------------------------------------------------------------------
  function snapshot() {
    return JSON.stringify({
      width: state.width,
      height: state.height,
      background: state.background,
      layers: state.layers.map(({ image, ...layer }) => layer),
    });
  }

  function saveHistory() {
    state.undo.push(snapshot());
    if (state.undo.length > 40) state.undo.shift();
    state.redo = [];
  }

  async function restore(raw) {
    const data = JSON.parse(raw);
    state.width = data.width;
    state.height = data.height;
    state.background = data.background;
    state.layers = data.layers;

    // Restore images
    await Promise.all(
      state.layers
        .filter((l) => l.type === 'image' || (l.type === 'pdf' && l.source))
        .map(async (l) => {
          try {
            l.image = await loadImage(l.source);
          } catch {
            l.image = null;
          }
        })
    );

    state.selected = null;
    resizeCanvas();
    render();
    updateUI();
  }

  // -------------------------------------------------------------------------
  // Layer Factory Helpers
  // -------------------------------------------------------------------------
  function imageLayer(name, source, image, type = 'image') {
    const w = Math.min(image?.width || 640, 860);
    const h = Math.min(image?.height || 420, 600);
    return {
      id: crypto.randomUUID(),
      name,
      source,
      image,
      type,
      x: Math.round((state.width - w) / 2),
      y: Math.round((state.height - h) / 2),
      w,
      h,
      opacity: 1,
      rotation: 0,
      visible: true,
      locked: false,
      blendMode: 'source-over',
      flipX: false,
      flipY: false,
      filters: defaultFilters(),
    };
  }

  function textLayer(text = 'Heading Text', customOptions = {}) {
    const fontSize = customOptions.fontSize || 56;
    const fontFamily = customOptions.fontFamily || 'DM Sans';
    const fontWeight = customOptions.fontWeight || '700';
    
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    const metrics = ctx.measureText(text);
    const textW = Math.max(120, Math.round(metrics.width + 40));
    const textH = Math.round(fontSize * 1.4);
    ctx.restore();

    return {
      id: crypto.randomUUID(),
      name: text.slice(0, 18) || 'Text',
      type: 'text',
      text,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle: customOptions.fontStyle || 'normal',
      fill: customOptions.fill || (state.background === '#ffffff' || state.background === 'white' ? '#121314' : '#ffffff'),
      stroke: customOptions.stroke || '',
      strokeWidth: 0,
      align: customOptions.align || 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
      x: Math.round((state.width - textW) / 2),
      y: Math.round((state.height - textH) / 2),
      w: textW,
      h: textH,
      opacity: 1,
      rotation: 0,
      visible: true,
      locked: false,
      blendMode: 'source-over',
      flipX: false,
      flipY: false,
      filters: defaultFilters(),
    };
  }

  function shapeLayer(shapeType = 'rect', customOptions = {}) {
    const w = customOptions.w || 320;
    const h = customOptions.h || (shapeType === 'circle' ? 320 : 220);
    return {
      id: crypto.randomUUID(),
      name: shapeType === 'circle' ? 'Circle' : 'Rectangle',
      type: 'shape',
      shapeType,
      fill: customOptions.fill || '#d5fb50',
      stroke: customOptions.stroke || '',
      strokeWidth: 0,
      borderRadius: shapeType === 'rect' ? 12 : 0,
      x: Math.round((state.width - w) / 2),
      y: Math.round((state.height - h) / 2),
      w,
      h,
      opacity: 1,
      rotation: 0,
      visible: true,
      locked: false,
      blendMode: 'source-over',
      flipX: false,
      flipY: false,
      filters: defaultFilters(),
    };
  }

  function selectedLayer() {
    return state.layers.find((l) => l.id === state.selected);
  }

  // -------------------------------------------------------------------------
  // Canvas Sizing and Zoom
  // -------------------------------------------------------------------------
  function resizeCanvas() {
    canvas.width = state.width;
    canvas.height = state.height;
    fitCanvas();
    render();
    updateCanvasPanel();
  }

  function fitCanvas() {
    if (!stage) return;
    const maxW = stage.clientWidth - 80;
    const maxH = stage.clientHeight - 80;
    state.zoom = Math.min(maxW / state.width, maxH / state.height, 1);
    state.zoom = Math.max(0.08, state.zoom);
    updateZoomUI();
  }

  function updateZoomUI() {
    if (!wrap) return;
    wrap.style.width = `${Math.max(40, state.width * state.zoom)}px`;
    wrap.style.height = `${Math.max(40, state.height * state.zoom)}px`;
    wrap.classList.toggle('checkerboard', state.background === 'transparent');
    const zt = $('#zoomText');
    if (zt) zt.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setZoom(factor) {
    state.zoom = Math.max(0.1, Math.min(2.5, factor));
    updateZoomUI();
  }

  // -------------------------------------------------------------------------
  // Rendering Engine (HTML5 Canvas 2D)
  // -------------------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, state.width, state.height);

    // Background
    if (state.background !== 'transparent') {
      ctx.fillStyle = state.background;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    // Render layers from back to front
    state.layers.forEach((layer) => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';

      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
      ctx.filter = formatCssFilter(layer.filters);

      if (layer.type === 'text') {
        renderTextLayer(layer);
      } else if (layer.type === 'shape') {
        renderShapeLayer(layer);
      } else if (layer.type === 'pdf' && !layer.image) {
        drawPdfPlaceholder(layer);
      } else if (layer.image) {
        ctx.drawImage(layer.image, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
      }

      ctx.restore();
    });

    const s = selectedLayer();
    if (s && s.visible && state.activeTool === 'select') {
      renderSelectionBounds(s);
    }

    if (state.activeTool === 'crop' && state.cropState) {
      renderCropOverlay();
    }
  }

  function renderTextLayer(l) {
    const fontStyle = l.fontStyle === 'italic' ? 'italic ' : '';
    const fontWeight = l.fontWeight || '400';
    const fontSize = l.fontSize || 48;
    const fontFamily = l.fontFamily || 'DM Sans';
    ctx.font = `${fontStyle}${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = l.align || 'center';
    ctx.textBaseline = 'middle';

    const lines = String(l.text).split('\n');
    const lineHeight = fontSize * (l.lineHeight || 1.2);
    const totalH = lines.length * lineHeight;
    let startY = -totalH / 2 + lineHeight / 2;

    let alignX = 0;
    if (l.align === 'left') alignX = -l.w / 2 + 10;
    else if (l.align === 'right') alignX = l.w / 2 - 10;

    lines.forEach((line) => {
      if (l.stroke && l.strokeWidth > 0) {
        ctx.strokeStyle = l.stroke;
        ctx.lineWidth = l.strokeWidth;
        ctx.strokeText(line, alignX, startY);
      }
      ctx.fillStyle = l.fill || '#ffffff';
      ctx.fillText(line, alignX, startY);
      startY += lineHeight;
    });
  }

  function renderShapeLayer(l) {
    const halfW = l.w / 2;
    const halfH = l.h / 2;

    ctx.beginPath();
    if (l.shapeType === 'circle') {
      ctx.ellipse(0, 0, Math.abs(halfW), Math.abs(halfH), 0, 0, Math.PI * 2);
    } else {
      const r = Math.min(l.borderRadius || 0, Math.abs(halfW), Math.abs(halfH));
      ctx.roundRect(-halfW, -halfH, l.w, l.h, r);
    }

    if (l.fill) {
      ctx.fillStyle = l.fill;
      ctx.fill();
    }
    if (l.stroke && l.strokeWidth > 0) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.strokeWidth;
      ctx.stroke();
    }
  }

  function drawPdfPlaceholder(l) {
    const halfW = l.w / 2;
    const halfH = l.h / 2;
    ctx.fillStyle = '#ed4d62';
    ctx.fillRect(-halfW, -halfH, l.w, l.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-halfW + 16, -halfH + 16, l.w - 32, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.min(28, l.w / 8)}px "DM Mono"`;
    ctx.fillText('PDF', -halfW + 20, -halfH + 45);
    ctx.font = `${Math.min(14, l.w / 16)}px "DM Sans"`;
    ctx.fillText(l.name.slice(0, 24), -halfW + 20, -halfH + 72);
  }

  function renderSelectionBounds(s) {
    ctx.save();
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((s.rotation * Math.PI) / 180);

    const halfW = s.w / 2;
    const halfH = s.h / 2;
    const invZoom = 1 / state.zoom;

    // Dark contour for contrast on white canvas
    ctx.strokeStyle = 'rgba(18, 19, 20, 0.45)';
    ctx.lineWidth = Math.max(2, 4 * invZoom);
    ctx.strokeRect(-halfW, -halfH, s.w, s.h);

    // Signature Neon Lime dashed box
    ctx.strokeStyle = '#d5fb50';
    ctx.lineWidth = Math.max(1.5, 2 * invZoom);
    ctx.setLineDash([7 * invZoom, 4 * invZoom]);
    ctx.strokeRect(-halfW, -halfH, s.w, s.h);
    ctx.setLineDash([]);

    // Rotation handle
    const rotDist = halfH + ROTATE_HANDLE_OFFSET * invZoom;
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, -rotDist);
    ctx.strokeStyle = '#d5fb50';
    ctx.lineWidth = Math.max(1.5, 2 * invZoom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -rotDist, 5 * invZoom, 0, Math.PI * 2);
    ctx.fillStyle = '#d5fb50';
    ctx.fill();
    ctx.strokeStyle = '#121314';
    ctx.lineWidth = 1.5 * invZoom;
    ctx.stroke();

    // 4 Corner Resize Handles
    const handleW = Math.max(7, HANDLE_SIZE * invZoom);
    const corners = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ];

    corners.forEach(([x, y]) => {
      ctx.fillStyle = '#d5fb50';
      ctx.fillRect(x - handleW / 2, y - handleW / 2, handleW, handleW);
      ctx.strokeStyle = '#121314';
      ctx.lineWidth = Math.max(1, 1.5 * invZoom);
      ctx.strokeRect(x - handleW / 2, y - handleW / 2, handleW, handleW);
    });

    // 4 Edge Resize Handles
    const edges = [
      [0, -halfH],
      [0, halfH],
      [-halfW, 0],
      [halfW, 0],
    ];

    edges.forEach(([x, y]) => {
      ctx.fillStyle = '#d5fb50';
      ctx.fillRect(x - handleW / 2, y - handleW / 2, handleW, handleW);
      ctx.strokeStyle = '#121314';
      ctx.lineWidth = Math.max(1, 1.5 * invZoom);
      ctx.strokeRect(x - handleW / 2, y - handleW / 2, handleW, handleW);
    });

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Crop Overlay Renderer
  // -------------------------------------------------------------------------
  function renderCropOverlay() {
    const cb = state.cropState;
    if (!cb) return;

    ctx.save();

    // 1. Darken outer region
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, state.width, Math.max(0, cb.y));
    ctx.fillRect(0, cb.y + cb.h, state.width, Math.max(0, state.height - (cb.y + cb.h)));
    ctx.fillRect(0, cb.y, Math.max(0, cb.x), cb.h);
    ctx.fillRect(cb.x + cb.w, cb.y, Math.max(0, state.width - (cb.x + cb.w)), cb.h);

    const invZoom = 1 / state.zoom;

    // 2. Crop border
    ctx.strokeStyle = '#d5fb50';
    ctx.lineWidth = Math.max(1.5, 2 * invZoom);
    ctx.strokeRect(cb.x, cb.y, cb.w, cb.h);

    // 3. Rule of Thirds Grid
    ctx.strokeStyle = 'rgba(213, 251, 80, 0.35)';
    ctx.lineWidth = Math.max(1, 1 * invZoom);
    ctx.setLineDash([4 * invZoom, 4 * invZoom]);
    ctx.beginPath();
    ctx.moveTo(cb.x + cb.w / 3, cb.y);
    ctx.lineTo(cb.x + cb.w / 3, cb.y + cb.h);
    ctx.moveTo(cb.x + (cb.w * 2) / 3, cb.y);
    ctx.lineTo(cb.x + (cb.w * 2) / 3, cb.y + cb.h);
    ctx.moveTo(cb.x, cb.y + cb.h / 3);
    ctx.lineTo(cb.x + cb.w, cb.y + cb.h / 3);
    ctx.moveTo(cb.x, cb.y + (cb.h * 2) / 3);
    ctx.lineTo(cb.x + cb.w, cb.y + (cb.h * 2) / 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Crop Handles (Photoshop style L-brackets and T-bars)
    const handleLen = Math.max(12, 18 * invZoom);
    const handleThick = Math.max(3, 4 * invZoom);
    ctx.fillStyle = '#d5fb50';
    ctx.strokeStyle = '#121314';
    ctx.lineWidth = Math.max(1, 1 * invZoom);

    // Top-Left L-bracket
    ctx.fillRect(cb.x, cb.y, handleLen, handleThick);
    ctx.strokeRect(cb.x, cb.y, handleLen, handleThick);
    ctx.fillRect(cb.x, cb.y, handleThick, handleLen);
    ctx.strokeRect(cb.x, cb.y, handleThick, handleLen);

    // Top-Right L-bracket
    ctx.fillRect(cb.x + cb.w - handleLen, cb.y, handleLen, handleThick);
    ctx.strokeRect(cb.x + cb.w - handleLen, cb.y, handleLen, handleThick);
    ctx.fillRect(cb.x + cb.w - handleThick, cb.y, handleThick, handleLen);
    ctx.strokeRect(cb.x + cb.w - handleThick, cb.y, handleThick, handleLen);

    // Bottom-Left L-bracket
    ctx.fillRect(cb.x, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.strokeRect(cb.x, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.fillRect(cb.x, cb.y + cb.h - handleLen, handleThick, handleLen);
    ctx.strokeRect(cb.x, cb.y + cb.h - handleLen, handleThick, handleLen);

    // Bottom-Right L-bracket
    ctx.fillRect(cb.x + cb.w - handleLen, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.strokeRect(cb.x + cb.w - handleLen, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.fillRect(cb.x + cb.w - handleThick, cb.y + cb.h - handleLen, handleThick, handleLen);
    ctx.strokeRect(cb.x + cb.w - handleThick, cb.y + cb.h - handleLen, handleThick, handleLen);

    // Edge T-bars
    ctx.fillRect(cb.x + cb.w / 2 - handleLen / 2, cb.y, handleLen, handleThick);
    ctx.strokeRect(cb.x + cb.w / 2 - handleLen / 2, cb.y, handleLen, handleThick);
    ctx.fillRect(cb.x + cb.w / 2 - handleLen / 2, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.strokeRect(cb.x + cb.w / 2 - handleLen / 2, cb.y + cb.h - handleThick, handleLen, handleThick);
    ctx.fillRect(cb.x, cb.y + cb.h / 2 - handleLen / 2, handleThick, handleLen);
    ctx.strokeRect(cb.x, cb.y + cb.h / 2 - handleLen / 2, handleThick, handleLen);
    ctx.fillRect(cb.x + cb.w - handleThick, cb.y + cb.h / 2 - handleLen / 2, handleThick, handleLen);
    ctx.strokeRect(cb.x + cb.w - handleThick, cb.y + cb.h / 2 - handleLen / 2, handleThick, handleLen);

    // 5. Dimension Pill Badge
    const badgeText = `${Math.round(cb.w)} × ${Math.round(cb.h)} px`;
    ctx.font = `600 ${Math.max(10, 12 * invZoom)}px 'DM Mono', monospace`;
    const textWidth = ctx.measureText(badgeText).width;
    const badgeH = Math.max(18, 22 * invZoom);
    const badgeW = textWidth + 16 * invZoom;
    const badgeY = cb.y > badgeH + 8 ? cb.y - badgeH - 6 : cb.y + cb.h + 8;
    ctx.fillStyle = '#17181a';
    ctx.beginPath();
    ctx.roundRect(cb.x + (cb.w - badgeW) / 2, badgeY, badgeW, badgeH, 4 * invZoom);
    ctx.fill();
    ctx.strokeStyle = '#d5fb50';
    ctx.lineWidth = Math.max(1, 1 * invZoom);
    ctx.stroke();
    ctx.fillStyle = '#d5fb50';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, cb.x + (cb.w - textWidth) / 2, badgeY + badgeH / 2);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Hit Testing & Geometry
  // -------------------------------------------------------------------------
  function eventPoint(e) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  }

  function toLocalPoint(layer, p) {
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2;
    const rad = (-layer.rotation * Math.PI) / 180;
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: dx * Math.cos(rad) - dy * Math.sin(rad),
      y: dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  }

  function isInsideLayer(l, p) {
    const local = toLocalPoint(l, p);
    return Math.abs(local.x) <= l.w / 2 && Math.abs(local.y) <= l.h / 2;
  }

  function getHitHandle(l, p) {
    const local = toLocalPoint(l, p);
    const halfW = l.w / 2;
    const halfH = l.h / 2;
    const hitRadius = Math.max(14, (HANDLE_SIZE * 1.8) / state.zoom);

    const rotDist = halfH + ROTATE_HANDLE_OFFSET / state.zoom;
    if (Math.hypot(local.x - 0, local.y - (-rotDist)) <= hitRadius) return 'rotate';
    if (Math.hypot(local.x - (-halfW), local.y - (-halfH)) <= hitRadius) return 'tl';
    if (Math.hypot(local.x - halfW, local.y - (-halfH)) <= hitRadius) return 'tr';
    if (Math.hypot(local.x - halfW, local.y - halfH) <= hitRadius) return 'br';
    if (Math.hypot(local.x - (-halfW), local.y - halfH) <= hitRadius) return 'bl';
    if (Math.hypot(local.x - 0, local.y - (-halfH)) <= hitRadius) return 't';
    if (Math.hypot(local.x - 0, local.y - halfH) <= hitRadius) return 'b';
    if (Math.hypot(local.x - (-halfW), local.y - 0) <= hitRadius) return 'l';
    if (Math.hypot(local.x - halfW, local.y - 0) <= hitRadius) return 'r';

    return null;
  }

  function getCursorForHandle(handle, rotation) {
    if (handle === 'rotate') return 'crosshair';
    const baseAngles = {
      t: 0,
      tr: 45,
      r: 90,
      br: 135,
      b: 180,
      bl: 225,
      l: 270,
      tl: 315,
    };
    const angle = ((baseAngles[handle] ?? 0) + (rotation || 0) + 3600) % 360;
    if (angle >= 337.5 || angle < 22.5 || (angle >= 157.5 && angle < 202.5)) {
      return 'ns-resize';
    } else if ((angle >= 22.5 && angle < 67.5) || (angle >= 202.5 && angle < 247.5)) {
      return 'nesw-resize';
    } else if ((angle >= 67.5 && angle < 112.5) || (angle >= 247.5 && angle < 292.5)) {
      return 'ew-resize';
    } else {
      return 'nwse-resize';
    }
  }

  function getCropHitHandle(cb, p) {
    const hitRadius = Math.max(14, 18 / state.zoom);
    if (Math.hypot(p.x - cb.x, p.y - cb.y) <= hitRadius) return 'tl';
    if (Math.hypot(p.x - (cb.x + cb.w), p.y - cb.y) <= hitRadius) return 'tr';
    if (Math.hypot(p.x - (cb.x + cb.w), p.y - (cb.y + cb.h)) <= hitRadius) return 'br';
    if (Math.hypot(p.x - cb.x, p.y - (cb.y + cb.h)) <= hitRadius) return 'bl';
    if (Math.hypot(p.x - (cb.x + cb.w / 2), p.y - cb.y) <= hitRadius) return 't';
    if (Math.hypot(p.x - (cb.x + cb.w / 2), p.y - (cb.y + cb.h)) <= hitRadius) return 'b';
    if (Math.hypot(p.x - cb.x, p.y - (cb.y + cb.h / 2)) <= hitRadius) return 'l';
    if (Math.hypot(p.x - (cb.x + cb.w), p.y - (cb.y + cb.h / 2)) <= hitRadius) return 'r';
    return null;
  }

  // -------------------------------------------------------------------------
  // Crop Workflow: Init, Apply, Cancel
  // -------------------------------------------------------------------------
  function initCropMode(targetLayer = null) {
    const l = targetLayer || selectedLayer();
    const cropGroup = $('#cropActionsGroup');
    if (cropGroup) cropGroup.style.display = 'inline-flex';

    if (l && (l.type === 'image' || l.image)) {
      state.cropState = {
        target: 'layer',
        layerId: l.id,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        origBounds: { x: l.x, y: l.y, w: l.w, h: l.h },
      };
      showToast('Layer Crop: Drag handles to crop image · Enter to apply');
    } else {
      state.cropState = {
        target: 'canvas',
        layerId: null,
        x: 0,
        y: 0,
        w: state.width,
        h: state.height,
        origBounds: { x: 0, y: 0, w: state.width, h: state.height },
      };
      showToast('Canvas Crop: Drag handles to crop canvas · Enter to apply');
    }
    render();
  }

  function applyCrop() {
    const cb = state.cropState;
    if (!cb) return;

    if (cb.target === 'layer') {
      const l = state.layers.find((x) => x.id === cb.layerId);
      if (l && l.image) {
        saveHistory();
        const origImg = l.image;
        const nw = origImg.naturalWidth || origImg.width || l.w;
        const nh = origImg.naturalHeight || origImg.height || l.h;
        const scaleX = nw / l.w;
        const scaleY = nh / l.h;

        const relX = Math.max(0, cb.x - l.x);
        const relY = Math.max(0, cb.y - l.y);
        const relW = Math.max(10, Math.min(l.w - relX, cb.w));
        const relH = Math.max(10, Math.min(l.h - relY, cb.h));

        const srcX = relX * scaleX;
        const srcY = relY * scaleY;
        const srcW = Math.max(1, relW * scaleX);
        const srcH = Math.max(1, relH * scaleY);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(srcW);
        offCanvas.height = Math.round(srcH);
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(origImg, srcX, srcY, srcW, srcH, 0, 0, offCanvas.width, offCanvas.height);

        const croppedImg = new Image();
        croppedImg.onload = () => {
          l.image = croppedImg;
          l.source = offCanvas.toDataURL('image/png');
          l.x = Math.round(cb.x);
          l.y = Math.round(cb.y);
          l.w = Math.round(cb.w);
          l.h = Math.round(cb.h);
          state.cropState = null;
          setActiveTool('select');
          render();
          updateUI();
          showToast(`Image cropped to ${l.w} × ${l.h} px`);
        };
        croppedImg.src = offCanvas.toDataURL('image/png');
        return;
      }
    } else {
      // Canvas crop
      saveHistory();
      const shiftX = Math.round(cb.x);
      const shiftY = Math.round(cb.y);
      const newW = Math.round(Math.max(40, cb.w));
      const newH = Math.round(Math.max(40, cb.h));

      state.layers.forEach((l) => {
        l.x -= shiftX;
        l.y -= shiftY;
      });

      state.width = newW;
      state.height = newH;
      const curTab = canvases[activeCanvas];
      if (curTab) {
        curTab.width = newW;
        curTab.height = newH;
      }

      state.cropState = null;
      setActiveTool('select');
      resizeCanvas();
      render();
      updateUI();
      showToast(`Canvas cropped to ${newW} × ${newH} px`);
      return;
    }

    state.cropState = null;
    setActiveTool('select');
    render();
    updateUI();
  }

  function cancelCrop() {
    state.cropState = null;
    const cropGroup = $('#cropActionsGroup');
    if (cropGroup) cropGroup.style.display = 'none';
    if (state.activeTool === 'crop') {
      state.activeTool = 'select';
      $$('.tool').forEach((t) => t.classList.remove('active'));
      $('#selectTool')?.classList.add('active');
      canvas.style.cursor = 'default';
    }
    render();
    updateUI();
  }

  // -------------------------------------------------------------------------
  // Pointer Events & Interactive Transforms
  // -------------------------------------------------------------------------
  canvas.addEventListener('pointerdown', (e) => {
    const p = eventPoint(e);

    if (state.activeTool === 'eyedropper') {
      pickColorAt(p);
      return;
    }

    if (state.activeTool === 'hand' || e.spaceKey || e.button === 1) {
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Crop Tool Mouse Interactions
    if (state.activeTool === 'crop' && state.cropState) {
      const cb = state.cropState;
      const handle = getCropHitHandle(cb, p);
      if (handle) {
        state.dragState = {
          type: 'crop',
          handle,
          startX: p.x,
          startY: p.y,
          origX: cb.x,
          origY: cb.y,
          origW: cb.w,
          origH: cb.h,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      } else if (p.x >= cb.x && p.x <= cb.x + cb.w && p.y >= cb.y && p.y <= cb.y + cb.h) {
        state.dragState = {
          type: 'crop-move',
          startX: p.x,
          startY: p.y,
          origX: cb.x,
          origY: cb.y,
          origW: cb.w,
          origH: cb.h,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      } else {
        // Drag new crop rectangle from click point
        state.cropState.x = p.x;
        state.cropState.y = p.y;
        state.cropState.w = 1;
        state.cropState.h = 1;
        state.dragState = {
          type: 'crop-new',
          startX: p.x,
          startY: p.y,
        };
        canvas.setPointerCapture(e.pointerId);
        render();
        return;
      }
    }

    // Layer Transform Handles (Resize & Rotate)
    const cur = selectedLayer();
    if (cur && cur.visible && !cur.locked && state.activeTool === 'select') {
      const handle = getHitHandle(cur, p);
      if (handle) {
        saveHistory();
        state.dragState = {
          type: handle === 'rotate' ? 'rotate' : 'resize',
          handle,
          layerId: cur.id,
          startX: p.x,
          startY: p.y,
          origX: cur.x,
          origY: cur.y,
          origW: cur.w,
          origH: cur.h,
          origRot: cur.rotation,
          cx: cur.x + cur.w / 2,
          cy: cur.y + cur.h / 2,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Layer Selection
    const hit = [...state.layers].reverse().find((l) => l.visible && isInsideLayer(l, p));
    if (hit) {
      saveHistory();
      state.selected = hit.id;
      if (!hit.locked && state.activeTool === 'select') {
        state.dragState = {
          type: 'move',
          layerId: hit.id,
          startX: p.x,
          startY: p.y,
          origX: hit.x,
          origY: hit.y,
        };
      }
      canvas.setPointerCapture(e.pointerId);
    } else {
      state.selected = null;
    }

    render();
    updateUI();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (state.isPanning && stage) {
      stage.scrollLeft -= e.clientX - state.panStart.x;
      stage.scrollTop -= e.clientY - state.panStart.y;
      state.panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    const p = eventPoint(e);

    // Dynamic Hover Cursors for Crop Mode
    if (!state.dragState && state.activeTool === 'crop' && state.cropState) {
      const cb = state.cropState;
      const handle = getCropHitHandle(cb, p);
      if (handle === 'tl' || handle === 'br') canvas.style.cursor = 'nwse-resize';
      else if (handle === 'tr' || handle === 'bl') canvas.style.cursor = 'nesw-resize';
      else if (handle === 't' || handle === 'b') canvas.style.cursor = 'ns-resize';
      else if (handle === 'l' || handle === 'r') canvas.style.cursor = 'ew-resize';
      else if (p.x >= cb.x && p.x <= cb.x + cb.w && p.y >= cb.y && p.y <= cb.y + cb.h) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'crosshair';
      }
      return;
    }

    // Dynamic Hover Cursors for Selection Mode
    if (!state.dragState && state.activeTool === 'select') {
      const cur = selectedLayer();
      if (cur && cur.visible && !cur.locked) {
        const handle = getHitHandle(cur, p);
        if (handle) {
          canvas.style.cursor = getCursorForHandle(handle, cur.rotation);
          return;
        }
      }
      const hovering = state.layers.some((l) => l.visible && isInsideLayer(l, p));
      canvas.style.cursor = hovering ? 'move' : 'default';
    }

    if (!state.dragState) return;

    // Active Drag Operations
    if (state.dragState.type === 'crop') {
      const ds = state.dragState;
      const cb = state.cropState;
      const dx = p.x - ds.startX;
      const dy = p.y - ds.startY;

      let nx = ds.origX;
      let ny = ds.origY;
      let nw = ds.origW;
      let nh = ds.origH;

      if (ds.handle === 'tl') {
        nx = ds.origX + dx;
        ny = ds.origY + dy;
        nw = ds.origW - dx;
        nh = ds.origH - dy;
      } else if (ds.handle === 'tr') {
        ny = ds.origY + dy;
        nw = ds.origW + dx;
        nh = ds.origH - dy;
      } else if (ds.handle === 'br') {
        nw = ds.origW + dx;
        nh = ds.origH + dy;
      } else if (ds.handle === 'bl') {
        nx = ds.origX + dx;
        nw = ds.origW - dx;
        nh = ds.origH + dy;
      } else if (ds.handle === 't') {
        ny = ds.origY + dy;
        nh = ds.origH - dy;
      } else if (ds.handle === 'b') {
        nh = ds.origH + dy;
      } else if (ds.handle === 'l') {
        nx = ds.origX + dx;
        nw = ds.origW - dx;
      } else if (ds.handle === 'r') {
        nw = ds.origW + dx;
      }

      if (nw >= 20 && nh >= 20) {
        cb.x = nx;
        cb.y = ny;
        cb.w = nw;
        cb.h = nh;
      }
      render();
      return;
    } else if (state.dragState.type === 'crop-move') {
      const ds = state.dragState;
      const cb = state.cropState;
      cb.x = ds.origX + (p.x - ds.startX);
      cb.y = ds.origY + (p.y - ds.startY);
      render();
      return;
    } else if (state.dragState.type === 'crop-new') {
      const ds = state.dragState;
      const cb = state.cropState;
      cb.x = Math.min(ds.startX, p.x);
      cb.y = Math.min(ds.startY, p.y);
      cb.w = Math.max(20, Math.abs(p.x - ds.startX));
      cb.h = Math.max(20, Math.abs(p.y - ds.startY));
      render();
      return;
    }

    const l = state.layers.find((x) => x.id === state.dragState.layerId);
    if (!l) return;

    if (state.dragState.type === 'move') {
      l.x = Math.round(state.dragState.origX + (p.x - state.dragState.startX));
      l.y = Math.round(state.dragState.origY + (p.y - state.dragState.startY));
      render();
      updateInspectorValues();
    } else if (state.dragState.type === 'resize') {
      handleResize(l, state.dragState, p, e.shiftKey);
      render();
      updateInspectorValues();
    } else if (state.dragState.type === 'rotate') {
      const angle = Math.atan2(p.y - state.dragState.cy, p.x - state.dragState.cx) * (180 / Math.PI);
      l.rotation = Math.round((angle + 90) % 360);
      render();
      updateInspectorValues();
    }
  });

  canvas.addEventListener('pointerup', () => {
    state.dragState = null;
    state.isPanning = false;
  });

  function handleResize(l, ds, p, lockRatio) {
    const dx = p.x - ds.startX;
    const dy = p.y - ds.startY;
    // Convert world-space drag delta into the layer's local (unrotated) axes
    const rad = (-ds.origRot * Math.PI) / 180;
    const ldx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ldy = dx * Math.sin(rad) + dy * Math.cos(rad);

    let newW = ds.origW;
    let newH = ds.origH;

    const rotRad = (ds.origRot * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const ocx = ds.origX + ds.origW / 2;
    const ocy = ds.origY + ds.origH / 2;
    const hw = ds.origW / 2;
    const hh = ds.origH / 2;

    let anchorLx = 0;
    let anchorLy = 0;

    // 8 Handles (4 Corners + 4 Edges)
    if (ds.handle === 'br') {
      newW = Math.max(20, ds.origW + ldx);
      newH = Math.max(20, ds.origH + ldy);
      anchorLx = -hw; anchorLy = -hh; // top-left is anchor
    } else if (ds.handle === 'tr') {
      newW = Math.max(20, ds.origW + ldx);
      newH = Math.max(20, ds.origH - ldy);
      anchorLx = -hw; anchorLy = hh; // bottom-left is anchor
    } else if (ds.handle === 'bl') {
      newW = Math.max(20, ds.origW - ldx);
      newH = Math.max(20, ds.origH + ldy);
      anchorLx = hw; anchorLy = -hh; // top-right is anchor
    } else if (ds.handle === 'tl') {
      newW = Math.max(20, ds.origW - ldx);
      newH = Math.max(20, ds.origH - ldy);
      anchorLx = hw; anchorLy = hh; // bottom-right is anchor
    } else if (ds.handle === 'r') {
      newW = Math.max(20, ds.origW + ldx);
      anchorLx = -hw; anchorLy = 0; // middle-left is anchor
    } else if (ds.handle === 'l') {
      newW = Math.max(20, ds.origW - ldx);
      anchorLx = hw; anchorLy = 0; // middle-right is anchor
    } else if (ds.handle === 'b') {
      newH = Math.max(20, ds.origH + ldy);
      anchorLx = 0; anchorLy = -hh; // middle-top is anchor
    } else if (ds.handle === 't') {
      newH = Math.max(20, ds.origH - ldy);
      anchorLx = 0; anchorLy = hh; // middle-bottom is anchor
    }

    // Preserve aspect ratio for corners when shift is pressed OR when layer is image
    if ((lockRatio || (l.type === 'image' && lockRatio)) && ['tl', 'tr', 'bl', 'br'].includes(ds.handle)) {
      const ratio = ds.origW / ds.origH;
      if (Math.abs(ldx) >= Math.abs(ldy)) {
        newH = Math.max(20, newW / ratio);
      } else {
        newW = Math.max(20, newH * ratio);
      }
    }

    // World-space position of the invariant anchor point
    const anchorWx = ocx + anchorLx * cosR - anchorLy * sinR;
    const anchorWy = ocy + anchorLx * sinR + anchorLy * cosR;

    // Relative offset of the invariant anchor from the new center
    const nhw = newW / 2;
    const nhh = newH / 2;
    let newAnchorLx = 0;
    let newAnchorLy = 0;

    if (ds.handle === 'br') {
      newAnchorLx = -nhw; newAnchorLy = -nhh;
    } else if (ds.handle === 'tr') {
      newAnchorLx = -nhw; newAnchorLy = nhh;
    } else if (ds.handle === 'bl') {
      newAnchorLx = nhw; newAnchorLy = -nhh;
    } else if (ds.handle === 'tl') {
      newAnchorLx = nhw; newAnchorLy = nhh;
    } else if (ds.handle === 'r') {
      newAnchorLx = -nhw; newAnchorLy = 0;
    } else if (ds.handle === 'l') {
      newAnchorLx = nhw; newAnchorLy = 0;
    } else if (ds.handle === 'b') {
      newAnchorLx = 0; newAnchorLy = -nhh;
    } else if (ds.handle === 't') {
      newAnchorLx = 0; newAnchorLy = nhh;
    }

    // New center is the anchor position rotated back
    const newCx = anchorWx - (newAnchorLx * cosR - newAnchorLy * sinR);
    const newCy = anchorWy - (newAnchorLx * sinR + newAnchorLy * cosR);

    l.w = Math.round(newW);
    l.h = Math.round(newH);
    l.x = Math.round(newCx - newW / 2);
    l.y = Math.round(newCy - newH / 2);
  }

  canvas.addEventListener('dblclick', (e) => {
    if (state.activeTool === 'crop' && state.cropState) {
      applyCrop();
      return;
    }

    const p = eventPoint(e);
    const hit = [...state.layers].reverse().find((l) => l.type === 'text' && isInsideLayer(l, p));
    if (hit) {
      state.selected = hit.id;
      render();
      updateUI();
      const ta = $('#textValueInput');
      if (ta) {
        ta.focus();
        ta.select();
      }
    }
  });

  // -------------------------------------------------------------------------
  // Eyedropper Color Picker
  // -------------------------------------------------------------------------
  function pickColorAt(p) {
    const px = Math.floor(Math.max(0, Math.min(state.width - 1, p.x)));
    const py = Math.floor(Math.max(0, Math.min(state.height - 1, p.y)));
    const pixel = ctx.getImageData(px, py, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    const l = selectedLayer();
    if (l) {
      saveHistory();
      if (l.type === 'text') l.fill = hex;
      else if (l.type === 'shape') l.fill = hex;
      render();
      updateInspector();
      showToast(`Color applied: ${hex.toUpperCase()}`);
    } else {
      changeBackground(hex);
      showToast(`Canvas background set: ${hex.toUpperCase()}`);
    }
    setActiveTool('select');
  }

  // -------------------------------------------------------------------------
  // UI Synchronization
  // -------------------------------------------------------------------------
  function updateUI() {
    updateLayersList();
    updateInspector();
    updateCanvasPanel();
  }

  function updateLayersList() {
    const list = $('#layersList');
    if (!list) return;
    list.innerHTML = '';

    if (!state.layers.length) {
      list.innerHTML = '<div class="empty-assets">No layers yet. Add an image, text, or shape.</div>';
      return;
    }

    [...state.layers].reverse().forEach((l) => {
      const el = document.createElement('div');
      el.className = `layer-item ${l.id === state.selected ? 'selected' : ''}`;

      let thumbContent = '';
      if (l.type === 'text') {
        thumbContent = '<span class="layer-icon text">T</span>';
      } else if (l.type === 'shape') {
        thumbContent = `<span class="layer-icon shape">${l.shapeType === 'circle' ? '●' : '■'}</span>`;
      } else if (l.type === 'pdf') {
        thumbContent = '<span class="layer-icon pdf">PDF</span>';
      } else if (l.image) {
        thumbContent = `<img src="${l.source}" alt="thumbnail"/>`;
      } else {
        thumbContent = '<span class="layer-icon">IMG</span>';
      }

      el.innerHTML = `
        <div class="layer-thumb-box">${thumbContent}</div>
        <span class="layer-name" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>
        <div class="layer-actions-mini">
          <button class="layer-action-btn ${l.visible ? 'active' : ''}" data-act="vis" title="${l.visible ? 'Hide' : 'Show'}">${l.visible ? '👁' : '∅'}</button>
          <button class="layer-action-btn ${l.locked ? 'active' : ''}" data-act="lock" title="${l.locked ? 'Unlock' : 'Lock'}">${l.locked ? '🔒' : '🔓'}</button>
        </div>
      `;

      el.onclick = (e) => {
        const act = e.target.closest('button')?.dataset.act;
        if (act === 'vis') {
          saveHistory();
          l.visible = !l.visible;
          render();
          updateUI();
          return;
        }
        if (act === 'lock') {
          saveHistory();
          l.locked = !l.locked;
          render();
          updateUI();
          return;
        }
        state.selected = l.id;
        render();
        updateUI();
      };

      list.append(el);
    });
  }

  function updateInspector() {
    const l = selectedLayer();
    const empty = $('#inspectorEmpty');
    const content = $('#inspectorContent');
    const tools = $('#selectionTools');

    if (empty) empty.hidden = !!l;
    if (content) content.hidden = !l;
    if (tools) tools.classList.toggle('enabled', !!l);

    if (!l) return;

    const titleInput = $('#selectedNameInput');
    if (titleInput) titleInput.value = l.name;

    const prev = $('#selectedPreview');
    if (prev) {
      if (l.type === 'text') {
        prev.style.backgroundImage = 'none';
        prev.innerHTML = `<span style="font-size:24px;color:${l.fill || '#fff'};">${escapeHtml(l.text.slice(0, 12))}</span>`;
      } else if (l.type === 'shape') {
        prev.style.backgroundImage = 'none';
        prev.innerHTML = `<span style="font-size:32px;color:${l.fill || '#d5fb50'};">${l.shapeType === 'circle' ? '●' : '■'}</span>`;
      } else if (l.image) {
        prev.innerHTML = '';
        prev.style.backgroundImage = `url("${l.source}")`;
      } else {
        prev.style.backgroundImage = 'none';
        prev.innerHTML = '<span>PDF</span>';
      }
    }

    const textGroup = $('#textControlsGroup');
    const shapeGroup = $('#shapeControlsGroup');
    const imageGroup = $('#imageControlsGroup');
    const filterGroup = $('#filtersControlsGroup');

    if (textGroup) textGroup.hidden = l.type !== 'text';
    if (shapeGroup) shapeGroup.hidden = l.type !== 'shape';
    if (imageGroup) imageGroup.hidden = l.type !== 'image' && l.type !== 'pdf';
    if (filterGroup) filterGroup.hidden = false;

    const cropLayerBtn = $('#cropImageLayerBtn');
    if (cropLayerBtn) cropLayerBtn.style.display = (l.type === 'image' || l.image) ? 'block' : 'none';

    if (l.type === 'text') {
      if ($('#textValueInput')) $('#textValueInput').value = l.text;
      if ($('#fontFamilySelect')) $('#fontFamilySelect').value = l.fontFamily || 'DM Sans';
      if ($('#fontSizeRange')) $('#fontSizeRange').value = l.fontSize || 48;
      if ($('#fontSizeNumber')) $('#fontSizeNumber').value = l.fontSize || 48;
      if ($('#fontSizeValue')) $('#fontSizeValue').textContent = `${l.fontSize || 48}px`;
      if ($('#textColorPicker')) $('#textColorPicker').value = l.fill || '#ffffff';
      if ($('#textColorHex')) $('#textColorHex').value = (l.fill || '#ffffff').toUpperCase();
      if ($('#fontWeightSelect')) $('#fontWeightSelect').value = l.fontWeight || '400';
      if ($('#letterSpacingRange')) $('#letterSpacingRange').value = l.letterSpacing || 0;
      if ($('#letterSpacingValue')) $('#letterSpacingValue').textContent = `${l.letterSpacing || 0}px`;

      $$('#textAlignGroup button').forEach((b) => {
        b.classList.toggle('active', b.dataset.align === l.align);
      });
      $('#fontItalicBtn')?.classList.toggle('active', l.fontStyle === 'italic');
    } else if (l.type === 'shape') {
      if ($('#shapeFillPicker')) $('#shapeFillPicker').value = l.fill || '#d5fb50';
      if ($('#shapeFillHex')) $('#shapeFillHex').value = (l.fill || '#d5fb50').toUpperCase();
      if ($('#shapeStrokePicker')) $('#shapeStrokePicker').value = l.stroke || '#000000';
      if ($('#shapeStrokeHex')) $('#shapeStrokeHex').value = (l.stroke || '#000000').toUpperCase();
      if ($('#shapeStrokeWidth')) $('#shapeStrokeWidth').value = l.strokeWidth || 0;
      if ($('#shapeRadiusRow')) $('#shapeRadiusRow').hidden = l.shapeType !== 'rect';
      if (l.shapeType === 'rect' && $('#shapeRadiusRange')) {
        $('#shapeRadiusRange').value = l.borderRadius || 0;
        $('#shapeRadiusValue').textContent = `${l.borderRadius || 0}px`;
      }
    }

    const f = l.filters || defaultFilters();
    if ($('#filterBrightness')) {
      $('#filterBrightness').value = f.brightness;
      $('#filterBrightnessVal').textContent = `${f.brightness}%`;
      $('#filterContrast').value = f.contrast;
      $('#filterContrastVal').textContent = `${f.contrast}%`;
      $('#filterSaturate').value = f.saturate;
      $('#filterSaturateVal').textContent = `${f.saturate}%`;
      $('#filterBlur').value = f.blur;
      $('#filterBlurVal').textContent = `${f.blur}px`;
      $('#filterInvert').value = f.invert;
      $('#filterInvertVal').textContent = `${f.invert}%`;
      $('#filterSepia').value = f.sepia;
      $('#filterSepiaVal').textContent = `${f.sepia}%`;
      $('#filterGrayscale').value = f.grayscale;
      $('#filterGrayscaleVal').textContent = `${f.grayscale}%`;
      $('#filterHueRotate').value = f.hueRotate;
      $('#filterHueRotateVal').textContent = `${f.hueRotate}°`;
    }

    updateInspectorValues();
  }

  function updateInspectorValues() {
    const l = selectedLayer();
    if (!l) return;
    if ($('#opacityRange')) $('#opacityRange').value = Math.round(l.opacity * 100);
    if ($('#opacityValue')) $('#opacityValue').textContent = `${Math.round(l.opacity * 100)}%`;
    if ($('#rotationRange')) $('#rotationRange').value = l.rotation;
    if ($('#rotationNumber')) $('#rotationNumber').value = l.rotation;
    if ($('#rotationValue')) $('#rotationValue').textContent = `${l.rotation}°`;
    if ($('#posX')) $('#posX').value = Math.round(l.x);
    if ($('#posY')) $('#posY').value = Math.round(l.y);
    if ($('#sizeW')) $('#sizeW').value = Math.round(l.w);
    if ($('#sizeH')) $('#sizeH').value = Math.round(l.h);
    if ($('#blendModeSelect')) $('#blendModeSelect').value = l.blendMode || 'source-over';
  }

  function updateCanvasPanel() {
    if (state.background === 'transparent') {
      if ($('#backgroundHex')) $('#backgroundHex').value = 'TRANSPARENT';
      if ($('#transparentBgCheckbox')) $('#transparentBgCheckbox').checked = true;
    } else {
      if ($('#backgroundPicker')) $('#backgroundPicker').value = state.background;
      if ($('#backgroundHex')) $('#backgroundHex').value = state.background.toUpperCase();
      if ($('#transparentBgCheckbox')) $('#transparentBgCheckbox').checked = false;
    }
    const cd = $('#canvasDimensions');
    if (cd) cd.textContent = `${state.width} × ${state.height} px`;
    $$('.preset-grid button').forEach((b) => {
      b.classList.toggle('selected', b.dataset.color.toLowerCase() === state.background.toLowerCase());
    });
  }

  // -------------------------------------------------------------------------
  // Assets & File Import
  // -------------------------------------------------------------------------
  function addAsset(file, source, image, type) {
    assets.unshift({ name: file.name, source, image, type });
    renderAssets();
  }

  function renderAssets() {
    const list = $('#assetList');
    if (!list) return;
    list.innerHTML = '';
    if (!assets.length) {
      list.innerHTML = '<div class="empty-assets">Your uploaded images and PDF pages will appear here.</div>';
      return;
    }
    assets.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'asset-item';
      b.innerHTML = a.image
        ? `<img class="asset-thumbnail" src="${a.source}" alt="thumb"/><span><div class="asset-file">${escapeHtml(a.name)}</div><div class="asset-type">IMAGE · click to add</div></span>`
        : `<span class="layer-icon pdf">PDF</span><span><div class="asset-file">${escapeHtml(a.name)}</div><div class="asset-type">PDF · click to add</div></span>`;
      b.onclick = () => addLayerFromAsset(a);
      list.append(b);
    });
  }

  function addLayerFromAsset(a) {
    saveHistory();
    const img = a.image || null;
    const layer = imageLayer(a.name, a.source, img, a.type);
    if (a.type === 'pdf' && !img) {
      layer.w = 440;
      layer.h = 260;
    } else if (img) {
      const ratio = (img.width || 1) / (img.height || 1);
      if (layer.w / layer.h > ratio) layer.w = layer.h * ratio;
      else layer.h = layer.w / ratio;
    }
    layer.x = Math.round((state.width - layer.w) / 2);
    layer.y = Math.round((state.height - layer.h) / 2);
    state.layers.push(layer);
    state.selected = layer.id;
    render();
    updateUI();
    showToast(`${a.name} added to canvas`);
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = source;
    });
  }

  async function handleFiles(files) {
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(`${file.name} is larger than 50 MB`);
        continue;
      }
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        await importPdf(file);
      } else if (file.type.startsWith('image/')) {
        const source = URL.createObjectURL(file);
        try {
          const image = await loadImage(source);
          addAsset(file, source, image, 'image');
          addLayerFromAsset({ name: file.name, source, image, type: 'image' });
        } catch {
          showToast(`Could not read ${file.name}`);
        }
      } else {
        showToast('Please select an image or PDF file');
      }
    }
  }

  function getPdfJs() {
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => resolve(window.pdfjsLib);
      s.onerror = () => resolve(null);
      document.head.append(s);
    });
    return pdfLibPromise;
  }

  async function importPdf(file) {
    const source = URL.createObjectURL(file);
    let image = null;
    showToast('Processing PDF page…');
    try {
      const pdfjs = await getPdfJs();
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const doc = await pdfjs.getDocument(source).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const off = document.createElement('canvas');
        off.width = viewport.width;
        off.height = viewport.height;
        await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;
        image = await loadImage(off.toDataURL('image/png'));
      }
    } catch (err) {
      console.warn('PDF parsing fallback', err);
    }
    addAsset(file, image ? image.src : source, image, 'pdf');
    addLayerFromAsset({ name: file.name, source: image ? image.src : source, image, type: 'pdf' });
  }

  // -------------------------------------------------------------------------
  // Actions & Adjustments
  // -------------------------------------------------------------------------
  function changeBackground(color) {
    saveHistory();
    state.background = color;
    render();
    updateCanvasPanel();
  }

  function setActiveTool(tool) {
    if (state.activeTool === 'crop' && tool !== 'crop') {
      cancelCrop();
    }

    state.activeTool = tool;
    $$('.tool').forEach((t) => t.classList.remove('active'));
    $(`#${tool}Tool`)?.classList.add('active');

    const cropGroup = $('#cropActionsGroup');
    if (tool === 'crop') {
      initCropMode();
      canvas.style.cursor = 'crosshair';
      if (cropGroup) cropGroup.style.display = 'inline-flex';
    } else {
      if (cropGroup) cropGroup.style.display = 'none';
      if (tool === 'hand') canvas.style.cursor = 'grab';
      else if (tool === 'eyedropper') canvas.style.cursor = 'crosshair';
      else canvas.style.cursor = 'default';
    }
  }

  function addTextQuick(stylePreset = 'heading') {
    saveHistory();
    let opts = {};
    if (stylePreset === 'heading') opts = { fontSize: 64, fontWeight: '700', text: 'HEADING' };
    else if (stylePreset === 'body') opts = { fontSize: 32, fontWeight: '400', text: 'Body text here' };
    else if (stylePreset === 'caption') opts = { fontSize: 20, fontWeight: '500', fontFamily: 'DM Mono', text: 'Caption / Label' };

    const layer = textLayer(opts.text, opts);
    state.layers.push(layer);
    state.selected = layer.id;
    setActiveTool('select');
    render();
    updateUI();
    showToast('Text layer added');
  }

  function addShapeQuick(shapeType) {
    saveHistory();
    const layer = shapeLayer(shapeType);
    state.layers.push(layer);
    state.selected = layer.id;
    setActiveTool('select');
    render();
    updateUI();
    showToast(`${shapeType === 'circle' ? 'Circle' : 'Rectangle'} added`);
  }

  function removeSelected() {
    const l = selectedLayer();
    if (!l) return;
    saveHistory();
    state.layers = state.layers.filter((x) => x.id !== l.id);
    state.selected = null;
    render();
    updateUI();
    showToast('Layer removed');
  }

  function duplicateSelected() {
    const l = selectedLayer();
    if (!l) return;
    saveHistory();
    const copy = {
      ...JSON.parse(JSON.stringify(l)),
      id: crypto.randomUUID(),
      name: `${l.name} copy`,
      x: l.x + 24,
      y: l.y + 24,
      image: l.image,
    };
    state.layers.push(copy);
    state.selected = copy.id;
    render();
    updateUI();
    showToast('Layer duplicated');
  }

  function alignSelected(type) {
    const l = selectedLayer();
    if (!l) return;
    saveHistory();
    if (type === 'h-center') l.x = Math.round((state.width - l.w) / 2);
    else if (type === 'v-center') l.y = Math.round((state.height - l.h) / 2);
    else if (type === 'left') l.x = 0;
    else if (type === 'right') l.x = state.width - l.w;
    else if (type === 'top') l.y = 0;
    else if (type === 'bottom') l.y = state.height - l.h;
    render();
    updateInspectorValues();
  }

  function flipSelected(axis) {
    const l = selectedLayer();
    if (!l) return;
    saveHistory();
    if (axis === 'h') l.flipX = !l.flipX;
    else if (axis === 'v') l.flipY = !l.flipY;
    render();
    showToast(`Flipped ${axis === 'h' ? 'horizontally' : 'vertically'}`);
  }

  // -------------------------------------------------------------------------
  // Export Engine
  // -------------------------------------------------------------------------
  function exportImage(format = 'png', quality = 0.94) {
    const temp = document.createElement('canvas');
    temp.width = state.width;
    temp.height = state.height;
    const t = temp.getContext('2d');

    if (state.background !== 'transparent' || format === 'jpg') {
      t.fillStyle = state.background === 'transparent' ? '#ffffff' : state.background;
      t.fillRect(0, 0, temp.width, temp.height);
    }

    state.layers.forEach((layer) => {
      if (!layer.visible) return;
      t.save();
      t.globalAlpha = layer.opacity;
      t.globalCompositeOperation = layer.blendMode || 'source-over';

      const cx = layer.x + layer.w / 2;
      const cy = layer.y + layer.h / 2;
      t.translate(cx, cy);
      t.rotate((layer.rotation * Math.PI) / 180);
      t.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
      t.filter = formatCssFilter(layer.filters);

      if (layer.type === 'text') {
        const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
        const fontWeight = layer.fontWeight || '400';
        const fontSize = layer.fontSize || 48;
        const fontFamily = layer.fontFamily || 'DM Sans';
        t.font = `${fontStyle}${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
        t.textAlign = layer.align || 'center';
        t.textBaseline = 'middle';

        const lines = String(layer.text).split('\n');
        const lineHeight = fontSize * (layer.lineHeight || 1.2);
        const totalH = lines.length * lineHeight;
        let startY = -totalH / 2 + lineHeight / 2;
        let alignX = 0;
        if (layer.align === 'left') alignX = -layer.w / 2 + 10;
        else if (layer.align === 'right') alignX = layer.w / 2 - 10;

        lines.forEach((line) => {
          if (layer.stroke && layer.strokeWidth > 0) {
            t.strokeStyle = layer.stroke;
            t.lineWidth = layer.strokeWidth;
            t.strokeText(line, alignX, startY);
          }
          t.fillStyle = layer.fill || '#ffffff';
          t.fillText(line, alignX, startY);
          startY += lineHeight;
        });
      } else if (layer.type === 'shape') {
        const halfW = layer.w / 2;
        const halfH = layer.h / 2;
        t.beginPath();
        if (layer.shapeType === 'circle') {
          t.ellipse(0, 0, Math.abs(halfW), Math.abs(halfH), 0, 0, Math.PI * 2);
        } else {
          const r = Math.min(layer.borderRadius || 0, Math.abs(halfW), Math.abs(halfH));
          t.roundRect(-halfW, -halfH, layer.w, layer.h, r);
        }
        if (layer.fill) {
          t.fillStyle = layer.fill;
          t.fill();
        }
        if (layer.stroke && layer.strokeWidth > 0) {
          t.strokeStyle = layer.stroke;
          t.lineWidth = layer.strokeWidth;
          t.stroke();
        }
      } else if (layer.image) {
        t.drawImage(layer.image, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
      }
      t.restore();
    });

    const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    return temp.toDataURL(mime, quality);
  }

  function download(name, href) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1200);
  }

  function exportPdf() {
    const data = exportImage('jpg', 0.95).split(',')[1];
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const w = state.width;
    const h = state.height;
    const parts = [];
    const offsets = [0];
    const push = (s) => parts.push(typeof s === 'string' ? new TextEncoder().encode(s) : s);

    push('%PDF-1.4\n');
    const obj = (n, body) => {
      offsets[n] = parts.reduce((a, b) => a + b.length, 0);
      push(`${n} 0 obj\n${body}\nendobj\n`);
    };

    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = parts.reduce((a, b) => a + b.length, 0);
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push('\nendstream\nendobj\n');

    const stream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ`;
    obj(5, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const xref = parts.reduce((a, b) => a + b.length, 0);
    push('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

    const name = ($('#docName')?.value || 'composition').replace(/[^a-z0-9-_]/gi, '-');
    download(`${name}.pdf`, URL.createObjectURL(new Blob(parts, { type: 'application/pdf' })));
  }

  async function copyToClipboard() {
    try {
      const dataUrl = exportImage('png');
      const blob = await fetch(dataUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Image copied to clipboard!');
    } catch {
      showToast('Clipboard access denied');
    }
  }

  // -------------------------------------------------------------------------
  // Event Bindings
  // -------------------------------------------------------------------------
  if ($('#fileInput')) {
    $('#fileInput').onchange = (e) => {
      handleFiles(e.target.files);
      e.target.value = '';
    };
  }

  ['#uploadCard', '#addAssetBtn'].forEach((s) => {
    $(s)?.addEventListener('click', () => $('#fileInput')?.click());
  });

  if (stage) {
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      stage.style.outline = '3px solid #d5fb50';
    });
    stage.addEventListener('dragleave', () => (stage.style.outline = ''));
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      stage.style.outline = '';
      handleFiles(e.dataTransfer.files);
    });
  }

  if ($('#blankCanvasBtn')) $('#blankCanvasBtn').onclick = createCanvas;
  if ($('#clearAssets')) {
    $('#clearAssets').onclick = () => {
      assets = [];
      renderAssets();
      showToast('Assets cleared');
    };
  }

  // Rail tabs & Panels: clicking the current panel toggles a minimal workspace.
  const setPanelExpanded = (expanded) => {
    const shell = $('.app-shell');
    const panel = $('#sidePanel');
    const mobile = window.matchMedia('(max-width: 880px)').matches;
    if (mobile) panel?.classList.toggle('mobile-open', expanded);
    else shell?.classList.toggle('panel-collapsed', !expanded);
    $$('.rail-button[data-panel]').forEach((button) => {
      button.setAttribute('aria-expanded', String(expanded && button.classList.contains('active')));
    });
  };

  $$('.rail-button[data-panel]').forEach((b) => {
    b.setAttribute('aria-expanded', String(b.classList.contains('active')));
    b.onclick = () => {
      const isActive = b.classList.contains('active');
      const isMobile = window.matchMedia('(max-width: 880px)').matches;
      const isExpanded = isMobile
        ? $('#sidePanel')?.classList.contains('mobile-open')
        : !$('.app-shell')?.classList.contains('panel-collapsed');

      if (isActive && isExpanded) {
        setPanelExpanded(false);
        return;
      }

      $$('.rail-button[data-panel]').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const target = b.dataset.panel;
      $$('#sidePanel section').forEach((s) => (s.hidden = s.dataset.section !== target));
      setPanelExpanded(true);
    };
  });

  // Background color bindings
  if ($('#backgroundPicker')) $('#backgroundPicker').oninput = (e) => changeBackground(e.target.value);
  if ($('#backgroundHex')) {
    $('#backgroundHex').onchange = (e) => {
      const val = e.target.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(val)) changeBackground(val);
    };
  }
  $$('.preset-grid button').forEach((b) => {
    b.onclick = () => changeBackground(b.dataset.color);
  });

  $('#transparentBgCheckbox')?.addEventListener('change', (e) => {
    changeBackground(e.target.checked ? 'transparent' : '#ffffff');
  });

  if ($('#formatSelect')) {
    $('#formatSelect').onchange = (e) => {
      if (e.target.value === 'custom') return;
      saveHistory();
      const [w, h] = e.target.value.split('x').map(Number);
      state.width = w;
      state.height = h;
      resizeCanvas();
    };
  }

  // Inspector inputs
  if ($('#opacityRange')) {
    $('#opacityRange').oninput = (e) => {
      const l = selectedLayer();
      if (!l) return;
      l.opacity = Number(e.target.value) / 100;
      if ($('#opacityValue')) $('#opacityValue').textContent = `${e.target.value}%`;
      render();
    };
    $('#opacityRange').onchange = () => saveHistory();
  }

  if ($('#rotationRange')) {
    $('#rotationRange').oninput = (e) => {
      const l = selectedLayer();
      if (!l) return;
      l.rotation = Number(e.target.value);
      if ($('#rotationNumber')) $('#rotationNumber').value = l.rotation;
      if ($('#rotationValue')) $('#rotationValue').textContent = `${l.rotation}°`;
      render();
    };
    $('#rotationRange').onchange = () => saveHistory();
  }

  if ($('#rotationNumber')) {
    $('#rotationNumber').onchange = (e) => {
      const l = selectedLayer();
      if (!l) return;
      saveHistory();
      l.rotation = Math.max(-360, Math.min(360, Number(e.target.value) || 0));
      if ($('#rotationRange')) $('#rotationRange').value = l.rotation;
      if ($('#rotationValue')) $('#rotationValue').textContent = `${l.rotation}°`;
      render();
    };
  }

  ['#posX', '#posY', '#sizeW', '#sizeH'].forEach((sel) => {
    const key = sel.slice(1).replace('pos', '').replace('size', '').toLowerCase();
    const el = $(sel);
    if (el) {
      el.onchange = (e) => {
        const l = selectedLayer();
        if (!l) return;
        saveHistory();
        l[key] = Math.max(1, Number(e.target.value) || 1);
        render();
      };
    }
  });

  if ($('#blendModeSelect')) {
    $('#blendModeSelect').onchange = (e) => {
      const l = selectedLayer();
      if (!l) return;
      saveHistory();
      l.blendMode = e.target.value;
      render();
    };
  }

  if ($('#selectedNameInput')) {
    $('#selectedNameInput').onchange = (e) => {
      const l = selectedLayer();
      if (!l) return;
      saveHistory();
      l.name = e.target.value.trim() || 'Layer';
      updateLayersList();
    };
  }

  // Text layer controls
  $('#textValueInput')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    l.text = e.target.value;
    render();
  });
  $('#textValueInput')?.addEventListener('change', () => saveHistory());

  $('#fontFamilySelect')?.addEventListener('change', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    saveHistory();
    l.fontFamily = e.target.value;
    render();
  });

  $('#fontSizeRange')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    l.fontSize = Number(e.target.value);
    if ($('#fontSizeNumber')) $('#fontSizeNumber').value = l.fontSize;
    if ($('#fontSizeValue')) $('#fontSizeValue').textContent = `${l.fontSize}px`;
    render();
  });
  $('#fontSizeRange')?.addEventListener('change', () => saveHistory());

  $('#fontSizeNumber')?.addEventListener('change', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    saveHistory();
    l.fontSize = Math.max(8, Math.min(300, Number(e.target.value) || 48));
    if ($('#fontSizeRange')) $('#fontSizeRange').value = l.fontSize;
    if ($('#fontSizeValue')) $('#fontSizeValue').textContent = `${l.fontSize}px`;
    render();
  });

  $('#fontWeightSelect')?.addEventListener('change', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    saveHistory();
    l.fontWeight = e.target.value;
    render();
  });

  $('#fontItalicBtn')?.addEventListener('click', () => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    saveHistory();
    l.fontStyle = l.fontStyle === 'italic' ? 'normal' : 'italic';
    $('#fontItalicBtn')?.classList.toggle('active', l.fontStyle === 'italic');
    render();
  });

  $$('#textAlignGroup button').forEach((b) => {
    b.onclick = () => {
      const l = selectedLayer();
      if (!l || l.type !== 'text') return;
      saveHistory();
      l.align = b.dataset.align;
      $$('#textAlignGroup button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      render();
    };
  });

  $('#textColorPicker')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    l.fill = e.target.value;
    if ($('#textColorHex')) $('#textColorHex').value = e.target.value.toUpperCase();
    render();
  });
  $('#textColorPicker')?.addEventListener('change', () => saveHistory());

  $('#textColorHex')?.addEventListener('change', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    const val = e.target.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(val)) {
      saveHistory();
      l.fill = val;
      if ($('#textColorPicker')) $('#textColorPicker').value = val;
      render();
    }
  });

  $('#letterSpacingRange')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'text') return;
    l.letterSpacing = Number(e.target.value);
    if ($('#letterSpacingValue')) $('#letterSpacingValue').textContent = `${l.letterSpacing}px`;
    render();
  });
  $('#letterSpacingRange')?.addEventListener('change', () => saveHistory());

  // Shape layer controls
  $('#shapeFillPicker')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'shape') return;
    l.fill = e.target.value;
    if ($('#shapeFillHex')) $('#shapeFillHex').value = e.target.value.toUpperCase();
    render();
  });
  $('#shapeFillPicker')?.addEventListener('change', () => saveHistory());

  $('#shapeStrokePicker')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'shape') return;
    l.stroke = e.target.value;
    if ($('#shapeStrokeHex')) $('#shapeStrokeHex').value = e.target.value.toUpperCase();
    render();
  });
  $('#shapeStrokePicker')?.addEventListener('change', () => saveHistory());

  $('#shapeStrokeWidth')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'shape') return;
    l.strokeWidth = Number(e.target.value);
    render();
  });
  $('#shapeStrokeWidth')?.addEventListener('change', () => saveHistory());

  $('#shapeRadiusRange')?.addEventListener('input', (e) => {
    const l = selectedLayer();
    if (!l || l.type !== 'shape') return;
    l.borderRadius = Number(e.target.value);
    if ($('#shapeRadiusValue')) $('#shapeRadiusValue').textContent = `${l.borderRadius}px`;
    render();
  });
  $('#shapeRadiusRange')?.addEventListener('change', () => saveHistory());

  // Filters Controls
  const bindFilter = (id, key, suffix = '%') => {
    const el = $(`#${id}`);
    const valEl = $(`#${id}Val`);
    if (!el) return;
    el.oninput = (e) => {
      const l = selectedLayer();
      if (!l) return;
      if (!l.filters) l.filters = defaultFilters();
      l.filters[key] = Number(e.target.value);
      if (valEl) valEl.textContent = `${e.target.value}${suffix}`;
      render();
    };
    el.onchange = () => saveHistory();
  };

  bindFilter('filterBrightness', 'brightness', '%');
  bindFilter('filterContrast', 'contrast', '%');
  bindFilter('filterSaturate', 'saturate', '%');
  bindFilter('filterBlur', 'blur', 'px');
  bindFilter('filterInvert', 'invert', '%');
  bindFilter('filterSepia', 'sepia', '%');
  bindFilter('filterGrayscale', 'grayscale', '%');
  bindFilter('filterHueRotate', 'hueRotate', '°');

  $('#resetFiltersBtn')?.addEventListener('click', () => {
    const l = selectedLayer();
    if (!l) return;
    saveHistory();
    l.filters = defaultFilters();
    render();
    updateInspector();
    showToast('Filters reset');
  });

  if ($('#fitLayerBtn')) {
    $('#fitLayerBtn').onclick = () => {
      const l = selectedLayer();
      if (!l) return;
      saveHistory();
      const r = Math.min(state.width / l.w, state.height / l.h);
      l.w = Math.round(l.w * r);
      l.h = Math.round(l.h * r);
      l.x = Math.round((state.width - l.w) / 2);
      l.y = Math.round((state.height - l.h) / 2);
      render();
      updateInspector();
    };
  }

  $('#centerLayerBtn')?.addEventListener('click', () => {
    alignSelected('h-center');
    alignSelected('v-center');
  });

  if ($('#removeLayerBtn')) $('#removeLayerBtn').onclick = removeSelected;
  if ($('#deleteBtn')) $('#deleteBtn').onclick = removeSelected;
  if ($('#duplicateBtn')) $('#duplicateBtn').onclick = duplicateSelected;
  $('#duplicateLayerBtn')?.addEventListener('click', duplicateSelected);

  if ($('#forwardBtn')) {
    $('#forwardBtn').onclick = () => {
      const i = state.layers.findIndex((l) => l.id === state.selected);
      if (i >= 0 && i < state.layers.length - 1) {
        saveHistory();
        [state.layers[i], state.layers[i + 1]] = [state.layers[i + 1], state.layers[i]];
        render();
        updateLayersList();
      }
    };
  }

  if ($('#backwardBtn')) {
    $('#backwardBtn').onclick = () => {
      const i = state.layers.findIndex((l) => l.id === state.selected);
      if (i > 0) {
        saveHistory();
        [state.layers[i], state.layers[i - 1]] = [state.layers[i - 1], state.layers[i]];
        render();
        updateLayersList();
      }
    };
  }

  $('#flipHBtn')?.addEventListener('click', () => flipSelected('h'));
  $('#flipVBtn')?.addEventListener('click', () => flipSelected('v'));
  $('#alignHCenterBtn')?.addEventListener('click', () => alignSelected('h-center'));
  $('#alignVCenterBtn')?.addEventListener('click', () => alignSelected('v-center'));

  $('#selectTool')?.addEventListener('click', () => setActiveTool('select'));
  $('#handTool')?.addEventListener('click', () => setActiveTool('hand'));
  $('#cropTool')?.addEventListener('click', () => setActiveTool('crop'));
  $('#textTool')?.addEventListener('click', () => addTextQuick('heading'));
  $('#rectTool')?.addEventListener('click', () => addShapeQuick('rect'));
  $('#circleTool')?.addEventListener('click', () => addShapeQuick('circle'));
  $('#eyedropperTool')?.addEventListener('click', () => setActiveTool('eyedropper'));

  $('#applyCropBtn')?.addEventListener('click', () => applyCrop());
  $('#cancelCropBtn')?.addEventListener('click', () => cancelCrop());
  $('#cropImageLayerBtn')?.addEventListener('click', () => {
    const l = selectedLayer();
    if (l) {
      setActiveTool('crop');
      initCropMode(l);
    }
  });

  $('#addHeadingBtn')?.addEventListener('click', () => addTextQuick('heading'));
  $('#addBodyTextBtn')?.addEventListener('click', () => addTextQuick('body'));
  $('#addCaptionBtn')?.addEventListener('click', () => addTextQuick('caption'));
  $('#addRectBtn')?.addEventListener('click', () => addShapeQuick('rect'));
  $('#addCircleBtn')?.addEventListener('click', () => addShapeQuick('circle'));

  if ($('#undoBtn')) {
    $('#undoBtn').onclick = async () => {
      if (state.undo.length) {
        state.redo.push(snapshot());
        await restore(state.undo.pop());
      }
    };
  }

  if ($('#redoBtn')) {
    $('#redoBtn').onclick = async () => {
      if (state.redo.length) {
        state.undo.push(snapshot());
        await restore(state.redo.pop());
      }
    };
  }

  if ($('#zoomIn')) $('#zoomIn').onclick = () => setZoom(state.zoom + 0.1);
  if ($('#zoomOut')) $('#zoomOut').onclick = () => setZoom(state.zoom - 0.1);
  $('#zoomReset')?.addEventListener('click', () => fitCanvas());
  window.addEventListener('resize', fitCanvas);

  if (stage) {
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        setZoom(state.zoom + delta);
      }
    }, { passive: false });
  }

  function openExport() {
    $('#exportDialog')?.showModal();
  }
  if ($('#exportTop')) $('#exportTop').onclick = openExport;
  if ($('.modal-close')) $('.modal-close').onclick = () => $('#exportDialog')?.close();

  if ($('#shareBtn')) {
    $('#shareBtn').onclick = () => {
      navigator.clipboard?.writeText(location.href);
      showToast('Workspace URL copied');
    };
  }

  $('#copyClipboardBtn')?.addEventListener('click', () => {
    copyToClipboard();
    $('#exportDialog')?.close();
  });

  $$('.export-options button[data-format]').forEach((b) => {
    b.onclick = () => {
      const f = b.dataset.format;
      const name = ($('#docName')?.value || 'composition').replace(/[^a-z0-9-_]/gi, '-');
      if (f === 'pdf') {
        exportPdf();
      } else {
        const quality = f === 'jpg' ? 0.92 : 0.95;
        download(`${name}.${f}`, exportImage(f, quality));
      }
      $('#exportDialog')?.close();
      showToast(`${f.toUpperCase()} exported`);
    };
  });

  $('#closeInspector')?.addEventListener('click', () => {
    state.selected = null;
    $('#inspector')?.classList.remove('mobile-open');
    render();
    updateUI();
  });

  $('#toggleInspectorBtn')?.addEventListener('click', () => {
    $('#inspector')?.classList.toggle('mobile-open');
  });

  $('#toggleSidePanelBtn')?.addEventListener('click', () => {
    $('#sidePanel')?.classList.toggle('mobile-open');
  });

  $$('.mobile-nav-btn[data-target]').forEach((b) => {
    b.onclick = () => {
      const t = b.dataset.target;
      if (t === 'layers') {
        $(`.rail-button[data-panel="layers"]`)?.click();
      } else if (t === 'properties') {
        $('#inspector')?.classList.add('mobile-open');
      } else if (t === 'assets') {
        $(`.rail-button[data-panel="assets"]`)?.click();
      } else if (t === 'tools') {
        $(`.rail-button[data-panel="text"]`)?.click();
      }
    };
  });

  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) $('#redoBtn')?.click();
      else $('#undoBtn')?.click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      $('#redoBtn')?.click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelected();
      return;
    }

    if (isInput) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeSelected();
    } else if (e.key.toLowerCase() === 'v') {
      setActiveTool('select');
    } else if (e.key.toLowerCase() === 'h') {
      setActiveTool('hand');
    } else if (e.key.toLowerCase() === 'c') {
      setActiveTool('crop');
    } else if (e.key.toLowerCase() === 't') {
      addTextQuick('heading');
    } else if (e.key.toLowerCase() === 'r') {
      addShapeQuick('rect');
    } else if (e.key.toLowerCase() === 'o') {
      addShapeQuick('circle');
    } else if (e.key.toLowerCase() === 'i') {
      setActiveTool('eyedropper');
    } else if (e.key === 'Enter') {
      if (state.activeTool === 'crop' && state.cropState) {
        e.preventDefault();
        applyCrop();
      }
    } else if (e.key === 'Escape') {
      if (state.activeTool === 'crop') {
        cancelCrop();
        return;
      }
      state.selected = null;
      render();
      updateUI();
    } else if (e.key.startsWith('Arrow')) {
      const l = selectedLayer();
      if (l) {
        e.preventDefault();
        saveHistory();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') l.x -= step;
        else if (e.key === 'ArrowRight') l.x += step;
        else if (e.key === 'ArrowUp') l.y -= step;
        else if (e.key === 'ArrowDown') l.y += step;
        render();
        updateInspectorValues();
      }
    }
  });

  if ($('#helpBtn')) {
    $('#helpBtn').onclick = () => {
      showToast('Shortcuts: V (Move), H (Pan), C (Crop), T (Text), R (Rect), O (Circle), I (Picker), Ctrl+Z (Undo)');
    };
  }

  if ($('#newCanvasTop')) $('#newCanvasTop').onclick = createCanvas;
  if ($('#mobileNewCanvasBtn')) $('#mobileNewCanvasBtn').onclick = createCanvas;
  if ($('#deleteCanvasTop')) $('#deleteCanvasTop').onclick = () => deleteCanvas();

  function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('editor-dark', isDark);
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('editor-dark', isDark);
    localStorage.setItem('ihp-theme', isDark ? 'dark' : 'light');
    const btn = $('#themeBtn');
    if (btn) btn.textContent = isDark ? '☀' : '◐';
  }

  if ($('#themeBtn')) {
    $('#themeBtn').onclick = () => {
      const isDark = !document.body.classList.contains('editor-dark');
      applyTheme(isDark);
      showToast(isDark ? 'Dark theme enabled' : 'Light theme enabled');
    };
  }

  const savedTheme = localStorage.getItem('ihp-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (savedTheme === 'dark') applyTheme(true);

  // Initialize
  resizeCanvas();
  updateUI();
  renderCanvasTabs();
  storeCanvas();
}

// Auto-run if running in plain browser / HTML script tag
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('#editorCanvas')) initEditor();
    });
  } else {
    if (document.querySelector('#editorCanvas')) initEditor();
  }
}
