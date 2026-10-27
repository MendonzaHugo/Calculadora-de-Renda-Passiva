/*
 * Motor de cálculo da Calculadora de Renda Passiva.
 *
 * Toda a simulação é feita mês a mês e em valores REAIS (reais de hoje):
 * as taxas nominais informadas são convertidas em taxas reais descontando a
 * inflação. Para exibir valores nominais basta multiplicar pelo índice de
 * inflação acumulada do mês (ver `fatorNominal`).
 *
 * Funciona no navegador (window.Calc) e no Node (module.exports).
 */
(function (root) {
  'use strict';

  var IDADE_LIMITE = 100; // até onde procuramos a idade em que a meta é atingida

  var PADRAO = {
    idadeAtual: 30,
    idadeAposentadoria: 60,
    idadeFinal: 90,
    rendaDesejada: 3000,
    rendaAtual: 8000,
    economiaPct: 25,
    investimentoInicial: 0,
    crescimentoAporte: 4.5,
    rendAplicacoes: 10,
    rendPassiva: 8,
    inflacao: 4.5
  };

  function mensal(taxaAnual) {
    return Math.pow(1 + taxaAnual, 1 / 12) - 1;
  }

  // Taxa real anual a partir da nominal: (1 + nominal) / (1 + inflação) - 1
  function real(nominalPct, inflacaoPct) {
    return (1 + nominalPct / 100) / (1 + inflacaoPct / 100) - 1;
  }

  // Valor presente de `n` saques mensais de `w` à taxa mensal `i`.
  function valorPresenteSaques(w, i, n) {
    if (n <= 0) return 0;
    if (Math.abs(i) < 1e-12) return w * n;
    return w * (1 - Math.pow(1 + i, -n)) / i;
  }

  // Saque mensal que zera `p` em `n` meses à taxa mensal `i`.
  function saqueQueZera(p, i, n) {
    if (n <= 0) return 0;
    if (Math.abs(i) < 1e-12) return p / n;
    return p * i / (1 - Math.pow(1 + i, -n));
  }

  function normalizar(entrada) {
    var e = {};
    Object.keys(PADRAO).forEach(function (k) {
      var v = Number(entrada && entrada[k]);
      e[k] = isFinite(v) ? v : PADRAO[k];
    });
    e.idadeAposentadoria = Math.max(e.idadeAposentadoria, e.idadeAtual);
    e.idadeFinal = Math.max(e.idadeFinal, e.idadeAposentadoria);
    return e;
  }

  /*
   * Acumula aportes por `meses` meses. O aporte é feito no fim de cada mês e
   * é reajustado a cada 12 meses pelo crescimento real do aporte.
   * Retorna o patrimônio final e o histórico mês a mês (opcional).
   */
  function acumular(inicial, aporte0, taxaMes, crescRealAnual, meses, guardar) {
    var saldo = inicial, aporte = aporte0, hist = guardar ? [] : null;
    for (var m = 0; m < meses; m++) {
      if (m > 0 && m % 12 === 0) aporte *= 1 + crescRealAnual;
      var juros = saldo * taxaMes;
      saldo += juros + aporte;
      if (hist) hist.push({ aporte: aporte, juros: juros, saque: 0, saldo: saldo });
    }
    return { saldo: saldo, hist: hist, aporteFinal: aporte };
  }

  function simular(entrada) {
    var e = normalizar(entrada);
    var rAplic = real(e.rendAplicacoes, e.inflacao);
    var rPassiva = real(e.rendPassiva, e.inflacao);
    var crescReal = real(e.crescimentoAporte, e.inflacao);
    var iAplic = mensal(rAplic);
    var iPassiva = mensal(rPassiva);
    var iInflacao = mensal(e.inflacao / 100);

    var aporte0 = e.rendaAtual * e.economiaPct / 100;
    var mesesAcum = Math.round((e.idadeAposentadoria - e.idadeAtual) * 12);
    var mesesSaque = Math.round((e.idadeFinal - e.idadeAposentadoria) * 12);
    var w = e.rendaDesejada;

    // Metas (em reais de hoje)
    var metaPerpetua = iPassiva > 0 ? w / iPassiva : Infinity;
    var metaConsumo = valorPresenteSaques(w, iPassiva, mesesSaque);

    // Fase de acumulação + fase de saque (saca a renda desejada até a idade final)
    var acum = acumular(e.investimentoInicial, aporte0, iAplic, crescReal, mesesAcum, true);
    var meses = acum.hist.slice();
    var patrimonioAposentadoria = acum.saldo;
    var saldo = patrimonioAposentadoria, esgotaMes = null;
    for (var m = 0; m < mesesSaque; m++) {
      var juros = saldo * iPassiva;
      var saque = Math.min(w, saldo + juros);
      saldo = saldo + juros - saque;
      if (saldo <= 1e-6) saldo = 0;
      if (esgotaMes === null && saque < w - 1e-6) esgotaMes = mesesAcum + m;
      meses.push({ aporte: 0, juros: juros, saque: saque, saldo: saldo });
    }

    // Idade em que cada meta é atingida, continuando a aportar indefinidamente
    function idadeQueAtinge(meta) {
      if (!isFinite(meta)) return null;
      if (e.investimentoInicial >= meta) return e.idadeAtual;
      var s = e.investimentoInicial, a = aporte0;
      var limite = Math.round((IDADE_LIMITE - e.idadeAtual) * 12);
      for (var k = 0; k < limite; k++) {
        if (k > 0 && k % 12 === 0) a *= 1 + crescReal;
        s = s * (1 + iAplic) + a;
        if (s >= meta) return e.idadeAtual + (k + 1) / 12;
      }
      return null;
    }

    // Cálculo inverso: patrimônio na aposentadoria é linear no aporte inicial
    // P = inicial * F + aporte0 * K
    var F = Math.pow(1 + iAplic, mesesAcum);
    var K = acumular(0, 1, iAplic, crescReal, mesesAcum, false).saldo;
    function aporteNecessario(meta) {
      if (!isFinite(meta)) return null;
      var falta = meta - e.investimentoInicial * F;
      if (falta <= 0) return 0;
      return K > 0 ? falta / K : null;
    }

    // Por quanto tempo o patrimônio da aposentadoria sustenta a renda desejada
    var duraAteIdade;
    if (patrimonioAposentadoria >= metaPerpetua) duraAteIdade = Infinity;
    else {
      var s2 = patrimonioAposentadoria, k2 = 0;
      while (s2 > 0 && k2 < 12 * 200) { s2 = s2 * (1 + iPassiva) - w; k2++; }
      duraAteIdade = e.idadeAposentadoria + k2 / 12;
    }

    // Rendimento nominal do ano = variação do saldo nominal - aportes + saques
    // (inclui a correção pela inflação, que a visão real não mostra).
    function nominalDoAno(y, bloco, aporteN, saqueN) {
      var ini = y === 0 ? e.investimentoInicial : meses[y * 12 - 1].saldo * Math.pow(1 + iInflacao, y * 12);
      var fim = bloco[bloco.length - 1].saldo * Math.pow(1 + iInflacao, y * 12 + bloco.length);
      return { aporte: aporteN, juros: fim - ini - aporteN + saqueN, saque: saqueN };
    }

    // Agrega por ano de idade
    var anos = [], anoAtual = new Date().getFullYear();
    for (var y = 0; y * 12 < meses.length; y++) {
      var bloco = meses.slice(y * 12, y * 12 + 12);
      var fimIdx = y * 12 + bloco.length;
      var soma = function (campo, nominal) {
        return bloco.reduce(function (t, x, j) {
          return t + x[campo] * (nominal ? Math.pow(1 + iInflacao, y * 12 + j + 1) : 1);
        }, 0);
      };
      var fim = bloco[bloco.length - 1].saldo;
      anos.push({
        indice: y + 1,
        ano: anoAtual + y,
        idade: e.idadeAtual + y,
        idadeFim: e.idadeAtual + fimIdx / 12,
        fase: (y * 12) < mesesAcum ? 'Acumulação' : 'Renda',
        aporte: soma('aporte'),
        juros: soma('juros'),
        saque: soma('saque'),
        nominal: nominalDoAno(y, bloco, soma('aporte', true), soma('saque', true)),
        saldo: fim,
        rendaPerpetuaMensal: fim * iPassiva,
        pctMetaPerpetua: isFinite(metaPerpetua) ? fim / metaPerpetua : null,
        fatorNominal: Math.pow(1 + iInflacao, fimIdx)
      });
    }

    return {
      entrada: e,
      taxas: { aplicacoesReal: rAplic, passivaReal: rPassiva, crescimentoAporteReal: crescReal },
      aporteInicial: aporte0,
      aporteFinal: acum.aporteFinal,
      metaPerpetua: metaPerpetua,
      metaConsumo: metaConsumo,
      patrimonioAposentadoria: patrimonioAposentadoria,
      fatorNominalAposentadoria: Math.pow(1 + iInflacao, mesesAcum),
      rendaPerpetuaPossivel: patrimonioAposentadoria * iPassiva,
      rendaConsumoPossivel: saqueQueZera(patrimonioAposentadoria, iPassiva, mesesSaque),
      idadeMetaPerpetua: idadeQueAtinge(metaPerpetua),
      idadeMetaConsumo: idadeQueAtinge(metaConsumo),
      aporteNecessarioPerpetua: aporteNecessario(metaPerpetua),
      aporteNecessarioConsumo: aporteNecessario(metaConsumo),
      duraAteIdade: duraAteIdade,
      esgotaIdade: esgotaMes === null ? null : e.idadeAtual + esgotaMes / 12,
      meses: meses,
      anos: anos
    };
  }

  var api = {
    PADRAO: PADRAO,
    simular: simular,
    normalizar: normalizar,
    real: real,
    mensal: mensal,
    valorPresenteSaques: valorPresenteSaques,
    saqueQueZera: saqueQueZera
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
