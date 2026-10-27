/*
 * Gráfico de linhas em SVG, sem dependências, com crosshair e tooltip.
 *
 * Grafico.linhas(container, {
 *   x: [números],                         // eixo X compartilhado (idade)
 *   series: [{ nome, cor, valores, tracejado, rotulo }],
 *   faixa: { de, ate, nome },             // região sombreada opcional
 *   formatoY: fn, formatoX: fn, tituloTooltip: fn(x)
 * })
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(nome, attrs, pai) {
    var n = document.createElementNS(NS, nome);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  }

  // Passos "redondos" para o eixo Y
  function ticks(max, alvo) {
    if (!(max > 0)) return [0];
    var bruto = max / alvo, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    var passo = [1, 2, 2.5, 5, 10].map(function (m) { return m * pot; })
      .find(function (p) { return p >= bruto; });
    var out = [];
    for (var v = 0; v <= max + passo * 0.001; v += passo) out.push(v);
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + passo);
    return out;
  }

  function linhas(container, op) {
    container.innerHTML = '';
    var largura = Math.max(container.clientWidth, 280);
    var altura = largura < 560 ? 260 : 340;
    var m = { t: 12, r: 16, b: 28, l: largura < 560 ? 52 : 64 };
    var w = largura - m.l - m.r, h = altura - m.t - m.b;
    var xs = op.x, n = xs.length;
    if (!n) return;

    var maxY = 0;
    op.series.forEach(function (s) {
      s.valores.forEach(function (v) { if (isFinite(v) && v > maxY) maxY = v; });
    });
    var yt = ticks(maxY, altura < 300 ? 4 : 5), topo = yt[yt.length - 1] || 1;
    var x0 = xs[0], x1 = xs[n - 1] === x0 ? x0 + 1 : xs[n - 1];
    var px = function (x) { return m.l + (x - x0) / (x1 - x0) * w; };
    var py = function (y) { return m.t + h - Math.min(y, topo) / topo * h; };

    var svg = el('svg', { viewBox: '0 0 ' + largura + ' ' + altura, role: 'img', 'aria-label': op.descricao || 'Gráfico' }, container);

    if (op.faixa && op.faixa.ate > op.faixa.de) {
      el('rect', { x: px(op.faixa.de), y: m.t, width: px(op.faixa.ate) - px(op.faixa.de), height: h, fill: 'var(--fase-renda)' }, svg);
      var tf = el('text', { x: px(op.faixa.de) + 6, y: m.t + 14 }, svg);
      tf.textContent = op.faixa.nome;
    }

    yt.forEach(function (v) {
      el('line', { x1: m.l, x2: m.l + w, y1: py(v), y2: py(v), class: v === 0 ? 'baseline' : 'gridline' }, svg);
      var t = el('text', { x: m.l - 8, y: py(v) + 4, 'text-anchor': 'end' }, svg);
      t.textContent = op.formatoY(v, true);
    });

    var passoX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));
    passoX = [1, 2, 5, 10, 20].find(function (p) { return p >= passoX; }) || passoX;
    xs.forEach(function (x) {
      if (x % passoX !== 0) return;
      var t = el('text', { x: px(x), y: m.t + h + 18, 'text-anchor': 'middle' }, svg);
      t.textContent = op.formatoX(x);
    });

    op.series.forEach(function (s) {
      var d = '';
      s.valores.forEach(function (v, i) {
        if (!isFinite(v)) return;
        d += (d ? 'L' : 'M') + px(xs[i]).toFixed(1) + ' ' + py(v).toFixed(1);
      });
      if (!d) return;
      el('path', {
        d: d, fill: 'none', stroke: s.cor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.tracejado ? '6 4' : 'none'
      }, svg);
      if (s.rotulo && isFinite(s.valores[0]) && s.valores[0] <= topo) {
        var t = el('text', { x: m.l + 6, y: py(s.valores[0]) - 6, class: 'rotulo-direto' }, svg);
        t.textContent = s.rotulo;
      }
    });

    // Camada de hover
    var cross = el('line', { y1: m.t, y2: m.t + h, class: 'crosshair', visibility: 'hidden' }, svg);
    var pontos = op.series.map(function (s) {
      return el('circle', { r: 4, fill: s.cor, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
    });
    var area = el('rect', { x: m.l, y: m.t, width: w, height: h, fill: 'transparent' }, svg);
    var tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    container.appendChild(tip);

    function mover(ev) {
      var r = svg.getBoundingClientRect(), esc = largura / r.width;
      var cx = (ev.clientX - r.left) * esc;
      var i = Math.round((cx - m.l) / w * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var x = px(xs[i]);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      var html = '<div class="t-titulo">' + op.tituloTooltip(xs[i]) + '</div>';
      op.series.forEach(function (s, k) {
        var v = s.valores[i];
        if (isFinite(v)) {
          pontos[k].setAttribute('cx', x); pontos[k].setAttribute('cy', py(v)); pontos[k].setAttribute('visibility', 'visible');
        } else pontos[k].setAttribute('visibility', 'hidden');
        html += '<div class="t-linha"><span><i class="chip' + (s.tracejado ? ' tracejado' : '') + '" style="' +
          (s.tracejado ? 'border-color:' : 'background:') + s.cor + '"></i> ' + s.nome + '</span><b>' +
          (isFinite(v) ? op.formatoY(v) : '—') + '</b></div>';
      });
      tip.innerHTML = html;
      tip.hidden = false;
      var cr = container.getBoundingClientRect();
      var left = ev.clientX - cr.left + 14;
      if (left + tip.offsetWidth > cr.width) left = ev.clientX - cr.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, ev.clientY - cr.top - tip.offsetHeight / 2) + 'px';
    }
    function sair() {
      tip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      pontos.forEach(function (p) { p.setAttribute('visibility', 'hidden'); });
    }
    area.addEventListener('pointermove', mover);
    area.addEventListener('pointerdown', mover);
    area.addEventListener('pointerleave', sair);
  }

  root.Grafico = { linhas: linhas };
})(this);
