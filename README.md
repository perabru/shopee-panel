# Vitrine Livre — Shopee Panel (Afiliados)

Aplicação **independente** para criação de vitrines públicas de afiliados. Cada usuário entra com Google, cria sua própria loja, adiciona produtos da Shopee e compartilha um link que leva os compradores diretamente à Shopee. O painel consulta comissões estimadas pela **Open API de Afiliados** quando o proprietário autoriza a integração.

Repositório: https://github.com/perabru/shopee-panel  
URL pública prevista após ativar o Pages: https://perabru.github.io/shopee-panel/

> **Não é uma cópia oficial da Shopee:** a plataforma não processa pagamentos, não representa vendedores, não acessa credenciais de login da Shopee e não afirma ter acesso a saldos sacáveis. A busca depende das ofertas que a API de Afiliados disponibilizar. Sem credenciais, é possível cadastrar *apenas links de afiliado já gerados pelo próprio usuário no portal Shopee*.

## Funcionalidades

- Login Google via Firebase Authentication (identifica o dono da vitrine, não vincula automaticamente Shopee).
- Uma vitrine pública por conta, acessível sem login por `#/loja/{uid}`.
- Pesquisa no catálogo de ofertas da API de Afiliados `productOfferV2` para usuários conectados.
- Publicação de produto/loja Shopee pela URL, gerando **link rastreável** pela mutation `generateShortLink` com credenciais do dono.
- Publicação manual com link já convertido pela própria Shopee para quem não possui acesso à API (não é possível verificar a atribuição do link manual).
- Listagem pública com imagens, preços informativos, categorias, pesquisa interna e redirecionamento para Shopee.
- Painel individual com total de produtos e relatórios de **comissões estimadas** dos últimos 7 ou 30 dias por `conversionReport`, quando a API estiver conectada.
- API secret criptografado individualmente com AES-256-GCM em Firestore, chave única gerenciada em Firebase Secret Manager. Nunca expõe credenciais em HTML/JS/GitHub.
- Regras de Firestore que deixam vitrines publicadas legíveis, restringem o restante e negam todo acesso de navegador às credenciais.
- Layout responsivo, português, sem dados de vendas fictícios ou coleta automatizada de páginas Shopee.

## O que precisa ser ativado uma única vez pelo administrador

### 1. GitHub Pages

1. Abra **Settings → Pages** neste repositório: https://github.com/perabru/shopee-panel/settings/pages
2. Escolha `Source → GitHub Actions`, salve.
3. Em **Actions**, reexecute o workflow **Publicar Vitrine Livre no GitHub Pages** caso seja necessário.
4. Verifique `https://perabru.github.io/shopee-panel/`.

O GitHub App conectado ao ChatGPT não tem permissão para ativar Pages no repositório, então essa etapa precisa ser feita no próprio GitHub. O workflow publica **apenas** `index.html`, `styles.css`, `app.js`, `icon.svg` e `manifest.webmanifest`; backend/segredos não vão para o Pages.

### 2. Firebase Authentication / Firestore

O código já usa o projeto Firebase fornecido: `gahepatama-4707c`. A configuração `apiKey` no front-end é o identificador público do Firebase, **não é o segredo da API Shopee**.

1. Console: https://console.firebase.google.com/project/gahepatama-4707c/overview
2. Em **Authentication → Sign-in method**, habilite **Google** e configure o e-mail de suporte solicitado pelo Firebase.
3. Em **Authentication → Settings → Authorized domains**, inclua `perabru.github.io`.
4. Em **Firestore Database**, crie o banco no modo de produção na região adequada.
5. Faça deploy das regras fornecidas no arquivo `firestore.rules`, a partir da CLI abaixo.

### 3. Firebase Cloud Functions e chave de criptografia

As Functions e o Secret Manager podem exigir o plano **Blaze** do Firebase, com faturamento habilitado. Um site apenas com GitHub Pages não pode executar chamadas assinadas à API Shopee sem expor os segredos.

No terminal do computador com Node.js instalado:

```bash
npm install -g firebase-tools
firebase login
# entre na pasta clonada deste repositório
cd shopee-panel
npm --prefix functions install
firebase use gahepatama-4707c
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# copie o valor gerado e cole QUANDO O COMANDO ABAIXO SOLICITAR (nunca no repositório):
firebase functions:secrets:set AFFILIATE_ENCRYPTION_KEY
firebase deploy --only functions,firestore:rules --project gahepatama-4707c
```

Guarde a chave de criptografia original em cofre seguro. Rotacioná-la sem migrar os registros impede a descriptografia das credenciais já salvas. As regras do Firestore bloqueiam qualquer escrita direta do navegador; os registros são geridos exclusivamente pelas Functions.

### 4. Conexão individual com a Shopee

1. O afiliado precisa ter conta ativa no Programa de Afiliados Shopee.
2. Acesse o [portal de afiliados](https://affiliate.shopee.com.br/open_api) e obtenha **App ID** e **Secret da Open API de Afiliados** conforme disponibilidade na conta. **Nunca solicite ou use a senha de login Shopee.**
3. No site, entre com Google → **Configurações → Conectar programa de afiliados**.
4. O backend faz uma chamada real assinada para validar as credenciais antes de salvá-las criptografadas.
5. Agora a busca, geração automática de links e consultas de comissões passam a ser autorizadas em nome do **afiliado conectado**.

**Não é possível associar automaticamente uma conta Shopee ao Google só pelo e-mail igual.** São sistemas de autenticação diferentes e não há credenciais de API na configuração Firebase enviada.

## Fluxo das vitrines

- Ao autenticar, o Firebase Auth fornece o UID e a Function `ensureStore` cria a vitrine pública vazia.
- Os dados públicos ficam em `shops/{uid}` e `shops/{uid}/products/{productId}`.
- Ao pesquisar, a Function `searchOffers` consulta a API usando as credenciais **daquele UID**.
- Ao publicar, `publishProduct` chama `generateShortLink` e armazena `affiliateUrl` e origem; sem API requer link próprio previamente convertido no portal.
- Os clientes veem a página `/#/loja/{uid}` sem login e clicam em `Comprar na Shopee` (HTTPS, com `rel=sponsored`).
- O painel privado consulta `conversionReport` sob demanda e identifica conversões que tenham SubId `shopeepanel` quando disponível.

## Sobre os valores no painel

O relatório mostrado é uma estimativa a partir de **conversões**, não um saldo de conta ou quantia disponível para retirada. Pedidos podem ser cancelados; a validação e os pagamentos dependem da Shopee. O relatório tem limite de paginação: se a consulta não puder percorrer todos os registros, o painel avisa que está parcial. Links adicionados manualmente sem os SubIds podem não aparecer como comissões da vitrine.

## Referência Shopee fornecida

Exemplo visual: https://shopee.com.br/q63ifc2_ce — endereço externo informado pelo usuário. Não foi associado automaticamente à titularidade de nenhuma conta; não é feita extração em massa nem cópia de anúncios dessa loja.

## Segurança e privacidade

- Cada proprietário administra apenas sua vitrine pelo Firebase UID validado no backend.
- A API Secret de cada usuário só é recebida em função HTTPS autenticada e armazenada com AES-256-GCM em `affiliateSecrets/{uid}`, com leituras negadas por regras públicas.
- O código do front-end nunca contém segredos de afiliados.
- `originUrl` e `affiliateUrl` somente podem ser URLs HTTPS em domínios Shopee permitidos; o sistema não aceita links arbitrários que redirecionem visitantes a sites desconhecidos.
- Compradores não fazem login Shopee pelo Vitrine Livre; são redirecionados ao site oficial Shopee.
- Imagens externas HTTPS são exibidas com política `no-referrer`; compradores devem verificar preços, cupons e estoque na Shopee.
- Para operação com muitos afiliados, avalie reforços de App Check, limites por usuário, políticas de privacidade, moderação de produtos e mecanismos de denúncia antes de divulgar amplamente.

## Referências

- [Central de Ajuda da Shopee — Como gerar links de afiliado](https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas)
- [Shopee Affiliate Open API Explorer](https://open-api.affiliate.shopee.com.br/explorer/v2) (acesso e endpoints dependem da conta)
- [Guia comunitário não oficial sobre assinatura e consultas](https://www.affiliateshopee.com.br/documentacao)

## Estrutura

```text
index.html                 Interface pública e login
styles.css                 Layout desktop/mobile
app.js                     Firebase Auth, vitrine, painel, busca, publicação
icon.svg                   Ícone original (não usa logotipo oficial Shopee)
manifest.webmanifest       Instalação PWA
firestore.rules            Acesso público/restrito por usuário
firebase.json / .firebaserc
functions/index.js         Funções autenticadas de afiliados e gestão
functions/affiliate-core.js  Validações, assinatura, criptografia e GraphQL
tests/affiliate-core.test.cjs Testes automatizados
.github/workflows/pages.yml  Publicação estática no GitHub Pages
```

Teste local:

```bash
npm --prefix functions test
# front-end: servidor HTTP local, mas habilite o domínio local no Firebase Auth para testar login.
python -m http.server 8080
```

**Status:** repositório e código podem ser publicados no GitHub, mas a operação real exige as etapas de configuração da Shopee Open API e implantação do Firebase acima. Nenhuma integração real foi testada sem credenciais.