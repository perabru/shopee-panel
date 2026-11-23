# Shopee Studio — painel de gestão da Shopee

Interface independente no repositório perabru/shopee-panel (HTML/CSS/JavaScript), autenticação Firebase, OAuth Shopee Open Platform, dashboard, produtos, pedidos, valores pendentes e liberados, rascunhos, imagens e publicação de itens. Responsivo e com tema claro/escuro.

**Estado da entrega:** o front-end é estático e funciona em modo de demonstração sem credenciais; as funções reais dependem da implantação do backend, da aprovação das permissões e das credenciais Shopee Open Platform. A autorização dada ao assistente não emite Partner ID nem Partner Key da Shopee nem ativa um plano de faturamento no Firebase.

## Estrutura

- `index.html`, `styles.css`, `app.js` — interface estática na raiz do repositório, compatível com GitHub Pages; o `app.js` usa a configuração Firebase Web `gahepatama-4707c` fornecida pelo proprietário.
- `functions/index.js` — Cloud Functions v2 em JavaScript: OAuth, refresh token, HMAC de cada requisição, financeiro, pedidos, produtos e publicação.
- `functions/shopee-core.js` — validações, assinatura, criptografia AES-256-GCM.
- `tests/shopee-core.test.cjs` — testes automatizados.
- `firestore.rules.example` — regras **para incorporar às regras existentes**, sem substituir as regras de outros projetos.

## Publicação no GitHub Pages

Este projeto mora **exclusivamente** em [perabru/shopee-panel](https://github.com/perabru/shopee-panel/). O site está na raiz do repositório; endereço previsto: **https://perabru.github.io/shopee-panel/**.

No GitHub, entre em [Settings → Pages](https://github.com/perabru/shopee-panel/settings/pages), selecione **Deploy from a branch**, branch `main`, pasta `/(root)`, e salve. Como alternativa, selecione a fonte **GitHub Actions**; `.github/workflows/pages.yml` publica somente os cinco arquivos estáticos do site após cada push.

**Atenção:** colocar arquivos no GitHub não ativa automaticamente o GitHub Pages. O backend Shopee também não roda no Pages; ele precisa ser implantado separadamente no Firebase.

## Configurar o Firebase (etapa obrigatória para o modo real)

1. No [console Firebase](https://console.firebase.google.com/project/gahepatama-4707c/overview), ative **Authentication** (Google e/ou e-mail/senha) e autorize `perabru.github.io` nos domínios de login. Se outro domínio for usado, inclua-o também.
2. Ative **Cloud Firestore** no projeto `gahepatama-4707c` e mantenha as coleções privadas. Leia `firestore.rules.example` e **mescle** os trechos às regras existentes, nunca substitua regras de outros aplicativos. O Realtime Database informado é independente do Firestore que o backend utiliza.
3. Cloud Functions 2ª geração e Secret Manager exigem um projeto com faturamento habilitado (normalmente plano **Blaze**), podendo gerar custos. As autorizações da conta devem ser concluídas pelo responsável no console Firebase.
4. Crie uma aplicação **Seller** na [Shopee Open Platform](https://open.shopee.com/) com permissões para **Order**, **Product**, **Logistics**, **Media Space** e **Payment/Finance**. A Shopee pode exigir avaliação/aprovação e restringir endpoints. API de vendedores **não** é API de afiliados.
5. No aplicativo Shopee, configure o domínio/URL de redirecionamento **exatamente** como exigido pelo console e pela aplicação implantada:

   `https://southamerica-east1-gahepatama-4707c.cloudfunctions.net/shopeeCallback`

   *ATENÇÃO:* a Shopee exige que o **domínio** do redirect seja o declarado no cadastro do parceiro. Se a Shopee não permitir um domínio `cloudfunctions.net`, use domínio próprio com HTTPS e reverse proxy para a função, e ajuste `callbackUrl()` em `functions/index.js` e a configuração cadastrada antes de implantar.

6. Instale o [Firebase CLI](https://firebase.google.com/docs/cli) com Node.js 22 e faça login usando uma conta que possa administrar o projeto.

```bash
npm install -g firebase-tools
firebase login
firebase use gahepatama-4707c
cd functions
npm install
npm test
cd ..
firebase functions:secrets:set SHOPEE_PARTNER_ID
firebase functions:secrets:set SHOPEE_PARTNER_KEY
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Copie a chave hex gerada na linha anterior para o comando abaixo:
firebase functions:secrets:set SHOPEE_TOKEN_CIPHER_KEY
firebase deploy --only functions
```

**Jamais coloque Partner Key, access tokens, refresh tokens ou chave de criptografia no JavaScript hospedado no GitHub Pages.** A chave `apiKey` do Firebase Web é uma configuração pública de identificação do aplicativo e **não** substitui regras de segurança do Firestore, Authentication ou autorização Shopee.

## Fluxo de utilização

1. Acesse o site, entre com Google ou e-mail; desative **Modo demonstração**.
2. Abra **Integrações → Autorizar loja na Shopee**. A autenticação ocorre diretamente no domínio oficial da Shopee, não por um formulário que pede sua senha Shopee.
3. Após conceder acesso, a página exibe suas lojas autorizadas. Escolha a loja no topo.
4. Use **Visão geral** e **Financeiro** para consultar os dados fornecidos pela API. Em **Publicar produto**, informe título, descrição, imagens, categoria, preço, estoque, peso, dimensões e logística; confirme a publicação. A Shopee validará os dados e pode exigir atributos adicionais conforme a categoria.

### O que os números significam

- **Pendente** = repasses ainda não liberados pela Shopee (quando a API os fornece).
- **Liberado** = valores já liberados segundo a API.
- **Saldo disponível para saque** não é inferido de repasses: consulte a carteira/conta oficial Shopee. Quando a API nega acesso, o site mostra **—**, não valores inventados.
- O gráfico mostra **número de pedidos nos últimos 14 dias**, não faturamento financeiro. Os números ilustrativos só aparecem no modo demonstração identificado.

### Segurança e observações técnicas

- OAuth com `state` aleatório, validade de 10 minutos e uso único, tokens cifrados AES-256-GCM e refresh efetuado apenas no backend.
- Todos os métodos de dados requerem Firebase Authentication; cada usuário tem acesso somente às próprias lojas autorizadas; rascunhos separados por UID.
- Não existe cobrança, saque, pagamento, pedidos falsos ou publicação simulada no modo real.
- O backend ainda requer validação com uma conta Shopee de testes/produção, especialmente atributos/categoria, NCM, warehouses e exigências locais por vendedor. APIs podem sofrer alterações e nem todos os parceiros recebem autorização financeira.
- Não faça deploy de `firestore.rules.example` como se fosse um arquivo completo de regras.

**Licença:** uso educacional e privado. Projeto independente, sem endosso ou afiliação oficial com Shopee.