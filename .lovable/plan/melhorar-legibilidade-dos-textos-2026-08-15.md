# Melhorar legibilidade dos textos

## Contexto confirmado
Tema único escuro (não há modo claro); todos os tokens vivem em `:root` do `src/styles.css`.
Medição real no navegador (landing):
- Texto secundário `text-muted-foreground` = `oklch(0.71 0.02 245)`, peso 400.
- Descrições de card em 14px, legendas em 12px, eixos de gráfico em 11px — tudo nesse cinza.
- Contraste sobre o card (`oklch(0.213)`) ≈ 6.8:1; sobre o fundo ≈ 7.35:1. Passa AA, mas é o tom usado em praticamente toda descrição/legenda/hint, deixando a leitura "lavada" e cansativa.

## Mudanças (todas em `src/styles.css` — fonte única, afeta todas as rotas)

1. **Clarear o texto secundário** (maior impacto):
   `--muted-foreground: oklch(0.71 0.02 245)` → `oklch(0.83 0.02 245)`
   - Contraste sobe de ~6.8:1 para ~10.6:1 sobre os cards.
   - Continua claramente abaixo do `--foreground` (0.96), mantendo a hierarquia.
   - Aplica-se automaticamente a descrições, hints, legendas, rótulos de eixo e nav.

2. **Clarear o texto de superfícies secundárias**:
   `--secondary-foreground: oklch(0.94 0.006 240)` → `oklch(0.97 0.006 240)` (pequeno ganho de nitidez em chips/badges).

3. **Tipografia base mais confortável** (camada `@layer base`):
   - `body { font-size: 16px; line-height: 1.6 }` (garante base não inferior a 16px e entrelinhas folgados).
   - `:where(p, li, dd) { line-height: 1.65 }` — parágrafos e listas respiram melhor.
   - `-webkit-font-smoothing: antialiased` já existe; manter.

4. **Legibilidade de texto pequeno em gráficos** (dashboard):
   - Eixos `fontSize={11}` → `12` e legenda `12` → `13` (contraste já melhorado pelo item 1).

## Fora de escopo
- Não alterar a paleta base (fundo/cards) nem a identidade "instrumento de medição".
- Não mexer em componentes individuais além dos eixos de gráfico; o token clareado já cobre o restante.
- Sem trocar de tema nem adicionar modo claro.

## Verificação
- Reabrir a landing e o dashboard, confirmar descrições/legendas claramente legíveis.
- Checar que a hierarquia (título branco > texto secundário) permanece.
