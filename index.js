import 'dotenv/config'
import express from 'express'
import { Telegraf, Markup } from 'telegraf'
import mercadopago from 'mercadopago'
import fs from 'fs'

const BOT_TOKEN = process.env.BOT_TOKEN
const ADMIN_ID = String(process.env.ADMIN_ID || '')
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ''
const PORT = process.env.PORT || 3000
const START_IMAGE_URL = process.env.START_IMAGE_URL || 'https://i.ibb.co/fY5PQS1G/FOTO-DE-PERFIL-RS-STREAMING.jpg'
const SUPPORT_GROUP_URL = process.env.SUPPORT_GROUP_URL || 'https://chat.whatsapp.com/IuOQb614sFoEuPW6CNz6wX'
const CONTACT_URL = process.env.CONTACT_URL || 'https://t.me/SEU_USUARIO'
const STORE_NAME = process.env.STORE_NAME || 'RS STREAMING'
const DB_FILE = './database.json'

if (!BOT_TOKEN) {
  console.error('ERRO: coloque o BOT_TOKEN no arquivo .env')
  process.exit(1)
}

const bot = new Telegraf(BOT_TOKEN)
const app = express()
app.use(express.json())

function defaultDB() {
  return {
    users: {},
    products: [],
    combos: [],
    payments: {},
    sales: [],
    gifts: [],
    settings: {}
  }
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) saveDB(defaultDB())
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  db.users ||= {}
  db.products ||= []
  db.combos ||= []
  db.payments ||= {}
  db.sales ||= []
  db.gifts ||= []
  db.settings ||= {}
  return db
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

function money(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`
}

function isAdmin(ctx) {
  return String(ctx.from.id) === ADMIN_ID
}

function getUser(db, telegramId, ctx = null) {
  const id = String(telegramId)
  if (!db.users[id]) {
    db.users[id] = {
      id,
      name: ctx?.from?.first_name || 'Cliente',
      username: ctx?.from?.username || '',
      balance: 0,
      purchases: [],
      totalDepositos: 0,
      totalCompras: 0,
      qtdCompras: 0,
      totalAtividades: 0
    }
    saveDB(db)
  }
  return db.users[id]
}

function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎬 MENU PRINCIPAL', 'catalogo')],
    [Markup.button.callback('👤 PERFIL', 'perfil'), Markup.button.callback('💰 ADICIONAR SALDO', 'saldo')],
    [Markup.button.callback('🏆 RANKING', 'ranking')],
    [Markup.button.callback('👨‍💼 SUPORTE', 'suporte'), Markup.button.callback('📍 ALUGAR BOT', 'alugar')],
    [Markup.button.switchToCurrentChat('🔎 PESQUISAR SERVIÇO', '')]
  ])
}

function catalogoMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛒 Ver Todos os Produtos', 'ver_todos_produtos')],
    [Markup.button.callback('🎁 Combos', 'combos'), Markup.button.callback('🔥 Bônus diário', 'bonus_diario')],
    [Markup.button.callback('↩️ Voltar', 'inicio')]
  ])
}

function adminMenu() {
  return Markup.keyboard([
    ['📦 Adicionar Produto'],
    ['📥 Adicionar Estoque'],
    ['🎁 Adicionar Combo'],
    ['➕ Estoque Combo'],
    ['📋 Listar Combos'],
    ['🗑 Remover Combo'],
    ['🛒 Meus Pedidos / Vendas'],
    ['📋 Listar Produtos'],
    ['✏️ Editar Produto'],
    ['🗑 Remover Produto'],
    ['💰 Adicionar Saldo Manual'],
    ['👤 Ver Clientes'],
    ['👥 Afiliados'],
    ['📢 Enviar Aviso'],
    ['🎁 Gift Card'],
    ['📊 Estatísticas'],
    ['⚙️ Configurações'],
    ['🔙 Voltar']
  ]).resize()
}

async function sendHome(ctx) {
  const db = loadDB()
  const user = getUser(db, ctx.from.id, ctx)
  const text = `😍 Bem-vindo à melhor loja de streamings do Telegram! ✨\n🎬 Logins rápidos, seguros e pelo melhor preço!\n\n‼️ Não encontrou o login que procura?\nEntre em contato com nosso suporte, estamos à disposição para te ajudar! 😊\n\n📘 Seus Dados:\n🆔 ID: ${ctx.from.id}\n💰 Saldo Atual: ${money(user.balance)}\n🏆 Bônus De Indicação: R$ 0,00`

  try {
    return await ctx.replyWithPhoto({ url: 'https://i.ibb.co/fY5PQS1G/FOTO-DE-PERFIL-RS-STREAMING.jpg' }, { caption: text, ...mainMenu() })
  } catch {
    return ctx.reply(text, mainMenu())
  }
}

bot.start(sendHome)
bot.action('inicio', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return sendHome(ctx) })
bot.command('menu', (ctx) => ctx.reply('📦 Menu Principal\n\n🛒 Escolha uma opção abaixo:', catalogoMenu()))

bot.command(['adm', 'admin'], (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply(`❌ Você não tem permissão.\n\nSeu ID é: ${ctx.from.id}`)
  return ctx.reply('👑 PAINEL ADMIN\n\nEscolha uma opção abaixo:', adminMenu())
})

bot.action('catalogo', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  return ctx.reply('📦 Menu Principal\n\n🛒 Escolha uma opção abaixo:', catalogoMenu())
})

bot.action('ver_todos_produtos', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produtos = db.products.filter(p => p.stock?.length > 0)
  if (!produtos.length) return ctx.reply('❌ Nenhum produto com estoque disponível no momento.')
  const buttons = produtos.map(p => [Markup.button.callback(`${p.name.toUpperCase()} ${money(p.price)} (Qnt: ${p.stock.length})`, `produto_${p.id}`)])
  buttons.push([Markup.button.callback('⬅️ Retornar', 'catalogo')])
  return ctx.reply('Bem-vindo(a)! Escolha uma categoria abaixo para explorar nossos produtos.\n\n👇 Selecione uma opção:', Markup.inlineKeyboard(buttons))
})

bot.action(/produto_(.+)/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produto = db.products.find(p => p.id === ctx.match[1])
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  const user = getUser(db, ctx.from.id, ctx)
  return ctx.reply(`O MELHOR DO STREAMING EM UM SÓ LUGAR!\n\n🛒 ${produto.name.toUpperCase()}\n🔥 PREÇO: ${money(produto.price)}\n💵 SALDO: ${money(user.balance)}\n📊 ESTOQUE: ${produto.stock.length} UND`, Markup.inlineKeyboard([
    [Markup.button.callback('🛒 COMPRAR', `buy_${produto.id}`), Markup.button.callback('🛒 Comprar +1', `qtd_${produto.id}`)],
    [Markup.button.callback('📘 Detalhes do Login', `info_${produto.id}`), Markup.button.callback('🛒 Add Carrinho', `cart_${produto.id}`)],
    [Markup.button.callback('⬅️ Retornar', 'ver_todos_produtos')]
  ]))
})

bot.action(/info_(.+)/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produto = db.products.find(p => p.id === ctx.match[1])
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  return ctx.reply(`📘 DETALHES DO LOGIN\n\n🛒 Produto: ${produto.name.toUpperCase()}\n⏰ Duração: 30 dias\n📊 Estoque: ${produto.stock.length} UND\n\n✅ Entrega rápida após a compra\n🔁 Suporte e substituição garantida\n⚠️ Não altere dados da conta`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Retornar', `produto_${produto.id}`)]]))
})

function formatDelivery(entrega) {
  if (typeof entrega === 'string') return entrega
  return `📧 Login: ${entrega.email || ''}\n🔑 Senha: ${entrega.senha || ''}\n📺 Tela: ${entrega.tela || 'Acesso único'}${entrega.pin ? `\n⚠️ PIN: ${entrega.pin}` : ''}`
}

function registerSale(db, user, ctx, item, price, delivery) {
  user.balance -= Number(price)
  user.totalCompras = Number(user.totalCompras || 0) + Number(price)
  user.qtdCompras = Number(user.qtdCompras || 0) + 1
  user.totalAtividades = Number(user.totalAtividades || 0) + 1
  user.lastPurchaseDate = new Date().toDateString()
  user.purchases ||= []
  user.purchases.push({ product: item, price, delivery, date: new Date().toISOString() })
  db.sales.push({ userId: String(ctx.from.id), name: ctx.from.first_name || 'Cliente', product: item, price, delivery, date: new Date().toLocaleString('pt-BR') })
}

bot.action(/buy_(.+)/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produto = db.products.find(p => p.id === ctx.match[1])
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  if (!produto.stock?.length) return ctx.reply('❌ Produto sem estoque no momento.')
  const user = getUser(db, ctx.from.id, ctx)
  if (Number(user.balance) < Number(produto.price)) return ctx.reply(`❌ Saldo insuficiente.\n\n💰 Seu saldo: ${money(user.balance)}\n📦 Produto: ${produto.name}\n💵 Valor: ${money(produto.price)}`)
  const entrega = produto.stock.shift()
  registerSale(db, user, ctx, produto.name, produto.price, entrega)
  saveDB(db)

  await ctx.telegram.sendMessage(process.env.ADMIN_ID,
    `🚨 NOVA VENDA REALIZADA

👤 Cliente: ${ctx.from.first_name || 'Cliente'}
🆔 ID: ${ctx.from.id}

📦 Produto: ${produto.name}
💰 Valor: ${money(produto.price)}

🔐 Entrega:
${entrega.email || ''}
${entrega.senha || ''}
${entrega.tela || ''}
${entrega.pin || ''}

📅 Data: ${new Date().toLocaleString('pt-BR')}`
  )

return ctx.reply(`📦 COMPRA REALIZADA COM SUCESSO 📦

🛒 Produto: ${produto.name}
💰 Valor: ${money(produto.price)}
📅 Data da Compra: ${new Date().toLocaleString('pt-BR')}
⏳ Válido Até: ${new Date(Date.now() + 30 * 86400000).toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━
🔐 DADOS DE ACESSO

📧 Login: ${entrega.email || ''}
🔑 Senha: ${entrega.senha || ''}
📺 Tela: ${entrega.tela || 'Acesso único'}
⚠️ PIN: ${entrega.pin || 'Sem PIN'}

━━━━━━━━━━━━━━━
📱 REGRAS DE USO

⚠️ Uso permitido em apenas 1 dispositivo
⚠️ Não altere dados da conta
⚠️ Não crie perfil na conta

━━━━━━━━━━━━━━━
🛠️ SUPORTE

https://chat.whatsapp.com/IuOQb614sFoEuPW6CNz6wX

━━━━━━━━━━━━━━━
💙 Obrigado pela preferência!

RS STREAMING agradece sua compra 🤝`)
})
bot.action(/qtd_(.+)/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produto = db.products.find(p => p.id === ctx.match[1])
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  db.esperandoQtd ||= {}
  db.esperandoQtd[String(ctx.from.id)] = produto.id
  saveDB(db)
  return ctx.reply(`🛒 Quantos logins de ${produto.name.toUpperCase()} você deseja comprar?\n\n✍️ Digite apenas o número da quantidade.`)
})

bot.hears(/^\d+$/, async (ctx, next) => {
  const db = loadDB()
  const produtoId = db.esperandoQtd?.[String(ctx.from.id)]
  if (!produtoId) return next()
  const produto = db.products.find(p => p.id === produtoId)
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  const quantidade = Number(ctx.message.text)
  const user = getUser(db, ctx.from.id, ctx)
  const total = Number(produto.price) * quantidade
  if (produto.stock.length < quantidade) return ctx.reply('❌ Estoque insuficiente.')
  if (user.balance < total) return ctx.reply('❌ Saldo insuficiente.')
  const dataCompra = new Date()
  const validoAte = new Date(dataCompra.getTime() + 30 * 24 * 60 * 60 * 1000)

  user.balance -= total

  for (let i = 0; i < quantidade; i++) {
    const login = produto.stock.shift()

    registerSale(db, user, ctx, produto.name, produto.price, login)

    await ctx.reply(`📦 COMPRA REALIZADA COM SUCESSO 📦

🛒 Produto: ${produto.name}
💰 Valor: ${money(produto.price)}
📅 Data da Compra: ${dataCompra.toLocaleString('pt-BR')}
⏳ Válido Até: ${validoAte.toLocaleDateString('pt-BR')}

━━━━━━━━━━━━━━━
🔐 DADOS DE ACESSO

📧 Login: ${login.email || login.login || ''}
🔑 Senha: ${login.senha || login.password || ''}
📺 Tela: ${login.tela || 'Acesso único'}
⚠️ PIN: ${login.pin || 'Sem PIN'}

━━━━━━━━━━━━━━━
📱 REGRAS DE USO

⚠️ Uso permitido em apenas 1 dispositivo
⚠️ Não altere e nem remova os dados da conta
⚠️ Não crie perfil na conta
⚠️ Caso seja identificado mais de um aparelho, o acesso poderá ser removido sem aviso

━━━━━━━━━━━━━━━
🛠️ SUPORTE

⏰ Atendimento de 24H até 48H
📲 Grupo de suporte:
https://chat.whatsapp.com/IuOQb614sFoEuPW6CNz6wX

━━━━━━━━━━━━━━━
💙 Obrigado pela preferência!
A RS Streaming agradece sua compra 🤝`)
  }

  delete db.esperandoQtd[String(ctx.from.id)]
  saveDB(db)

  return ctx.reply(`💰 Saldo restante: ${money(user.balance)}`)
  saveDB(db)
  return ctx.reply(`✅ COMPRA REALIZADA\n\n📦 Produto: ${produto.name.toUpperCase()}\n${logins}\n💰 Saldo restante: ${money(user.balance)}`)
})

bot.action(/cart_(.+)/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const produto = db.products.find(p => p.id === ctx.match[1])
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  const user = getUser(db, ctx.from.id, ctx)
  user.cart ||= []
  user.cart.push({ id: produto.id, nome: produto.name, preco: produto.price })
  saveDB(db)
  const total = user.cart.reduce((s, item) => s + Number(item.preco), 0)
  const texto = user.cart.map((item, i) => `${i + 1}️⃣ ${item.nome}\n💰 Valor: ${money(item.preco)}`).join('\n\n')
  return ctx.reply(`🛒 CARRINHO DE COMPRAS\n\n${texto}\n\n💵 TOTAL: ${money(total)}`, Markup.inlineKeyboard([
    [Markup.button.callback('🧹 Limpar Carrinho', 'limpar_carrinho')],
    [Markup.button.callback('⬅️ Voltar', 'voltar_menu')]
  ]))
})

bot.action('limpar_carrinho', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const user = getUser(db, ctx.from.id, ctx)
  user.cart = []
  saveDB(db)
  return ctx.reply('✅ Carrinho limpo.')
})

bot.action('combos', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const combos = db.combos.filter(c => c.stock?.length > 0)
  if (!combos.length) return ctx.reply('🎁 Nossos combos especiais:\n\n❌ Nenhum combo disponível no momento', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Retornar', 'catalogo')]]))
  const buttons = combos.map(c => [Markup.button.callback(`🔥 ${c.name} • ${money(c.price)}`, `buy_combo_${c.id}`)])
  buttons.push([Markup.button.callback('⬅️ Retornar', 'catalogo')])
  return ctx.reply('🎁 Nossos combos especiais:', Markup.inlineKeyboard(buttons))
})

bot.action(/^buy_combo_(.+)$/, async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const combo = db.combos.find(c => c.id === ctx.match[1])
  if (!combo) return ctx.reply('❌ Combo não encontrado.')
  if (!combo.stock?.length) return ctx.reply('❌ Combo sem estoque.')
  const user = getUser(db, ctx.from.id, ctx)
  if (user.balance < combo.price) return ctx.reply(`❌ Saldo insuficiente.\n\n💰 Valor do combo: ${money(combo.price)}\n💵 Seu saldo: ${money(user.balance)}`)
  const entrega = combo.stock.shift()
  registerSale(db, user, ctx, combo.name, combo.price, entrega)
  saveDB(db)
  return ctx.reply(`✅ Compra realizada com sucesso!\n\n📦 COMBO:\n${combo.name}\n\n💰 Valor pago: ${money(combo.price)}\n\n🔐 Dados:\n${entrega}\n\n🕒 Aproveite seu combo!`)
})

bot.action('perfil', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const user = getUser(db, ctx.from.id, ctx)
  return ctx.reply(`✌️ OLÁ, ${STORE_NAME}!\nAqui estão os detalhes da sua conta:\n\n👤 DADOS DO USUÁRIO\n├ Nome: ${ctx.from.first_name || 'Cliente'}\n├ Username: @${ctx.from.username || 'semuser'}\n└ ID: ${ctx.from.id}\n\n💰 CARTEIRA\n├ Saldo disponível: ${money(user.balance)}\n├ Total recarregado (PIX): ${money(user.totalDepositos)}\n└ Total gasto em compras: ${money(user.totalCompras)}\n\n📈 RESUMO DE ATIVIDADES\n├ Total de compras: ${user.qtdCompras || 0}\n└ Gifts resgatados: ${money(user.totalGifts || 0)}\n\n🏆 AFILIADOS\n├ Pessoas indicadas: 0\n└ Seu link:\nhttps://t.me/rs_streaming_bot?start=${ctx.from.id}`, Markup.inlineKeyboard([[Markup.button.callback('↩️ Voltar', 'inicio')]]))
})

bot.action('suporte', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  return ctx.reply(`🛠 SUPORTE ${STORE_NAME}\n\n⏰ Atendimento: 24H\n\n📲 ENTRE NO GRUPO DE SUPORTE:\n${SUPPORT_GROUP_URL}\n\n⚠ Após entrar no grupo:\n• Marque o ADM\n• Envie seu problema\n• Envie print do erro`)
})

bot.action('alugar', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  return ctx.reply(`🤖 QUER UM BOT DE VENDAS IGUAL A ESTE?\n\nAlugue seu próprio Bot de Vendas totalmente automatizado para Telegram.\n\n🛒 Loja automática\n💰 Recarga via PIX\n📦 Entrega automática\n👥 Sistema de afiliados\n🏆 Ranking\n🎁 Gift Cards\n📋 Painel ADM\n\n📞 Para contratar clique abaixo.`, Markup.inlineKeyboard([[Markup.button.url('📲 ENTRAR EM CONTATO', 'https://wa.me/5591992239663')], [Markup.button.callback('⬅️ Voltar', 'inicio')]]))
})

bot.action('ranking', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  return ctx.reply('📊 Selecione o tipo de ranking que deseja visualizar:', Markup.inlineKeyboard([
    [Markup.button.callback('🟢 Top Saldo', 'rank_saldo'), Markup.button.callback('🟢 Top Depósitos', 'rank_depositos')],
    [Markup.button.callback('🟢 Compras', 'rank_compras'), Markup.button.callback('🟢 Mais Ativos', 'rank_ativos')],
    [Markup.button.callback('⬅️ Voltar', 'inicio')]
  ]))
})

function topRanking(db, campo, emoji, textoValor) {
  const ranking = Object.values(db.users).sort((a, b) => Number(b[campo] || 0) - Number(a[campo] || 0)).slice(0, 10)
  if (!ranking.length || Number(ranking[0][campo] || 0) === 0) return '❌ Ainda não há dados nesse ranking.'
  return ranking.map((u, i) => `🟢 TOP ${i + 1}\n👤 ${u.name || u.username || 'Cliente'}\n${emoji} ${textoValor}: ${campo.includes('qtd') || campo.includes('Atividades') ? Number(u[campo] || 0) : money(u[campo] || 0)}`).join('\n\n')
}

bot.action('rank_saldo', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; const db = loadDB(); return ctx.reply(`🏆 TOP SALDO\n\n${topRanking(db, 'balance', '💰', 'Saldo')}`) })
bot.action('rank_depositos', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; const db = loadDB(); return ctx.reply(`🏦 TOP DEPÓSITOS\n\n${topRanking(db, 'totalDepositos', '💵', 'Total depositado')}`) })
bot.action('rank_compras', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; const db = loadDB(); return ctx.reply(`🛍️ TOP COMPRAS\n\n${topRanking(db, 'totalCompras', '🛒', 'Total comprado')}`) })
bot.action('rank_ativos', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; const db = loadDB(); return ctx.reply(`🔥 MAIS ATIVOS\n\n${topRanking(db, 'totalAtividades', '⚡', 'Atividades')}`) })

bot.action('bonus_diario', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  const db = loadDB()
  const user = getUser(db, ctx.from.id, ctx)
  const hoje = new Date().toDateString()
  if (user.lastBonus === hoje) return ctx.reply('❌ Você já resgatou o bônus hoje.')
  if (user.lastPurchaseDate !== hoje && user.lastRechargeDate !== hoje) return ctx.reply('❌ Você ainda não cumpriu as tarefas de hoje:\n\n❌ Fazer pelo menos 1 compra ou 1 recarga no dia.')
  user.balance += 1
  user.lastBonus = hoje
  saveDB(db)
  return ctx.reply(`✅ Bônus diário resgatado!\n\n💰 Você ganhou R$1,00\n💵 Saldo atual: ${money(user.balance)}`)
})

bot.hears('📦 Adicionar Produto', (ctx) => isAdmin(ctx) ? ctx.reply('📦 ENVIE:\n\n/addproduto Nome|Valor\n\nExemplo:\n/addproduto Netflix Premium|15') : ctx.reply('❌ Sem permissão.'))
bot.command('addproduto', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [nome, valorTxt] = ctx.message.text.replace('/addproduto', '').trim().split('|')
  const valor = Number((valorTxt || '').replace(',', '.'))
  if (!nome || !valor) return ctx.reply('❌ Use: /addproduto Nome|Valor')
  const produto = { id: Date.now().toString(), name: nome.trim(), price: valor, stock: [] }
  db.products.push(produto)
  saveDB(db)
  return ctx.reply(`✅ PRODUTO ADICIONADO\n\n📦 Nome: ${produto.name}\n💰 Valor: ${money(produto.price)}\n🆔 ID: ${produto.id}`)
})

bot.hears('📥 Adicionar Estoque', (ctx) => isAdmin(ctx) ? ctx.reply('📥 Para adicionar estoque:\n\n/estoque Nome do Produto|Email|Senha|Tela|PIN\n\nExemplo:\n/estoque Netflix Premium|email@teste.com|senha123|Tela 1|1234') : ctx.reply('❌ Sem permissão.'))
bot.command('estoque', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const linhas = ctx.message.text.replace('/estoque', '').trim().split('\n').filter(Boolean)
  let adicionados = 0
  let produtoNome = ''
  for (const linha of linhas) {
    const [nome, email, senha, tela = 'Acesso único', pin = ''] = linha.split('|').map(v => v?.trim())
    if (!nome || !email || !senha) continue
    const produto = db.products.find(p => p.name.toLowerCase().trim() === nome.toLowerCase().trim() || p.id === nome)
    if (!produto) continue
    produto.stock ||= []
    produto.stock.push({ email, senha, tela, pin })
    produtoNome = produto.name
    adicionados++
  }
  saveDB(db)
  return ctx.reply(`✅ ESTOQUE ADICIONADO\n\n📦 Produto: ${produtoNome || 'Não encontrado'}\n📥 Adicionados agora: ${adicionados}`)
})

bot.hears('📋 Listar Produtos', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  if (!db.products.length) return ctx.reply('❌ Nenhum produto cadastrado.')
  const msg = db.products.map(p => `🆔 ID: ${p.id}\n📦 Produto: ${p.name}\n💰 Valor: ${money(p.price)}\n📦 Estoque: ${p.stock?.length || 0}`).join('\n\n')
  return ctx.reply(`📋 LISTA DE PRODUTOS\n\n${msg}`)
})

bot.hears('✏️ Editar Produto', (ctx) => isAdmin(ctx) ? ctx.reply('✏️ Para editar produto:\n\n/editarproduto ID|Novo Nome|Novo Valor') : ctx.reply('❌ Sem permissão.'))
bot.command('editarproduto', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [id, name, priceText] = ctx.message.text.replace('/editarproduto', '').trim().split('|')
  const produto = db.products.find(p => p.id === id?.trim())
  if (!produto) return ctx.reply('❌ Produto não encontrado.')
  produto.name = name.trim()
  produto.price = Number(priceText.replace(',', '.'))
  saveDB(db)
  return ctx.reply(`✅ Produto editado: ${produto.name}`)
})

bot.hears('🗑 Remover Produto', (ctx) => isAdmin(ctx) ? ctx.reply('🗑 Para remover produto:\n\n/removerproduto ID') : ctx.reply('❌ Sem permissão.'))
bot.command('removerproduto', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const id = ctx.message.text.replace('/removerproduto', '').trim()
  const index = db.products.findIndex(p => p.id === id)
  if (index === -1) return ctx.reply('❌ Produto não encontrado.')
  const removido = db.products.splice(index, 1)[0]
  saveDB(db)
  return ctx.reply(`✅ Produto removido: ${removido.name}`)
})

bot.hears('🎁 Adicionar Combo', (ctx) => isAdmin(ctx) ? ctx.reply('🎁 ENVIE:\n\n/addcombo Nome|Valor\n\nExemplo:\n/addcombo Netflix + Disney|18') : ctx.reply('❌ Sem permissão.'))
bot.command('addcombo', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [nome, valorTxt] = ctx.message.text.replace('/addcombo', '').trim().split('|')
  const valor = Number((valorTxt || '').replace(',', '.'))
  if (!nome || !valor) return ctx.reply('❌ Use: /addcombo Nome|Valor')
  const combo = { id: Date.now().toString(), name: nome.trim(), price: valor, stock: [] }
  db.combos.push(combo)
  saveDB(db)
  return ctx.reply(`✅ COMBO ADICIONADO\n\n🆔 ID: ${combo.id}\n📦 Combo: ${combo.name}\n💰 Valor: ${money(combo.price)}`)
})

bot.hears('➕ Estoque Combo', (ctx) => isAdmin(ctx) ? ctx.reply('➕ ENVIE:\n\n/estoquecombo ID|LOGIN\n\nExemplo:\n/estoquecombo 123456|Produto: email senha') : ctx.reply('❌ Sem permissão.'))
bot.command('estoquecombo', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [id, ...resto] = ctx.message.text.replace('/estoquecombo', '').trim().split('|')
  const combo = db.combos.find(c => c.id === id?.trim())
  if (!combo) return ctx.reply('❌ Combo não encontrado.')
  combo.stock.push(resto.join('|').trim())
  saveDB(db)
  return ctx.reply(`✅ ESTOQUE ADICIONADO\n\n📦 Combo: ${combo.name}\n📥 Estoque atual: ${combo.stock.length}`)
})

bot.hears('📋 Listar Combos', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  if (!db.combos.length) return ctx.reply('❌ Nenhum combo cadastrado.')
  const msg = db.combos.map(c => `🆔 ${c.id}\n📦 ${c.name}\n💰 ${money(c.price)}\n📥 Estoque: ${c.stock?.length || 0}`).join('\n\n')
  return ctx.reply(`🎁 COMBOS CADASTRADOS\n\n${msg}`)
})

bot.hears('🗑 Remover Combo', (ctx) => isAdmin(ctx) ? ctx.reply('🗑 ENVIE:\n\n/removercombo ID') : ctx.reply('❌ Sem permissão.'))
bot.command('removercombo', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const id = ctx.message.text.replace('/removercombo', '').trim()
  const index = db.combos.findIndex(c => c.id === id)
  if (index === -1) return ctx.reply('❌ Combo não encontrado.')
  const removido = db.combos.splice(index, 1)[0]
  saveDB(db)
  return ctx.reply(`✅ COMBO REMOVIDO\n\n📦 ${removido.name}`)
})

bot.hears('💰 Adicionar Saldo Manual', (ctx) => isAdmin(ctx) ? ctx.reply('💰 Para adicionar saldo:\n\n/saldo ID VALOR\n\nExemplo:\n/saldo 123456789 20') : ctx.reply('❌ Sem permissão.'))
bot.command('saldo', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [, userId, valorTxt] = ctx.message.text.split(' ')
  const valor = Number((valorTxt || '').replace(',', '.'))
  if (!userId || !valor) return ctx.reply('❌ Use: /saldo ID VALOR')
  db.users[userId] ||= { id: userId, balance: 0, purchases: [] }
  db.users[userId].balance = Number(db.users[userId].balance || 0) + valor
  saveDB(db)
  return ctx.reply(`✅ Saldo adicionado: ${money(valor)}`)
})

bot.hears('👤 Ver Clientes', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const users = Object.values(db.users)
  if (!users.length) return ctx.reply('❌ Nenhum cliente cadastrado.')
  return ctx.reply('👤 CLIENTES:\n\n' + users.map((u, i) => `${i + 1}. ID: ${u.id}\n💰 Saldo: ${money(u.balance || 0)}`).join('\n\n'))
})

bot.hears('🛒 Meus Pedidos / Vendas', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  if (!db.sales.length) return ctx.reply('❌ Nenhuma venda realizada ainda.')
  return ctx.reply('🛒 VENDAS REALIZADAS:\n\n' + db.sales.slice(-30).map((v, i) => `${i + 1}. ${v.product}\n👤 Cliente: ${v.userId}\n💰 Valor: ${money(v.price)}\n📅 Data: ${v.date}`).join('\n\n'))
})

bot.hears('👥 Afiliados', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  return ctx.reply(`👥 SISTEMA DE AFILIADOS\n\n👤 Clientes cadastrados: ${Object.keys(db.users).length}\n💰 Comissão padrão: 35%\n📌 Sistema base ativo.`)
})

bot.hears('📢 Enviar Aviso', (ctx) => isAdmin(ctx) ? ctx.reply('📢 Para enviar aviso:\n\n/aviso Sua mensagem aqui') : ctx.reply('❌ Sem permissão.'))
bot.command('aviso', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const mensagem = ctx.message.text.replace('/aviso', '').trim()
  if (!mensagem) return ctx.reply('❌ Use: /aviso Sua mensagem')
  let enviados = 0
  for (const id of Object.keys(db.users)) {
    try { await ctx.telegram.sendMessage(id, `📢 AVISO DA LOJA\n\n${mensagem}`); enviados++ } catch { }
  }
  return ctx.reply(`✅ Aviso enviado para ${enviados} cliente(s).`)
})

bot.hears(/Gift Card/i, (ctx) => isAdmin(ctx) ? ctx.reply('🎁 Para criar Gift Card:\n\n/gift CODIGO VALOR\n\nExemplo:\n/gift RS50 50\n\nCliente resgata com:\n/resgatar RS50') : ctx.reply('❌ Sem permissão.'))
bot.command('gift', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const [, codigoRaw, valorTxt] = ctx.message.text.split(' ')
  const codigo = codigoRaw?.toUpperCase()
  const valor = Number((valorTxt || '').replace(',', '.'))
  if (!codigo || !valor) return ctx.reply('❌ Use: /gift CODIGO VALOR')
  if (db.gifts.find(g => g.code === codigo)) return ctx.reply('❌ Esse Gift Card já existe.')
  db.gifts.push({ code: codigo, value: valor, used: false, createdAt: new Date().toLocaleString('pt-BR') })
  saveDB(db)
  return ctx.reply(`✅ Gift Card criado!\n\n🎁 Código: ${codigo}\n💰 Valor: ${money(valor)}`)
})

bot.command('resgatar', (ctx) => {
  const db = loadDB()
  const codigo = ctx.message.text.replace('/resgatar', '').trim().toUpperCase()
  const gift = db.gifts.find(g => g.code === codigo)
  if (!gift) return ctx.reply('❌ Gift Card inválido.')
  if (gift.used) return ctx.reply('❌ Esse Gift Card já foi usado.')
  const user = getUser(db, ctx.from.id, ctx)
  user.balance += Number(gift.value)
  user.totalGifts = Number(user.totalGifts || 0) + Number(gift.value)
  gift.used = true
  gift.usedBy = String(ctx.from.id)
  gift.usedAt = new Date().toLocaleString('pt-BR')
  saveDB(db)
  return ctx.reply(`✅ GIFT CARD RESGATADO!\n\n🎁 Código: ${gift.code}\n💰 Valor recebido: ${money(gift.value)}\n💵 Saldo atual: ${money(user.balance)}`)
})

bot.hears('📊 Estatísticas', (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('❌ Sem permissão.')
  const db = loadDB()
  const totalVendido = db.sales.reduce((s, v) => s + Number(v.price || 0), 0)
  return ctx.reply(`📊 ESTATÍSTICAS\n\n📦 Produtos: ${db.products.length}\n🎁 Combos: ${db.combos.length}\n👤 Clientes: ${Object.keys(db.users).length}\n🛒 Vendas: ${db.sales.length}\n💰 Total vendido: ${money(totalVendido)}\n🎁 Gift Cards: ${db.gifts.length}`)
})

bot.hears('⚙️ Configurações', (ctx) => isAdmin(ctx) ? ctx.reply(`⚙️ CONFIGURAÇÕES\n\n🏪 Loja: ${STORE_NAME}\n💳 Pagamento: Mercado Pago\n🚀 Entrega: Automática\n🎁 Gift Card: Ativo\n🕒 Suporte: 24h`) : ctx.reply('❌ Sem permissão.'))
bot.hears('🔙 Voltar', (ctx) => ctx.reply('🏠 Menu principal', mainMenu()))

bot.action('saldo', async (ctx) => {
  try { await ctx.answerCbQuery() } catch { }
  return ctx.reply('Pagamento apenas por PIX.\n- Mínimo: R$2,00 | Máximo: R$150,00.', Markup.inlineKeyboard([
    [Markup.button.callback('R$ 10', 'pix_10'), Markup.button.callback('R$ 20', 'pix_20')],
    [Markup.button.callback('R$ 50', 'pix_50'), Markup.button.callback('R$ 100', 'pix_100')],
    [Markup.button.callback('⌨️ Digitar Outro Valor', 'pix_custom')],
    [Markup.button.callback('⬅️ Retornar', 'inicio')]
  ]))
})

async function gerarPix(ctx, valor) {
  if (!MP_ACCESS_TOKEN) return ctx.reply('❌ Mercado Pago ainda não configurado. Coloque o MP_ACCESS_TOKEN no .env')
  try {
    await ctx.reply(`⏳ Gerando PIX de ${money(valor)}, aguarde...`)
    const client = new mercadopago.MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN })
    const payment = new mercadopago.Payment(client)
    const pagamento = await payment.create({
      body: {
        transaction_amount: Number(valor),
        description: `Recarga ${STORE_NAME}`,
        payment_method_id: 'pix',
        notification_url: process.env.WEBHOOK_URL,
        external_reference: String(ctx.from.id),
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        payer: { email: `cliente${ctx.from.id}@email.com` }
      }
    })
    const db = loadDB()
    db.payments[String(pagamento.id)] = { userId: String(ctx.from.id), amount: Number(valor), status: 'pending' }
    saveDB(db)
    const pix = pagamento.point_of_interaction?.transaction_data
    return ctx.replyWithPhoto({ source: Buffer.from(pix.qr_code_base64, 'base64') }, { caption: `✅ PIX GERADO COM SUCESSO\n\n⏰ Expira em: 30 minutos\n💵 Valor: ${money(valor)}\n✨ ID da compra: ${pagamento.id}\n\n💎 PIX COPIA E COLA:\n\n<pre>${pix.qr_code}</pre>\n\n🚀 Após o pagamento ser aprovado, seu saldo será liberado automaticamente.`, parse_mode: 'HTML' })
  } catch (erro) {
    console.log(erro)
    return ctx.reply('❌ Erro ao gerar PIX. Confira o token do Mercado Pago.')
  }
}

bot.action('pix_10', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return gerarPix(ctx, 10) })
bot.action('pix_20', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return gerarPix(ctx, 20) })
bot.action('pix_50', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return gerarPix(ctx, 50) })
bot.action('pix_100', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return gerarPix(ctx, 100) })
bot.action('pix_custom', async (ctx) => { try { await ctx.answerCbQuery() } catch { }; return ctx.reply('💰 Digite o valor que deseja adicionar.\n\nExemplos:\n5\n10\n20\n50') })

bot.hears(/^(\d+([.,]\d{1,2})?)$/, async (ctx, next) => {
  const db = loadDB()
  if (db.esperandoQtd?.[String(ctx.from.id)]) return next()
  const valor = Number(ctx.message.text.replace(',', '.'))
  if (valor < 2) return ctx.reply('❌ Valor mínimo: R$2,00')
  if (valor > 150) return ctx.reply('❌ Valor máximo: R$150,00')
  return gerarPix(ctx, valor)
})

async function checkAndCreditPayment(paymentId, ctx = null) {
  const db = loadDB()
  const localPayment = db.payments[String(paymentId)]
  if (!localPayment) {
    if (ctx) await ctx.reply('Pagamento não encontrado no banco local.')
    return
  }
  if (localPayment.status === 'approved') {
    if (ctx) await ctx.reply('Esse pagamento já foi creditado.')
    return
  }
  const client = new mercadopago.MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN })
  const paymentClient = new mercadopago.Payment(client)
  const paymentInfo = await paymentClient.get({ id: paymentId })
  const payment = paymentInfo.body || paymentInfo
  if (payment.status === 'approved') {
    const user = getUser(db, localPayment.userId)
    user.balance += Number(localPayment.amount)
    user.totalDepositos = Number(user.totalDepositos || 0) + Number(localPayment.amount)
    user.totalAtividades = Number(user.totalAtividades || 0) + 1
    user.lastRechargeDate = new Date().toDateString()
    localPayment.status = 'approved'
    saveDB(db)
    await bot.telegram.sendMessage(process.env.ADMIN_ID,
      `💰 NOVO DEPÓSITO

👤 Cliente: ${user.name || 'Cliente'}
🆔 ID: ${localPayment.userId}

💵 Valor: ${money(localPayment.amount)}

📅 Data: ${new Date().toLocaleString('pt-BR')}`
    )
    const msg = `✅ Pagamento aprovado!\n💰 Saldo adicionado: ${money(localPayment.amount)}\n💳 Saldo atual: ${money(user.balance)}`
    if (ctx) await ctx.reply(msg)
    else await bot.telegram.sendMessage(localPayment.userId, msg)
  } else if (ctx) {
    await ctx.reply(`⏳ Pagamento ainda está: ${payment.status}`)
  }
}

bot.command('check', async (ctx) => {
  const paymentId = ctx.message.text.split(' ')[1]
  if (!paymentId) return ctx.reply('Digite assim: /check ID_DO_PAGAMENTO')
  return checkAndCreditPayment(paymentId, ctx)
})

app.post(['/webhook', '/webhook/mercadopago'], async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.id
    if (paymentId) await checkAndCreditPayment(String(paymentId))
    return res.sendStatus(200)
  } catch (error) {
    console.log(error)
    return res.sendStatus(200)
  }
})

bot.on('inline_query', async (ctx) => {
  const db = loadDB()
  const query = ctx.inlineQuery.query.toLowerCase()
  if (!query) return
  const encontrados = db.products.filter(p => p.stock?.length > 0 && p.name.toLowerCase().includes(query))
  const results = encontrados.map((p, i) => ({
    type: 'article',
    id: String(i),
    title: p.name,
    description: `Valor: ${money(p.price)} | Estoque: ${p.stock.length}`,
    input_message_content: { message_text: `🛍️ Produto: ${p.name}\n\n💰 Valor: ${money(p.price)}\n📦 Estoque: ${p.stock.length}\n\n⏳ Duração: 30 dias` }
  }))
  return ctx.answerInlineQuery(results, { cache_time: 0 })
})

app.get('/', (req, res) => res.send(`Bot ${STORE_NAME} online`))

bot.launch()
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
