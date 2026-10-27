(function () {
  'use strict';

  var CHAVE = 'calcRendaPassiva.v1';
  var MAX_GRAFICO = 6;
  var CORES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6'];
  var CAMPOS = Object.keys(Calc.PADRAO);

  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  var pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  var pct2 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function moeda(v) { return isFinite(v) ? brl.format(v) : '—'; }
  function moedaCurta(v) { return 'R$ ' + compacto.format(v); }
  function cor(nome) { return 'var(' + nome + ')'; }
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  function idadeTexto(idade) {
    if (idade === null || idade === undefined) return 'não atinge até os 100';
    if (idade === Infinity) return 'para sempre';
    var anos = Math.floor(idade + 1e-9), meses = Math.round((idade - anos) * 12);
    if (meses === 12) { anos++; meses = 0; }
    return anos + ' anos' + (meses ? ' e ' + meses + (meses === 1 ? ' mês' : ' meses') : '');
  }

  // ---------- Armazenamento ----------
  function cenariosIniciais() {
    var p = Calc.PADRAO, mk = function (nome, extra) {
      return { id: novoId(), nome: nome, dados: Object.assign({}, p, extra) };
    };
    return [
      mk('Base', {}),
      mk('Pessimista', { rendAplicacoes: 8, rendPassiva: 7 }),
      mk('Otimista', { rendAplicacoes: 12, rendPassiva: 9 })
    ];
  }
  function novoId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function carregar() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && Array.isArray(s.cenarios) && s.cenarios.length) return s;
    } catch (e) { /* armazenamento indisponível */ }
    var c = cenariosIniciais();
    return { cenarios: c, atualId: c[0].id };
  }
  function persistir() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
    catch (e) { avisar('Não foi possível salvar neste navegador. Use Exportar.', true); }
  }

  var estado = carregar();
  var modo = 'real';
  var sujo = false;
  var selecionados = {}; // id -> slot de cor
  estado.cenarios.slice(0, 3).forEach(function (c, i) { selecionados[c.id] = i; });

  function atual() {
    return estado.cenarios.find(function (c) { return c.id === estado.atualId; }) || estado.cenarios[0];
  }

  // ---------- Formulário ----------
  var form = $('#form');
  function lerForm() {
    var d = {};
    CAMPOS.forEach(function (k) {
      var v = parseFloat(String(form.elements[k].value).replace(',', '.'));
      d[k] = isFinite(v) ? v : Calc.PADRAO[k];
    });
    return d;
  }
  function preencherForm(d) {
    CAMPOS.forEach(function (k) { form.elements[k].value = d[k] !== undefined ? d[k] : Calc.PADRAO[k]; });
  }

  function popularSelect() {
    var sel = $('#cenario-select');
    sel.innerHTML = estado.cenarios.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.nome) + '</option>';
    }).join('');
    sel.value = estado.atualId;
    $('#cenario-nome').value = atual().nome;
  }

  function avisar(msg, erro) {
    var a = $('#aviso');
    a.textContent = msg;
    a.className = 'aviso' + (erro ? ' ruim' : '');
    clearTimeout(avisar.t);
    if (msg && !erro) avisar.t = setTimeout(function () { a.textContent = sujo ? 'Alterações não salvas' : ''; }, 2500);
  }
  function marcarSujo(v) {
    sujo = v;
    if (v) { $('#aviso').textContent = 'Alterações não salvas'; $('#aviso').className = 'aviso ruim'; }
  }

  // ---------- Renderização da simulação ----------
  var ultimo = null;

  function render() {
    var r = Calc.simular(lerForm());
    ultimo = r;
    var e = r.entrada, nominal = modo === 'nominal';
    var fApos = nominal ? r.fatorNominalAposentadoria : 1;

    $('#out-aporte').textContent = moeda(r.aporteInicial);
    $('#taxas-reais').innerHTML = 'Taxas reais: aplicações <b>' + pct2.format(r.taxas.aplicacoesReal) +
      '</b> · renda passiva <b>' + pct2.format(r.taxas.passivaReal) + '</b> · aporte <b>' +
      pct2.format(r.taxas.crescimentoAporteReal) + '</b> a.a.';
    $$('[data-idade-apos]').forEach(function (s) { s.textContent = e.idadeAposentadoria; });

    var alcancaP = r.idadeMetaPerpetua !== null && r.idadeMetaPerpetua <= e.idadeAposentadoria + 1e-9;
    var alcancaC = r.idadeMetaConsumo !== null && r.idadeMetaConsumo <= e.idadeAposentadoria + 1e-9;
    var pctMeta = isFinite(r.metaPerpetua) ? r.patrimonioAposentadoria / r.metaPerpetua : null;
    var sufixo = nominal ? ' (valor aos ' + e.idadeAposentadoria + ')' : ' (em reais de hoje)';

    $('#tiles').innerHTML = [
      tile('Meta: viver só dos juros', moeda(r.metaPerpetua * fApos),
        'Atinge aos <b class="' + (alcancaP ? 'ok' : 'ruim') + '">' + idadeTexto(r.idadeMetaPerpetua) + '</b>'),
      tile('Meta: consumir o patrimônio até os ' + e.idadeFinal, moeda(r.metaConsumo * fApos),
        'Atinge aos <b class="' + (alcancaC ? 'ok' : 'ruim') + '">' + idadeTexto(r.idadeMetaConsumo) + '</b>'),
      tile('Patrimônio aos ' + e.idadeAposentadoria + ' anos', moeda(r.patrimonioAposentadoria * fApos),
        pctMeta === null ? 'Taxa real da renda passiva ≤ 0' : pct.format(pctMeta) + ' da meta de viver só dos juros'),
      tile('Aporte mensal inicial', moeda(r.aporteInicial),
        (e.crescimentoAporte ? 'Cresce ' + pct.format(e.crescimentoAporte / 100) + ' ao ano' : 'Sem reajuste') +
        ' · último aporte ' + moeda(r.aporteFinal * fApos))
    ].join('');

    var falta = function (nec) {
      if (nec === null) return '<strong>—</strong>';
      var cls = nec <= r.aporteInicial + 0.5 ? 'ok' : 'ruim';
      var extra = e.rendaAtual > 0 ? ' <small>(' + pct.format(nec / e.rendaAtual) + ' da renda)</small>' : '';
      return '<strong class="' + cls + '">' + moeda(nec) + '/mês' + extra + '</strong>';
    };
    $('#inverso').innerHTML = '<div class="linhas">' +
      linha('Viver só dos juros', falta(r.aporteNecessarioPerpetua)) +
      linha('Consumindo até os ' + e.idadeFinal, falta(r.aporteNecessarioConsumo)) +
      linha('Seu aporte atual', '<strong>' + moeda(r.aporteInicial) + '/mês</strong>') +
      '</div>';

    var dura = r.duraAteIdade === Infinity ? 'para sempre'
      : (r.duraAteIdade >= e.idadeFinal ? 'até os ' + idadeTexto(r.duraAteIdade) : 'só até os ' + idadeTexto(r.duraAteIdade));
    $('#aposentadoria').innerHTML = '<div class="linhas">' +
      linha('Renda vivendo só dos juros', '<strong>' + moeda(r.rendaPerpetuaPossivel * fApos) + '/mês</strong>') +
      linha('Renda consumindo até os ' + e.idadeFinal, '<strong>' + moeda(r.rendaConsumoPossivel * fApos) + '/mês</strong>') +
      linha('Sacando ' + moeda(e.rendaDesejada * fApos) + '/mês, o dinheiro dura',
        '<strong class="' + (r.duraAteIdade >= e.idadeFinal ? 'ok' : 'ruim') + '">' + dura + '</strong>') +
      '</div><p class="nota">' + sufixo.trim() + '</p>';

    renderGraficoPrincipal(r);
    renderTabela(r);
  }

  function tile(rotulo, valor, det) {
    return '<div class="tile"><div class="rotulo">' + esc(rotulo) + '</div><div class="valor">' + valor +
      '</div><div class="det">' + det + '</div></div>';
  }
  function linha(a, b) { return '<div class="linha"><span>' + esc(a) + '</span>' + b + '</div>'; }

  function pontosPatrimonio(r, nominal) {
    var xs = [r.entrada.idadeAtual], ys = [r.entrada.investimentoInicial];
    r.anos.forEach(function (a) {
      xs.push(a.idade + 1);
      ys.push(a.saldo * (nominal ? a.fatorNominal : 1));
    });
    return { x: xs, y: ys };
  }

  function renderGraficoPrincipal(r) {
    var nominal = modo === 'nominal', e = r.entrada;
    var p = pontosPatrimonio(r, nominal);
    var fator = function (i) { return nominal ? (i === 0 ? 1 : r.anos[i - 1].fatorNominal) : 1; };
    var series = [
      { nome: 'Patrimônio', cor: cor('--series-1'), valores: p.y },
      { nome: 'Meta: só dos juros', cor: cor('--series-2'), tracejado: true, rotulo: 'Meta: só dos juros',
        valores: p.x.map(function (_, i) { return r.metaPerpetua * fator(i); }) },
      { nome: 'Meta: consumindo', cor: cor('--series-3'), tracejado: true, rotulo: 'Meta: consumindo',
        valores: p.x.map(function (_, i) { return r.metaConsumo * fator(i); }) }
    ];
    var box = $('#grafico-principal');
    var leg = box.previousElementSibling && box.previousElementSibling.classList.contains('legenda')
      ? box.previousElementSibling : null;
    if (!leg) { leg = document.createElement('div'); leg.className = 'legenda'; box.parentNode.insertBefore(leg, box); }
    leg.innerHTML = legenda(series);
    Grafico.linhas(box, {
      x: p.x, series: series,
      faixa: { de: e.idadeAposentadoria, ate: e.idadeFinal, nome: 'Aposentadoria' },
      formatoY: function (v, eixo) { return eixo ? moedaCurta(v) : moeda(v); },
      formatoX: function (x) { return x + ''; },
      tituloTooltip: function (x) { return x + ' anos · ' + (new Date().getFullYear() + x - e.idadeAtual); },
      descricao: 'Evolução do patrimônio por idade'
    });
  }

  function legenda(series) {
    return series.map(function (s) {
      return '<span><i class="chip' + (s.tracejado ? ' tracejado' : '') + '" style="' +
        (s.tracejado ? 'border-color:' : 'background:') + s.cor + '"></i>' + esc(s.nome) + '</span>';
    }).join('');
  }

  function renderTabela(r) {
    var nominal = modo === 'nominal';
    var marcoMeta = r.anos.findIndex(function (a) { return a.fase === 'Acumulação' && a.pctMetaPerpetua >= 1; });
    var primeiroRenda = r.anos.findIndex(function (a) { return a.fase === 'Renda'; });
    $('#tabela tbody').innerHTML = r.anos.map(function (a, i) {
      var f = nominal ? a.fatorNominal : 1;
      var fl = nominal ? a.nominal : a;
      var cls = [];
      if (i === marcoMeta || i === primeiroRenda) cls.push('marco');
      if (a.fase === 'Renda') cls.push('fase-renda');
      return '<tr class="' + cls.join(' ') + '"' + (i === marcoMeta ? ' title="Meta de viver só dos juros atingida"' : '') + '>' +
        '<td>' + a.ano + '</td><td>' + a.idade + '</td><td>' + a.fase + (i === marcoMeta ? ' ★' : '') + '</td>' +
        '<td>' + moeda(fl.aporte) + '</td><td>' + moeda(fl.juros) + '</td><td>' + moeda(fl.saque) + '</td>' +
        '<td>' + moeda(a.saldo * f) + '</td><td>' + moeda(a.rendaPerpetuaMensal * f) + '</td>' +
        '<td>' + (a.pctMetaPerpetua === null ? '—' : pct.format(a.pctMetaPerpetua)) + '</td></tr>';
    }).join('');
  }

  // ---------- Comparação ----------
  function renderComparar() {
    var resultados = estado.cenarios.map(function (c) { return { c: c, r: Calc.simular(c.dados) }; });
    $('#tabela-comparar tbody').innerHTML = resultados.map(function (x) {
      var r = x.r, e = r.entrada, slot = selecionados[x.c.id];
      var marca = slot !== undefined
        ? '<i class="chip" style="background:' + cor(CORES[slot]) + '"></i>' : '';
      return '<tr class="' + (x.c.id === estado.atualId ? 'atual' : '') + '">' +
        '<td><input type="checkbox" data-id="' + x.c.id + '"' + (slot !== undefined ? ' checked' : '') +
        ' aria-label="Mostrar ' + esc(x.c.nome) + ' no gráfico"></td>' +
        '<td>' + marca + ' ' + esc(x.c.nome) + '</td>' +
        '<td>' + moeda(r.aporteInicial) + '</td>' +
        '<td>' + e.rendAplicacoes + '%</td><td>' + e.rendPassiva + '%</td>' +
        '<td>' + moeda(r.metaPerpetua) + '</td><td>' + idadeTexto(r.idadeMetaPerpetua) + '</td>' +
        '<td>' + moeda(r.metaConsumo) + '</td><td>' + idadeTexto(r.idadeMetaConsumo) + '</td>' +
        '<td>' + moeda(r.patrimonioAposentadoria) + '</td><td>' + moeda(r.rendaPerpetuaPossivel) + '/mês</td></tr>';
    }).join('');

    var escolhidos = resultados.filter(function (x) { return selecionados[x.c.id] !== undefined; });
    var box = $('#grafico-comparar');
    if (!escolhidos.length) {
      box.innerHTML = '<p class="nota">Marque ao menos um cenário na tabela.</p>';
      $('#legenda-comparar').innerHTML = '';
      return;
    }
    var min = Math.min.apply(null, escolhidos.map(function (x) { return x.r.entrada.idadeAtual; }));
    var max = Math.max.apply(null, escolhidos.map(function (x) { return x.r.entrada.idadeFinal; }));
    var xs = [];
    for (var a = min; a <= max; a++) xs.push(a);
    var series = escolhidos.map(function (x) {
      var p = pontosPatrimonio(x.r, false), mapa = {};
      p.x.forEach(function (idade, i) { mapa[idade] = p.y[i]; });
      return {
        nome: x.c.nome, cor: cor(CORES[selecionados[x.c.id]]),
        valores: xs.map(function (idade) { return idade in mapa ? mapa[idade] : NaN; })
      };
    });
    $('#legenda-comparar').innerHTML = legenda(series);
    Grafico.linhas(box, {
      x: xs, series: series,
      formatoY: function (v, eixo) { return eixo ? moedaCurta(v) : moeda(v); },
      formatoX: function (x) { return x + ''; },
      tituloTooltip: function (x) { return x + ' anos'; },
      descricao: 'Patrimônio por cenário'
    });
  }

  $('#tabela-comparar').addEventListener('change', function (ev) {
    var id = ev.target.getAttribute('data-id');
    if (!id) return;
    if (ev.target.checked) {
      var usados = Object.keys(selecionados).map(function (k) { return selecionados[k]; });
      var livre = CORES.findIndex(function (_, i) { return usados.indexOf(i) < 0; });
      if (livre < 0) { ev.target.checked = false; avisar('Máximo de ' + MAX_GRAFICO + ' cenários no gráfico.', true); return; }
      selecionados[id] = livre;
    } else delete selecionados[id];
    renderComparar();
  });

  // ---------- Ações de cenário ----------
  function salvar(comoNovo) {
    var nome = $('#cenario-nome').value.trim() || 'Cenário sem nome';
    if (comoNovo) {
      if (nome === atual().nome) nome += ' (cópia)';
      var c = { id: novoId(), nome: nome, dados: lerForm() };
      estado.cenarios.push(c);
      estado.atualId = c.id;
      var usados = Object.keys(selecionados).map(function (k) { return selecionados[k]; });
      var livre = CORES.findIndex(function (_, i) { return usados.indexOf(i) < 0; });
      if (livre >= 0) selecionados[c.id] = livre;
    } else {
      atual().nome = nome;
      atual().dados = lerForm();
    }
    persistir();
    popularSelect();
    marcarSujo(false);
    avisar('Cenário "' + nome + '" salvo.');
  }

  $('#btn-salvar').addEventListener('click', function () { salvar(false); });
  $('#btn-novo').addEventListener('click', function () { salvar(true); });
  $('#btn-excluir').addEventListener('click', function () {
    if (estado.cenarios.length <= 1) { avisar('Mantenha ao menos um cenário.', true); return; }
    if (!confirm('Excluir o cenário "' + atual().nome + '"?')) return;
    delete selecionados[estado.atualId];
    estado.cenarios = estado.cenarios.filter(function (c) { return c.id !== estado.atualId; });
    estado.atualId = estado.cenarios[0].id;
    persistir();
    trocarPara(estado.atualId);
  });
  $('#cenario-select').addEventListener('change', function (ev) {
    if (sujo && !confirm('Descartar as alterações não salvas?')) { ev.target.value = estado.atualId; return; }
    trocarPara(ev.target.value);
  });

  function trocarPara(id) {
    estado.atualId = id;
    persistir();
    popularSelect();
    preencherForm(atual().dados);
    marcarSujo(false);
    avisar('');
    render();
    if (!$('#painel-comparar').hidden) renderComparar();
  }

  $('#btn-exportar').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ versao: 1, cenarios: estado.cenarios }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cenarios-renda-passiva.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('#arquivo-importar').addEventListener('change', function (ev) {
    var f = ev.target.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      var dados = JSON.parse(txt), lista = Array.isArray(dados) ? dados : dados.cenarios;
      if (!Array.isArray(lista) || !lista.length) throw new Error('vazio');
      var novos = lista.map(function (c) {
        return { id: novoId(), nome: String(c.nome || 'Importado').slice(0, 80), dados: Calc.normalizar(c.dados) };
      });
      estado.cenarios = estado.cenarios.concat(novos);
      persistir();
      trocarPara(novos[0].id);
      avisar(novos.length + ' cenário(s) importado(s).');
    }).catch(function () { avisar('Arquivo inválido.', true); });
    ev.target.value = '';
  });

  $('#btn-link').addEventListener('click', function () {
    var payload = { nome: $('#cenario-nome').value.trim() || atual().nome, dados: lerForm() };
    var url = location.href.split('#')[0] + '#c=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    var ok = function () { avisar('Link copiado. Quem abrir verá este cenário.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { prompt('Copie o link:', url); });
    else prompt('Copie o link:', url);
  });

  function lerLink() {
    var m = location.hash.match(/^#c=(.+)$/);
    if (!m) return false;
    try {
      var p = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      preencherForm(Calc.normalizar(p.dados));
      $('#cenario-nome').value = String(p.nome || 'Cenário do link').slice(0, 80);
      marcarSujo(true);
      avisar('Cenário aberto por link. Use "Salvar como novo" para guardá-lo.', true);
      history.replaceState(null, '', location.href.split('#')[0]);
      return true;
    } catch (e) { return false; }
  }

  // ---------- Abas e modo ----------
  $$('.aba').forEach(function (b) {
    b.addEventListener('click', function () {
      var alvo = b.getAttribute('data-aba');
      $$('.aba').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('ativa', on);
        x.setAttribute('aria-selected', on);
      });
      $('#painel-simulacao').hidden = alvo !== 'simulacao';
      $('#painel-comparar').hidden = alvo !== 'comparar';
      if (alvo === 'comparar') renderComparar(); else render();
    });
  });
  $$('.segmentado button').forEach(function (b) {
    b.addEventListener('click', function () {
      modo = b.getAttribute('data-modo');
      $$('.segmentado button').forEach(function (x) {
        x.classList.toggle('ativo', x === b);
        x.setAttribute('aria-checked', x === b);
      });
      render();
    });
  });

  form.addEventListener('input', function () { marcarSujo(true); render(); });
  form.addEventListener('submit', function (ev) { ev.preventDefault(); });

  var redim;
  window.addEventListener('resize', function () {
    clearTimeout(redim);
    redim = setTimeout(function () {
      if (!$('#painel-simulacao').hidden) render(); else renderComparar();
    }, 150);
  });

  // ---------- Início ----------
  popularSelect();
  preencherForm(atual().dados);
  lerLink();
  render();
})();
