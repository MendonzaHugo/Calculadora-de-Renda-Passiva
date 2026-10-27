const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../calc.js');

const perto = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('sem inflação e sem crescimento, bate com a fórmula de valor futuro', () => {
  const r = Calc.simular({ idadeAtual: 30, idadeAposentadoria: 40, idadeFinal: 40,
    rendaAtual: 10000, economiaPct: 10, investimentoInicial: 5000,
    crescimentoAporte: 0, rendAplicacoes: 12, rendPassiva: 8, inflacao: 0 });
  const i = Math.pow(1.12, 1 / 12) - 1, n = 120;
  const fv = 5000 * Math.pow(1 + i, n) + 1000 * (Math.pow(1 + i, n) - 1) / i;
  perto(r.patrimonioAposentadoria, fv);
});

test('meta perpétua sustenta a renda para sempre', () => {
  const r = Calc.simular(Calc.PADRAO);
  const i = Calc.mensal(r.taxas.passivaReal);
  perto(r.metaPerpetua * i, Calc.PADRAO.rendaDesejada);
});

test('meta com consumo zera exatamente na idade final', () => {
  const base = { ...Calc.PADRAO };
  const r = Calc.simular(base);
  const i = Calc.mensal(r.taxas.passivaReal);
  let s = r.metaConsumo;
  for (let k = 0; k < (base.idadeFinal - base.idadeAposentadoria) * 12; k++) s = s * (1 + i) - base.rendaDesejada;
  perto(s, 0, 1e-6);
});

test('aporte necessário calculado atinge a meta na aposentadoria', () => {
  const r = Calc.simular(Calc.PADRAO);
  for (const [aporte, meta] of [[r.aporteNecessarioPerpetua, r.metaPerpetua], [r.aporteNecessarioConsumo, r.metaConsumo]]) {
    const r2 = Calc.simular({ ...Calc.PADRAO, rendaAtual: aporte, economiaPct: 100 });
    perto(r2.patrimonioAposentadoria, meta, 1e-9);
  }
});

test('investimento inicial suficiente dispensa aportes', () => {
  const r = Calc.simular({ ...Calc.PADRAO, investimentoInicial: 1e8 });
  assert.strictEqual(r.aporteNecessarioPerpetua, 0);
  assert.strictEqual(r.idadeMetaPerpetua, Calc.PADRAO.idadeAtual);
  assert.strictEqual(r.duraAteIdade, Infinity);
});

test('crescimento do aporte igual à inflação mantém o aporte real constante', () => {
  const r = Calc.simular({ ...Calc.PADRAO, crescimentoAporte: 4.5, inflacao: 4.5 });
  perto(r.aporteFinal, r.aporteInicial);
});

test('patrimônio insuficiente se esgota antes da idade final', () => {
  const r = Calc.simular({ ...Calc.PADRAO, economiaPct: 1 });
  assert.ok(r.esgotaIdade !== null && r.esgotaIdade < Calc.PADRAO.idadeFinal);
  assert.ok(Math.abs(r.duraAteIdade - r.esgotaIdade) < 0.1);
  assert.strictEqual(r.anos[r.anos.length - 1].saldo, 0);
});

test('tabela anual cobre da idade atual até a idade final', () => {
  const r = Calc.simular(Calc.PADRAO);
  assert.strictEqual(r.anos.length, Calc.PADRAO.idadeFinal - Calc.PADRAO.idadeAtual);
  assert.strictEqual(r.anos[0].idade, 30);
  assert.strictEqual(r.anos[29].fase, 'Acumulação');
  assert.strictEqual(r.anos[30].fase, 'Renda');
});

test('fluxos nominais fecham com o saldo nominal', () => {
  const r = Calc.simular(Calc.PADRAO);
  let saldo = Calc.PADRAO.investimentoInicial;
  for (const a of r.anos) {
    saldo += a.nominal.aporte + a.nominal.juros - a.nominal.saque;
    perto(saldo, a.saldo * a.fatorNominal, 1e-9);
  }
});
