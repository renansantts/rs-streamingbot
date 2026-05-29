# Bot de Vendas Telegram - Modelo Zerado

Projeto limpo para configurar para um novo cliente.

## Arquivos limpos

- `.env` sem token e sem dados pessoais
- `database.json` sem produtos, sem estoque, sem usuários e sem pedidos
- Links de contato/grupo/perfil trocados por placeholders
- Histórico `.git` removido

## Preencher antes de subir

```env
BOT_TOKEN=token_do_botfather
ADMIN_ID=id_do_admin
MP_ACCESS_TOKEN=access_token_mercado_pago
WEBHOOK_URL=url_da_hospedagem/webhook
START_IMAGE_URL=link_da_imagem_inicial_opcional
SUPPORT_GROUP_URL=link_do_grupo_opcional
CONTACT_URL=link_de_contato_opcional
PORT=3000
```

## Rodar

```bash
npm install
npm start
```

## Discloud

Troque o nome no `discloud.config` para cada cliente:

```txt
NAME=bot-cliente
TYPE=bot
MAIN=index.js
RAM=128
```
