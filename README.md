# Vitrine Livre — Shopee Panel

**Site público:** https://perabru.github.io/shopee-panel/  
**Código:** https://github.com/perabru/shopee-panel

Crie uma vitrine pública de produtos da Shopee, usando seus próprios links de afiliado. Os visitantes compram **diretamente na Shopee**. Esta plataforma é independente, não é uma cópia oficial da Shopee e não processa compras.

## Uso simplificado

1. Entre com Google e abra **Adicionar**.
2. Cole o link ou a mensagem completa de **Compartilhar** da Shopee. O painel identifica o link, abre a página pelo serviço de leitura e tenta preencher nome, foto, preço e descrição automaticamente. Em mensagens reconhecidas, aproveita também o nome e o preço explícito.
3. Confira os dados e clique em **Salvar produto**. Preços aceitam `129,90`, `1.299,90` e `129.90`.
4. Em **Produtos**, use **Compartilhar**, **Copiar oferta** ou **Editar**. A mensagem contém nome, preço (se informado) e o link de afiliado original. O envio acontece no aplicativo escolhido pelo usuário.
5. Para divulgar toda a seleção, use o link da vitrine na tela **Início**. Vitrines privadas não ficam acessíveis a outros visitantes.

Se a foto não aparecer, tente **Buscar dados** novamente ou informe o endereço completo do produto em **Ajustar foto e outros detalhes**. Esse endereço serve para a busca e não substitui o link de afiliado. Outra alternativa é colar a URL HTTPS da própria imagem. Quando o serviço retornar várias fotos, escolha a correta na prévia.

A lista permite buscar produtos por nome ou categoria. Links idênticos não são cadastrados duas vezes. A edição preserva o registro e a data de criação; itens criados pela integração API mantêm suas ações de compartilhamento, mas a edição manual fica indisponível porque as regras atuais do banco não autorizam esse tipo de atualização.

## Instalar no Android e iOS

O site funciona primeiro no navegador, sem instalação obrigatória. O botão **Instalar app** usa a instalação nativa quando o navegador oferece essa opção.

- **Android:** abra no Chrome e toque em **Instalar app**; se necessário, use o menu do Chrome → **Instalar app / Adicionar à tela inicial**.
- **iPhone/iPad:** abra no Safari → **Compartilhar → Adicionar à Tela de Início**. Ative **Abrir como App da Web**, se a opção aparecer.
- **Computador:** Chrome e Edge podem oferecer instalação na barra de endereço.

Em navegadores Android compatíveis, depois da instalação a Vitrine Livre também pode aparecer no menu **Compartilhar** da Shopee. O link recebido abre um cadastro para revisão e nunca publica automaticamente. No iOS, copie e cole o link dentro do aplicativo.

O aplicativo inclui manifesto, ícones próprios, service worker e aviso de atualização. Ao atualizar, salve o formulário antes de confirmar o recarregamento. Sem conexão, uma tela específica explica como retornar; login, catálogo, busca de fotos e gravação de produtos precisam de internet. O cache contém somente arquivos públicos do aplicativo, sem respostas de autenticação, banco, API ou fotos remotas.

**O ID da loja não é necessário** para publicar links de afiliado já gerados. O link deve ter sido convertido pela Shopee: links comuns não passam a gerar comissão por serem cadastrados aqui. O Shopee Panel não recebe pagamentos.

### Como funciona o preenchimento pela URL

- Quando faltam dados e você tem **App ID + Secret da Open API de Afiliados conectados**, a Cloud Function opcional `previewProduct` busca **nome, imagem e preço** pelo `itemId` de uma URL oficial de produto, quando essa oferta consta no catálogo acessível à conta. Links curtos que não expõem o `itemId` podem não ser identificados pela API.
- A leitura da página usa [Microlink](https://microlink.io/api), com renderização de JavaScript, JSON-LD de produto, metadados e campos públicos identificados. Importa descrição, nome, fotos HTTPS e preço em reais quando disponíveis. Identifica URLs intermediárias `/opaanlp/` e consulta o endereço do produto correspondente, com no máximo duas leituras e 30 segundos no total. Não continua a consulta quando detecta login, verificação ou bloqueio. Essa consulta **envia a URL informada ao serviço de leitura**, sem login ou credenciais. O acesso gratuito possui limites.
- **Não há garantia de extração de toda URL**: alguns produtos só aparecem após login ou verificação da Shopee. A interface indica quais dos quatro campos foram preenchidos e permite completar os ausentes. Não considera IDs, mensagens de erro ou títulos de verificação como nomes de produtos. Não transforma parcelamento, desconto ou faixa de preços em preço único. Campos editados ou apagados pelo usuário permanecem sob seu controle.
- O sistema **não cria links de afiliado automaticamente sem a API autorizada**. Para link manual, redireciona para o **exato link informado** pelo usuário, sem acrescentar tracking artificial.

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
- Publicação de produtos com links de afiliado previamente convertidos pelo próprio usuário, com preenchimento automático dos dados disponíveis quando a loja e o serviço de leitura permitirem.
- Vitrine pública com visual de catálogo, busca interna, botão de compartilhamento nativo, WhatsApp e links **Comprar na Shopee**.

### Recursos avançados, opcionais

**Buscar produtos e prévias diretamente pela API dentro do Shopee Panel, gerar links automaticamente e visualizar comissões reais** exige conta de afiliado com **App ID e Secret da Open API da Shopee** e o deploy do backend Firebase Functions. Essas funções não são ativadas pelo login Google, pelo ID de loja ou pelo Realtime Database sozinho.

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

`index.html`, `styles.css`, `easy.css`, `product-page.js`, `product-tools.js` e `app.js` formam o site. `pwa.js`, `sw.js`, `manifest.webmanifest`, `offline.html` e `icons/` cuidam da instalação. Incremente `VERSION` em `sw.js` ao publicar novas alterações. `database.rules.json` são as regras de segurança do Realtime Database. `functions/` guarda a integração opcional assinada com a API da Shopee, incluindo `previewProduct` por `itemId`. `tests/` contém verificações automatizadas; execute `node --test tests/*.test.cjs` e `node --check app.js`.

O código armazena vitrines em `shopeePanel/v1/shops`, referências públicas em `shopeePanel/v1/publicShops`, produtos em `shopeePanel/v1/publicProducts`. As credenciais e relatórios ficam isolados por usuário e são escritos apenas pelo backend seguro. Nunca publique senhas.