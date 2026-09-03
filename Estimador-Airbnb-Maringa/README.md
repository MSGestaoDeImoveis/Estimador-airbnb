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

## Atualização: custos operacionais completos + exclusão em massa

Duas melhorias foram adicionadas sobre a estrutura existente, sem alterar
nada do que já funcionava (login, Base de Comparáveis, Banco de
Referências, score, cenários, comissão, backup, Apresentação):

**Custos operacionais mais completos**
- Novos custos configuráveis em Configurações: Água, Gás, IPTU, Seguro
  residencial e Imprevistos operacionais (além dos que já existiam).
- **Condomínio estimado automaticamente** por imóvel, com base no tipo,
  garagem, elevador, academia, piscina, padrão e no novo campo Portaria —
  ele não é um custo fixo global, porque depende de cada imóvel analisado.
- Na Análise Rápida, é possível **substituir a estimativa pelo valor real**
  do condomínio, quando você já souber esse valor.
- Duas caixas de marcação evitam cobrar água/gás em duplicidade quando já
  estão inclusos no condomínio.
- O resultado agora mostra os custos organizados em "Custos variáveis" e
  "Custos mensais", com o condomínio destacado separadamente.
- Configurações salvas antes desta atualização continuam funcionando
  normalmente — os novos custos são preenchidos com os valores padrão na
  primeira vez que o app abre, sem apagar nada que você já tinha ajustado.

**Exclusão em massa na Base de Comparáveis**
- Checkbox em cada linha da tabela e um checkbox no cabeçalho para
  selecionar/desselecionar todos os comparáveis visíveis (respeitando os
  filtros aplicados).
- Botão "🗑 Excluir selecionados (X)" aparece só quando há seleção, com
  confirmação antes de excluir.
- O botão de excluir individual, por linha, continua funcionando como antes.

## Atualização: "Estudo de Potencial" — apresentação premium (versão atual)

A aba "Apresentação" foi refeita como um documento único de **6 páginas
fixas** ("Estudo de Potencial para Locação por Temporada"), com
identidade visual fiel a uma referência fornecida: fundo off-white,
verde escuro institucional, tipografia serifada nos títulos, ícones de
traço fino (sem emojis) e bastante espaço em branco. Substitui a versão
anterior de "dois formatos" (Executiva/Detalhada) por este documento
único, mais alinhado ao visual pedido.

**Correção financeira importante:** o destaque principal (capa e os três
cards de cenário) agora mostra o **resultado líquido estimado do
proprietário** — a mesma variável `ownerResultByScenario` que o
`ResultPanel` já usava internamente (receita − custos operacionais −
comissão) — em vez da receita bruta, que era o que aparecia antes. A
comparação com aluguel tradicional (página 4) também passou a comparar
o líquido, não mais a receita bruta, e mostra o resultado honestamente
mesmo quando a locação tradicional sai na frente (sem manipular os
números a favor da temporada).

As 6 páginas: (1) capa com foto opcional do imóvel e os 4 indicadores
principais; (2) três cenários + indicadores de mercado (500+ imóveis,
65% ocupação, quantidade real de comparáveis usados); (3) calendário de
oportunidades (Expoingá, Maringá Encantada, calendário universitário);
(4) comparação com aluguel tradicional + vantagens da temporada; (5)
por que o imóvel tem esse potencial (checklist); (6) gestão profissional
+ card de contato editável (telefone/WhatsApp).

Um único botão "Exportar apresentação (PDF)" gera as 6 páginas em A4 —
cada página do estudo vira uma página própria do PDF (evita cortar
cards ao meio). Nenhuma das duas versões mostra endereço/identidade de
comparáveis individuais, scores, pesos ou custos internos.

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

### Sobre o "Estudo de Potencial" (versão atual)

Desta vez consegui testar de ponta a ponta num navegador real (rodei o
app localmente com dados de demonstração): gerei uma análise, abri a
aba Apresentação e exportei o PDF de verdade. Conferi visualmente as 6
páginas renderizadas na tela e as 6 páginas do PDF gerado, incluindo o
cenário em que a locação tradicional supera a temporada (a comparação
mostrou isso honestamente, como pedido) e o cenário sem aluguel
tradicional informado (mostra um aviso pedindo para preencher o campo,
em vez de inventar um número). O PDF sai com exatamente 6 páginas A4,
uma por página do estudo — corrigi um bug em que a primeira versão
dessa exportação estava gerando só 3 páginas (o conteúdo de duas
páginas do estudo acabava caindo dentro de uma página do PDF). Ainda
assim, teste você mesmo com os dados reais de um imóvel antes de usar
com um proprietário — em especial a foto (ela não é salva no backup
exportável, junto com Configurações e Base de Comparáveis) e o campo de
contato da página 6, que fica salvo neste computador até você editar.

### Sobre a atualização de custos e exclusão em massa

O projeto foi compilado com sucesso (`npm run build`) já com essas
mudanças. A fórmula de estimativa de condomínio foi conferida
separadamente contra o cenário de exemplo (apartamento padrão Médio, com
elevador e academia, sem garagem/piscina/portaria) e o resultado bateu
exatamente com o esperado: R$ 370/mês. A lógica de migração de
configurações antigas (`normalizeSettings`) também foi testada
isoladamente, confirmando que valores já personalizados pelo usuário são
preservados e que apenas os custos novos (água, gás, IPTU, seguro
residencial, imprevistos operacionais) são adicionados. Não foi possível
testar esses fluxos dentro de um navegador real com dados reais neste
ambiente — teste o cadastro de um imóvel, a alternância entre estimativa
automática e valor manual do condomínio, e a seleção/exclusão em massa na
Base de Comparáveis antes de usar em produção.

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
