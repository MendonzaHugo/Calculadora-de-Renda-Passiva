# Calculadora de Renda Passiva

App web (HTML + JavaScript puro, sem dependências) para projetar a aposentadoria
a partir de aportes mensais. Baseado na planilha "Cálculo de Renda Passiva".

## Como usar

Abra o `index.html` no navegador. Não precisa instalar nada.
O arquivo `calculadora-renda-passiva.html` é a mesma calculadora num único arquivo, para baixar e abrir direto.
Para publicar, ative o GitHub Pages no repositório (Settings → Pages → branch principal, pasta raiz).

## O que calcula

- **Duas metas**, em reais de hoje:
  - **Viver só dos juros**: patrimônio que paga a renda desejada sem consumir o principal.
  - **Consumir o patrimônio**: patrimônio que paga a renda desejada até a idade final e chega a zero.
- **Idade em que cada meta é atingida**, mantendo os aportes.
- **Quanto aportar por mês** para atingir cada meta na idade de aposentadoria (cálculo inverso).
- **Fase de saque**: o que o patrimônio projetado permite de renda e até quando dura.
- **Tabela ano a ano** e gráfico, em reais de hoje ou nominais.
- **Cenários**: salve quantos quiser (vêm 3 prontos: Base, Pessimista, Otimista) e compare lado a lado.

## Premissas do modelo

- Simulação mês a mês; aporte no fim de cada mês, reajustado a cada 12 meses pelo crescimento informado.
- Taxas informadas são nominais anuais e convertidas para reais: `(1 + nominal) / (1 + inflação) − 1`.
- Não considera imposto de renda nem taxas.

## Diferenças em relação à planilha original

- A planilha somava o aporte do ano inteiro no início do ano (superestima um pouco); aqui é mensal.
- A aba "Página2" usava o rendimento da renda passiva (7,5%) na fase de acumulação, no lugar do
  rendimento das aplicações (10%).
- A planilha não descontava a inflação, o que faz a meta parecer bem mais próxima do que é.

## Cenários e família

Os cenários ficam salvos no navegador de cada aparelho. Para levar a outro aparelho ou compartilhar:
**Exportar/Importar** (arquivo JSON com todos os cenários) ou **Copiar link** (link com o cenário atual).

## Testes

```
npm test
```
