# Estimador de Potencial — Locação por Temporada (Maringá/PR)

Aplicação local e privada para estimar o potencial de faturamento de imóveis
e apresentar a oportunidade a proprietários. Roda inteiramente no seu
computador — não depende do Claude, não depende de internet, e nada é
enviado para fora do seu computador.

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

## Se quiser editar ou atualizar a ferramenta no futuro

A pasta `codigo-fonte/` contém o projeto React completo (código-fonte
editável). Isso é opcional — só é necessário se você (ou alguém que te
ajude tecnicamente) quiser alterar algo no código depois. Para isso é
necessário ter o Node.js instalado (https://nodejs.org, versão 18 ou
superior) e, no terminal, dentro da pasta `codigo-fonte`:

```
npm install
npm run build
```

Isso gera um novo `dist/index.html`. Copie esse arquivo para dentro da
pasta `app/`, substituindo o antigo, e pronto — a versão atualizada passa
a abrir normalmente pelo `iniciar-local.bat`.

O arquivo principal com toda a lógica e as telas é
`codigo-fonte/src/lib/EstimatorCore.jsx`.

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
