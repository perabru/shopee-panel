# Vitrine Livre — Shopee Panel

**Site público:** https://perabru.github.io/shopee-panel/  
**Código:** https://github.com/perabru/shopee-panel

Crie uma vitrine pública de produtos da Shopee, usando seus próprios links de afiliado. Os visitantes compram **diretamente na Shopee**. Esta plataforma é independente, não é uma cópia oficial da Shopee e não processa compras.

## Comece sem complicação

1. Abra o site e clique em **Entrar com Google**. A vitrine é criada automaticamente.
2. No portal da Shopee Afiliados, gere seu **link de afiliado** de um produto ou loja. O guia oficial é [Como gerar seus links](https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas). No aplicativo procure **Afiliados → Conta → Link de Conversão**; no computador, **Portal de Afiliados → Oferta → Link Personalizado**.
3. Volte ao Shopee Panel em **Adicionar produto**. Informe apenas **nome** e **seu link de afiliado**. Imagem, preço e descrição são opcionais.
4. Copie **Meu link público** no painel e compartilhe onde quiser. Visitantes não precisam entrar com Google.

**Pronto. Para usar a vitrine básica você não precisa do ID da loja, App ID, Secret ou Cloud Functions.** O link precisa ter sido convertido de verdade pela Shopee em sua conta de afiliado: um link comum não garante comissão e o Shopee Panel não adiciona parâmetros fictícios para simular rastreamento.

## Onde encontrar o ID da loja Shopee?

No site, abra **Onde acho o ID da loja?** no menu superior ou, depois do login, **Minha loja → Como encontrar o ID da loja**. Há um verificador que você pode usar colando seu link oficial.

1. Entre na Shopee, acesse o **perfil da loja** e copie o endereço com **Compartilhar → Copiar link**.
2. Cole o endereço no **verificador do Shopee Panel**. Quando a URL contiver explicitamente `/shop/123456789` ou `?shopid=123456789`, ele pode mostrar o ID numérico `123456789`.
3. Se o endereço for `https://shopee.com.br/q63ifc2_ce`, `q63ifc2_ce` é apenas o **nome de usuário do perfil**: o ID numérico **não pode ser inferido com segurança desse link**. Mesmo assim, você já pode usá-lo no campo **Link da loja Shopee** em Minha loja.
4. Caso seja indispensável ter o ID numérico, entre na [Central do Vendedor](https://seller.shopee.com.br), procure **Perfil da Loja → Visualizar minha loja** e confira a URL. Nem todos os links mostram o número; se necessário, consulte o suporte oficial.

**São coisas diferentes:**

| Informação | Para que serve | É obrigatória? |
|---|---|---|
| **Link da loja / nome de usuário** | Mostrar uma referência à loja Shopee | Não |
| **ID numérico da loja (Shop ID)** | Identificar uma loja de vendedor em integrações específicas | **Não**, para criar uma vitrine |
| **Link de afiliado** | Enviar o comprador à Shopee com o rastreamento que você gerou | **Sim**, para divulgar com atribuição de afiliado |
| **App ID + Secret da Open API** | Busca integrada, conversão automática e relatórios por backend | Apenas para funções avançadas |
| **ID de afiliado** | Identifica a conta de afiliado no programa, não a loja do vendedor | Não é o Shop ID |

Não digite sua senha normal da Shopee no nosso site. O login com Gmail identifica você no **Shopee Panel**, mas não vincula automaticamente sua conta Shopee.

## Primeira configuração do Firebase (administrador)

O front-end já usa a configuração pública informada do projeto `gahepatama-4707c`, com dados em `shopeePanel/v1` no **Realtime Database**, não no Cloud Firestore.

**Google:** [Firebase Authentication](https://console.firebase.google.com/project/gahepatama-4707c/authentication/providers) → habilite provedor **Google**, escolha e-mail de suporte e autorize o domínio **`perabru.github.io`** em *Authentication → Settings → Authorized domains*.

**Banco:** [Firebase Realtime Database](https://console.firebase.google.com/project/gahepatama-4707c/database) → **Regras / Rules** → use as regras em [`database.rules.json`](./database.rules.json), depois clique **Publicar**. **Atenção:** caso este Realtime Database também pertença a outros sistemas, não substitua todas as regras sem antes mesclar os caminhos deles; nosso aplicativo utiliza somente `shopeePanel/v1`. Não use regras globais `".read": true, ".write": true`.

**GitHub Pages:** a raiz da branch `main` é publicada pelo GitHub Pages (Settings → Pages). O GitHub Pages hospeda HTML/CSS/JavaScript, mas não executa backend seguro da API Shopee.

### O que funciona sem API

- Login Google e vitrine criada automaticamente, após as regras do banco e Authentication estarem ativos.
- Nome e descrição da vitrine, link de referência Shopee e botão para deixá-la pública/privada.
- Publicação de produtos com links de afiliado previamente convertidos pelo próprio usuário.
- Vitrine aberta a qualquer visitante, pesquisa interna e links **Comprar na Shopee**.

### Recursos avançados, opcionais

**Buscar produtos diretamente pela API dentro do Shopee Panel, gerar links automaticamente e visualizar comissões reais** exige conta de afiliado com **App ID e Secret da Open API da Shopee** e o deploy do backend Firebase Functions. Essas funções não são ativadas pelo login Google, pelo ID de loja ou pelo Realtime Database sozinho.

No portal [Shopee Afiliados — Open API](https://affiliate.shopee.com.br/open_api), verifique se seu cadastro tem acesso e obtenha o App ID e o Secret. Esses dados devem ser inseridos apenas no formulário autenticado da seção **Minha loja → Integração avançada**, depois de ativar o backend. **Não exponha credenciais no GitHub, no front-end ou nas regras do Firebase.**

Para um administrador que optar pela integração, é necessário Firebase plano Blaze com faturamento e execução das Functions. No terminal com Node.js e Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
git clone https://github.com/perabru/shopee-panel.git
cd shopee-panel
npm --prefix functions install
firebase use gahepatama-4707c
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Armazene o valor aleatório em lugar seguro; configure como segredo no comando abaixo.
firebase functions:secrets:set AFFILIATE_ENCRYPTION_KEY
firebase deploy --only functions --project gahepatama-4707c
```

**Comissões:** sem API o painel mostra `—`, nunca um saldo inventado. Mesmo com API, os valores são **estimativas de conversões**, não saldo disponível para saque. Consulte pagamentos e valores finais no portal oficial da Shopee.

## Arquivos principais

`index.html`, `styles.css` e `app.js` formam o site. `database.rules.json` são as regras de segurança do Realtime Database. `functions/` guarda a integração opcional assinada com a API da Shopee. `tests/` contém verificações automatizadas; execute `node --test tests/*.test.cjs` e `node --check app.js`.

O código armazena vitrines em `shopeePanel/v1/shops`, referências públicas em `shopeePanel/v1/publicShops`, produtos em `shopeePanel/v1/publicProducts`. As credenciais e relatórios ficam isolados por usuário e são escritos apenas pelo backend seguro. Nunca publique senhas.