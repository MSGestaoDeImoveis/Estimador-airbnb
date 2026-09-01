# Estimador de Potencial — Locação por Temporada (Maringá/PR)

Aplicação local e privada para estimar o potencial de faturamento de imóveis
e apresentar a oportunidade a proprietários. Não depende do Claude e nada é
enviado para fora do seu computador (exceto o login, explicado abaixo).

## ⚠️ Login adicionado (leia antes de usar)

Foi adicionada uma tela de login (Supabase Authentication) na frente do
Estimador. Isso muda duas coisas em relação à versão anterior:

- **Agora é necessária conexão com a internet** só para validar o login
  (a consulta de comparáveis, cálculos, backup etc. continuam 100% locais).
- **Só quem já tiver um usuário cadastrado no seu projeto Supabase consegue
  entrar.** Não existe tela de cadastro — você (ou quem administra o
  Supabase) cria os usuários autorizados manualmente pelo painel do
  Supabase (Authentication → Users → Add user), com e-mail e senha.

Sem configurar o Supabase (variáveis de ambiente `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY`), a tela de login aparece, mas nenhum
login funciona — veja "Configurar o login (Supabase)" mais abaixo.

O arquivo `app/index.html` incluído neste pacote **ainda é a versão
anterior, sem login** (não foi possível gerar a versão final sem as suas
credenciais reais do Supabase). Depois de configurar o `.env` com seus
dados, gere a versão nova com `npm run build` (passo a passo abaixo) e
substitua o `app/index.html`.

## Como abrir (não precisa saber programar)

1. Copie a pasta inteira `Estimador-Airbnb-Maringa` para o seu computador
   (área de trabalho, Documentos, onde preferir).
2. Dê duplo clique em **`iniciar-local.bat`**.
3. A ferramenta abre no seu navegador padrão (Chrome, Edge, etc.) — pronto.

Não é necessário instalar nada, não é necessário internet, não é necessário
Node.js, terminal ou qualquer ferramenta de programação. Você também pode
simplesmente dar duplo clique direto em `app\index.html`, se preferir — o
`.bat` só existe para facilitar.

## Sobre o arquivo .exe

Um `.exe` de verdade (via Electron, por exemplo) exigiria compilar e testar
em um ambiente Windows real, o que não estava disponível no ambiente em que
esta aplicação foi preparada — por isso, seguindo exatamente a alternativa
que você mesmo definiu como aceitável, entreguei o pacote local com
`iniciar-local.bat` em vez de arriscar te entregar um `.exe` não testado.

Na prática, o resultado para o seu dia a dia é equivalente: duplo clique →
a ferramenta abre. E tem uma vantagem extra: como é um único arquivo HTML
autocontido, é trivial de copiar para um pen drive, outro computador, ou
enviar por e-mail para você mesmo como backup.

Se no futuro você quiser mesmo assim um `.exe` empacotado (Electron), isso é
possível — precisaria ser gerado e testado em um computador Windows ou Mac
real. Posso preparar o projeto para isso quando fizer sentido.

## Seus dados

Todos os dados que você cadastra (Base de Comparáveis, Configurações,
textos da Apresentação) ficam salvos **apenas neste computador**, no
armazenamento local do navegador (a mesma tecnologia que sites usam para
lembrar login, preferências, etc.). Nada é enviado para a internet.

Isso tem duas implicações importantes:

- Se você limpar o histórico/dados de navegação do navegador escolhendo
  "todo o período" e marcando "dados de sites", ou usar sempre uma aba
  anônima/privada, você pode perder os dados salvos.
- Os dados ficam vinculados a **este arquivo `app/index.html`** neste
  navegador. Se você mover ou copiar a pasta para outro computador, ela
  não traz os dados automaticamente — por isso existe o backup abaixo.

### Backup e restauração

Na aba **Configurações**, no final da página:

- **Exportar backup (.json)** — baixa um arquivo com toda a sua Base de
  Comparáveis e configurações. Guarde esse arquivo em um lugar seguro
  (pen drive, e-mail para você mesmo, Google Drive) e exporte de novo
  sempre que cadastrar bastante coisa nova.
- **Importar backup (.json)** — carrega um backup exportado anteriormente,
  substituindo os dados atuais. Use isso ao trocar de computador ou depois
  de reinstalar o navegador.

## O que tem nesta aplicação

Tudo que já existia na ferramenta (Artifact) foi mantido exatamente como
estava — mesmos campos, mesmos cálculos, mesmo visual, mesma lógica:

- **Análise Rápida** — cadastro do imóvel e geração da estimativa
  (comparáveis, score, faixas conservador/provável/otimista, custos,
  comissão, comparação com aluguel tradicional, nível de confiança).
- **Base de Comparáveis** — cadastro e filtro dos imóveis pesquisados.
- **Banco de Referências** — agregação automática por zona/quartos/área/padrão.
- **Configurações** — todos os parâmetros e pesos ajustáveis, incluindo o
  novo bloco de backup.

Duas coisas novas foram adicionadas, sem alterar nada do que já existia:

- **Aba "Apresentação"** — uma versão comercial, voltada ao proprietário,
  organizada nas 5 páginas que você descreveu (Oportunidade, Potencial de
  receita, Por que este imóvel tem potencial, Oportunidade de gestão
  profissional, Próximo passo). Ela usa os mesmos cálculos da Análise
  Rápida, mas **nunca mostra**: lista de comparáveis, nomes/endereços dos
  comparáveis, scores, pesos, metodologia, custos internos, comissão ou
  margem. Os textos das páginas 4 e 5 são editáveis por você diretamente
  na tela.
- **Exportar apresentação (PDF)** — botão na aba Apresentação que gera um
  PDF pronto para enviar ou mostrar ao proprietário.

O toggle "Modo Apresentação" que já existia dentro da Análise Rápida
continua funcionando exatamente como antes — a nova aba "Apresentação" é
adicional, não uma substituição.

## Configurar o login (Supabase)

1. Crie uma conta/projeto em https://supabase.com (grátis para este uso).
2. No painel do projeto, vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon / public key** (a chave pública — NUNCA a `service_role`/secret).
3. Em **Authentication → Users**, clique em **Add user** e cadastre
   manualmente cada pessoa autorizada (e-mail + senha). Não há tela de
   cadastro no app — o acesso é só para quem você cadastrar aqui.
4. (Recomendado) Em **Authentication → Providers → Email**, desative
   "Allow new users to sign up" para garantir que ninguém consiga criar
   conta sozinho.
5. Na pasta `codigo-fonte/`, copie o arquivo `.env.example` para `.env` e
   preencha com os valores do passo 2:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-aqui
   ```
   O arquivo `.env` **não deve ser enviado ao GitHub** (já está no
   `.gitignore`) — cada ambiente (seu computador, Vercel, Netlify etc.)
   define essas variáveis separadamente.

## Se quiser editar, atualizar ou publicar a ferramenta no futuro

A pasta `codigo-fonte/` contém o projeto React completo (código-fonte
editável). Para gerar a versão final (com o login configurado), é
necessário ter o Node.js instalado (https://nodejs.org, versão 18 ou
superior) e, no terminal, dentro da pasta `codigo-fonte`:

```
npm install
npm run build
```

Isso gera um novo `dist/index.html`, já com a tela de login. Copie esse
arquivo para dentro da pasta `app/`, substituindo o antigo, e pronto — a
versão atualizada passa a abrir normalmente pelo `iniciar-local.bat` (ou
pode ser publicada em qualquer hospedagem estática — Vercel, Netlify,
GitHub Pages — desde que as variáveis de ambiente `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` sejam configuradas lá também no momento
do build).

O arquivo principal com toda a lógica e as telas do Estimador é
`codigo-fonte/src/lib/EstimatorCore.jsx` — **este arquivo não foi
alterado** pela adição do login. A autenticação vive em arquivos
separados: `codigo-fonte/src/App.jsx`, `codigo-fonte/src/lib/supabaseClient.js`,
`codigo-fonte/src/lib/AuthContext.jsx`, `codigo-fonte/src/lib/LoginScreen.jsx`
e `codigo-fonte/src/lib/LogoutButton.jsx`.

## Testes realizados antes da entrega

Antes de fechar este pacote, foram testados automaticamente, em um
navegador real:

- Abertura do arquivo via duplo clique (`file://`), sem erros no console.
- Geração de estimativa (cenários, faixas, comparáveis, alertas).
- Navegação entre as 5 abas.
- Cadastro de um novo comparável na Base e persistência após recarregar
  a página.
- Exportação de backup e presença dos dados no arquivo gerado.
- Geração do PDF da aba Apresentação e conferência de que a lista de
  comparáveis, os scores e a comissão não aparecem nesse PDF.

Ainda assim, recomendo testar você mesmo no seu computador Windows antes
de usar em uma reunião real com um proprietário, especialmente a
impressão/exportação do PDF, já que o comportamento pode variar levemente
entre navegadores (Chrome, Edge, Firefox).

### Sobre o login (Supabase)

O código de autenticação foi escrito seguindo exatamente a API oficial do
`@supabase/supabase-js` (login por e-mail/senha, sessão persistente,
logout), e o projeto foi compilado com sucesso (`npm run build`) incluindo
essa mudança. Como este pacote não tem acesso a um projeto Supabase real
seu, **não foi possível testar um login de ponta a ponta** com suas
credenciais. Depois de configurar o `.env` (passo a passo acima), teste
você mesmo: login com usuário certo, login com senha errada (deve mostrar
erro em português), recarregar a página logado (deve manter a sessão) e
o botão "Sair".
