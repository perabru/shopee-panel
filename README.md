# Vitrine Livre — Shopee Panel (Firebase Realtime Database)

**Site:** https://perabru.github.io/shopee-panel/  
**Repositório:** https://github.com/perabru/shopee-panel

Esta versão corrige o erro **"Integração ainda não ativada. internal [0]"**. O projeto anterior dependia de uma Cloud Function (`ensureStore`) e tentava usar Cloud Firestore, mas o Firebase do projeto usa **Realtime Database**.

## O que funciona sem Cloud Functions

- Login com Google pelo Firebase Authentication.
- Criação da primeira vitrine ao entrar; uma vitrine por usuário Google.
- Alteração de nome, descrição, referência Shopee e visibilidade.
- Publicação e exclusão de produtos usando **links de afiliado já gerados pelo próprio usuário** no portal da Shopee.
- URL pública `https://perabru.github.io/shopee-panel/#/loja/UID` que funciona sem login.
- Busca de produtos **dentro da vitrine pública** e busca externa no site da Shopee.
- Nenhum saldo ou comissão é inventado; o painel exibe dados reais apenas quando a API for conectada.

A configuração Firebase pública do HTML/JavaScript não é um segredo. A API Shopee não pode ser chamada com um App Secret diretamente de um site estático público.

## O passo obrigatório no Firebase: PUBLICAR REGRAS DO REALTIME DATABASE

**Projeto:** `gahepatama-4707c`  
**Instância:** `gahepatama-4707c-default-rtdb`  
**Banco:** https://gahepatama-4707c-default-rtdb.firebaseio.com

1. Abra https://console.firebase.google.com/project/gahepatama-4707c/database
2. Selecione **Realtime Database** (não Firestore Database).
3. Abra a aba **Regras / Rules**.
4. Substitua as regras atuais pelo conteúdo integral de **[database.rules.json](./database.rules.json)**.
5. Clique em **Publicar**.

As regras dão leitura pública **apenas** a `/shopeePanel/v1/publicShops` e a `/shopeePanel/v1/publicProducts/{uid}` das lojas públicas; escrita somente ao dono autenticado no UID correspondente; relatórios e status da API só podem ser lidos pelo dono, e segredos de afiliados nunca podem ser lidos ou escritos no navegador.

**Atenção:** todos os dados deste projeto ficam isolados em `shopeePanel/v1`. Não use `{ ".read":true, ".write":true }` em produção. Se existir algum outro aplicativo usando este mesmo Realtime Database, revise suas regras antigas e una as permissões antes de publicar: substituir todas as regras pode bloquear os dados desse outro aplicativo. O código da Vitrine Livre não necessita de permissão de leitura sobre dados de outros sistemas.

Você também pode instalar o Firebase CLI e, estando na pasta deste repositório, executar:

```bash
npm install -g firebase-tools
firebase login
firebase use gahepatama-4707c
firebase deploy --only database --project gahepatama-4707c
```

`firebase.json` agora referencia `database.rules.json`, não `firestore.rules`.

## Habilitar login Google

1. https://console.firebase.google.com/project/gahepatama-4707c/authentication/providers
2. Habilite **Google** em Sign-in method; escolha o e-mail de suporte.
3. Em **Authentication → Configurações → Domínios autorizados**, adicione `perabru.github.io`.
4. Entre em https://perabru.github.io/shopee-panel/ e clique em **Entrar com Google**.

Se aparecer **PERMISSION_DENIED** após o login, publique as regras do Realtime Database. Se aparecer **auth/unauthorized-domain**, habilite o domínio no Authentication. Nenhum dos dois erros é resolvido abrindo Firestore.

## Como publicar produtos agora

1. Entre com Google. A vitrine será criada automaticamente no Realtime Database.
2. Abra **Adicionar por link**.
3. No portal oficial de afiliados Shopee, gere seu próprio link de afiliado para o produto ou loja.
4. Informe **nome**, **link original** da Shopee e **seu link de afiliado convertido**; imagem, categoria e preço são opcionais.
5. Clique em **Publicar na minha vitrine**; o produto ficará disponível em seu link público. Compras são concluídas no site/aplicativo da Shopee.

**Não** é possível criar um link de afiliado válido a partir de um link comum apenas acrescentando parâmetros no navegador. Links manuais só geram atribuição se tiverem sido convertidos de verdade no programa Shopee, pelo próprio afiliado.

## Recursos avançados: API Shopee (opcionais)

A pesquisa de ofertas dentro do painel, geração *automática* de links e a consulta de comissões reais exigem **Cloud Functions e a Open API de Afiliados Shopee**. O backend `functions/index.js` foi migrado para `admin.database()` e grava em:

- `shopeePanel/v1/affiliateSecrets/{uid}` — App ID/Secret criptografados com AES-256-GCM, acesso exclusivamente do Admin SDK.
- `shopeePanel/v1/affiliateStatus/{uid}` — indicador privado de integração conectada.
- `shopeePanel/v1/affiliateReports/{uid}` — estimativas das conversões consultadas.
- `shopeePanel/v1/publicProducts/{uid}` — produtos publicados com link gerado pela API.

Implantação do backend exige acesso administrativo ao projeto Firebase, **plano Blaze com faturamento habilitado**, e uma credencial da Open API de Afiliados Shopee válida:

```bash
npm install -g firebase-tools
firebase login
cd shopee-panel
npm --prefix functions install
firebase use gahepatama-4707c
# Gere uma chave aleatória de 32 bytes, em hexadecimal:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# Guarde a chave gerada em local seguro e cole-a na solicitação abaixo:
firebase functions:secrets:set AFFILIATE_ENCRYPTION_KEY
firebase deploy --only functions,database --project gahepatama-4707c
```

**Não coloque App Secret nem chave de criptografia nos arquivos HTML/JavaScript, no repositório GitHub ou nas regras públicas.** O `functions/index.js` precisa ser implantado pelo dono do projeto; um deploy de GitHub Pages não executa as Cloud Functions.

Para credenciais, verifique a disponibilidade de App ID e Secret na área da Shopee: https://affiliate.shopee.com.br/open_api. O login Google não conecta automaticamente a conta de afiliado Shopee, mesmo quando os e-mails são iguais.

## Como os dados são organizados

| Caminho | O que armazena | Acesso do cliente |
|---|---|---|
| `shopeePanel/v1/shops/{uid}` | Informações da vitrine, inclusive privada | Apenas o proprietário |
| `shopeePanel/v1/publicShops/{uid}` | Vitrines marcadas como públicas | Leitura pública; escrita do dono |
| `shopeePanel/v1/publicProducts/{uid}/{id}` | Produtos e links publicados | Leitura dos visitantes se a loja for pública; escrita do dono |
| `shopeePanel/v1/affiliateStatus/{uid}` | Estado da conexão Shopee | Leitura do dono; escrita do backend |
| `shopeePanel/v1/affiliateReports/{uid}` | Comissões consultadas na API | Leitura do dono; escrita do backend |
| `shopeePanel/v1/affiliateSecrets/{uid}` | Credenciais criptografadas da Shopee | Sem acesso pelo navegador |

**Observação importante sobre privacidade:** o Firebase Realtime Database só é seguro se as regras acima estiverem publicadas. Se o banco já for compartilhado com outros sistemas, avalie o efeito da substituição das regras antes de aplicar.

## Status de implantação

- Arquivos front-end e backend estão no GitHub.
- O GitHub Pages publica automaticamente os arquivos estáticos da raiz da branch `main` pelo fluxo nativo **pages build and deployment**.
- **A publicação das regras no Firebase e das Cloud Functions não acontece automaticamente pelo GitHub Pages.** O operador do projeto Firebase deve executar as etapas acima.
- Nenhum teste com uma conta real da Shopee pode ser afirmado sem credenciais válidas e um ambiente Firebase configurado.

## Verificação local

```bash
node --check app.js
node --check functions/index.js
node --test tests/*.test.cjs
```

## Referência Shopee

Exemplo: https://shopee.com.br/q63ifc2_ce. A plataforma não afirma titularidade da loja, nem copia seu catálogo sem permissão da Shopee.