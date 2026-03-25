# Estatísticas Wallflower — GitHub Pages

Versão 100% estática do painel, pronta para GitHub Pages.

## Publicar

1. Suba estes arquivos para um repositório no GitHub.
2. Em **Settings > Pages**, escolha:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (ou a branch que você usar)
   - **Folder**: `/ (root)`
3. Salve.
4. Aguarde alguns minutos para a URL pública aparecer.

## Atualizar dados

Troque o arquivo `data/lancer_stats_long.json` por uma versão nova e faça push.
O site refletirá a mudança quando o GitHub Pages republicar.

## Estrutura

- `index.html`
- `static/css/styles.css`
- `static/js/dashboard.js`
- `data/lancer_stats_long.json`
