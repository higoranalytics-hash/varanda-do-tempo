# Varanda do Tempo — V4.2.2 | Refinamento mobile e cancelamento de comanda vazia

## Entregas desta versão

- Corrigida a impressão de comandas: o comprovante agora é movido temporariamente para um filho direto do `body`, pois a navegação global encapsula o conteúdo da página em `.app-layout` e o CSS anterior ocultava esse contêiner inteiro. Após `afterprint`, a área de impressão volta à posição original.
- A impressão aguarda o carregamento/decodificação do logo e o próximo ciclo de layout antes de abrir a janela de impressão.
- O cabeçalho do comprovante passa a usar o logo oficial enviado.
- Incluído o logo oficial otimizado em `assets/logo-varanda-do-tempo.webp`, mantendo também a imagem original JPEG enviada em `assets/logo-varanda-do-tempo-original.jpg`.
- Incluídos `favicon.ico`, favicons PNG, ícone Apple Touch e manifesto web.
- Aplicada paleta global inspirada no logo: espresso/carvão, cobre/laranja e marfim. Verde, âmbar e vermelho permanecem reservados aos estados semânticos de sucesso, atenção e ações destrutivas. Tons azuis residuais dos estados de foco, seleção e botões foram harmonizados com a paleta quente; campos permanecem brancos ao receber foco para preservar contraste.
- Sidebar, cabeçalho mobile, link de marca e tela de login passam a utilizar a identidade oficial.

## Arquivos principais alterados

- `js/comandas.js` — correção estrutural do fluxo de impressão e logo no comprovante.
- `js/navigation.js` — logo oficial no menu lateral, barra mobile e cabeçalho de navegação.
- `css/style.css` — paleta quente global, estilos de logo e de comprovante.
- `index.html`, `dashboard.html`, `atendimento.html`, `cardapio.html`, `comandas.html` — favicon, manifesto e cor do navegador.
- `assets/` — arquivos do logo, favicons e manifesto.

## Supabase

Nenhuma tabela, RPC, migration, política RLS ou configuração do Supabase foi alterada.

## Validações desta entrega

- O PDF de evidência recebido apresenta apenas cabeçalho e rodapé do navegador, sem o conteúdo do comprovante.
- Identificada a causa estrutural: a navegação global encapsula a página em `.app-layout`, enquanto o CSS de impressão oculta os filhos diretos do `body`, o que também escondia o comprovante aninhado.
- Corrigido o fluxo para mover temporariamente `#adminReceiptPrint` para um filho direto do `body` durante a impressão e restaurá-lo após `afterprint`.
- Executado smoke test de impressão com uma fixture que reproduz o contêiner `.app-layout`; o PDF renderizado contém o logo, identificação da comanda, itens e resumo financeiro. A tentativa de validação com Chromium headless não concluiu no ambiente; o smoke test não substitui a impressão em Chrome/Edge.
- `node --check` executado nos módulos JavaScript.
- HTML verificado quanto a IDs duplicados e referências locais.
- CSS analisado sem erros de parsing.
- Referências dos ícones do manifesto verificadas.

## Testes ainda necessários em ambiente real

- Validar impressão via Chrome/Edge com sessão autenticada e dados reais.
- Confirmar a impressão em A4 e em impressora térmica, caso utilizada.
- Conferir os favicons após atualização do cache do navegador.

---

# Varanda do Tempo — histórico de evolução

## Entrega atual: V4.0 — Gestão de Comandas e refinamento global

Esta versão reorganiza a aba **Gestão de Comandas** e aplica uma camada de refinamento visual compartilhada entre as páginas do sistema.

### Gestão de Comandas — o que mudou
- Removidos os filtros de data inicial/final e o controle para limpar período.
- Removidos os indicadores “Comandas encerradas”, “Consumo no período” e “Recebido das comandas”.
- Mantido somente um indicador: **Comandas abertas**, calculado a partir das comandas retornadas pela consulta administrativa.
- Mantidos os recursos apresentados na tela de referência: busca por nome/número, filtro de status, aplicar filtros, limpar filtros, atualizar lista, selecionar comanda e visualizar detalhes.
- Preservadas as informações de consumo, total consumido, total recebido, saldo pendente e histórico de pagamentos.
- Adicionada a ação **Imprimir comanda** no painel de detalhes. Ela fica disponível para comandas abertas, encerradas e canceladas.
- O comprovante de impressão contém cliente, número, datas de abertura/encerramento, situação, itens, status de pagamento por item, total consumido, total recebido, saldo pendente e histórico de recebimentos.
- A seleção atual é limpa quando o registro deixa de corresponder aos filtros, evitando mostrar detalhes de uma comanda que não está visível na lista.
- A busca em tempo real agrupa renderizações no próximo frame para evitar redesenhos repetidos durante a digitação.
- Protegida a renderização de detalhes contra respostas assíncronas fora de ordem, evitando que a consulta lenta de uma comanda substitua a seleção mais recente.

### Refinamento visual global
- Ajustados tokens compartilhados de fundo, superfícies, bordas, raios, sombras e cores semânticas.
- Refinados tipografia, títulos, espaçamentos e largura das páginas.
- Padronizados estados de botões, campos de formulário, foco por teclado e estados vazios.
- Mantidos ícones SVG como padrão das ações operacionais; não foram adicionados emojis em ações críticas.
- Ajustados cards, estados de status, notificações e modais sem substituir os fluxos existentes.
- Melhorada a adaptação dos componentes compartilhados para tablets e celulares.
- No mobile, o cabeçalho do detalhe da comanda passa a empilhar identificação e ações; os botões de impressão/limpeza deixam de comprimir o nome do cliente.
- Ajustadas as larguras e quebras de componentes para evitar rolagem horizontal desnecessária em telas estreitas.
- Nenhum efeito de carregamento que mova o fundo foi introduzido.

### Arquivos alterados
- `comandas.html`
- `js/comandas.js`
- `css/style.css`
- `README.md`

### Regras e integrações preservadas
- A consulta continua utilizando a RPC `get_admin_order_history` existente, com o limite de até 500 comandas mais recentes definido no banco.
- Os detalhes continuam utilizando `get_order_payment_summary` e `get_order_payment_history`.
- Edição de nome, remoção de item pendente e transferência de item pendente continuam utilizando as RPCs existentes.
- Nenhuma tabela, coluna, função RPC, política RLS, regra financeira ou migration foi criada ou alterada.
- `js/supabaseClient.js`, autenticação, permissões e os fluxos dos demais módulos foram preservados.
- Nenhuma migration é necessária para esta versão.

### Validações realizadas
- `node --check` executado nos módulos JavaScript.
- HTML verificado quanto a IDs duplicados.
- Referências estáticas do JavaScript de Comandas conferidas; os elementos `closeDetailButton`, `editCustomerNameButton` e `printOrderButton` são criados dinamicamente ao selecionar uma comanda.
- Removidas todas as referências aos filtros/indicadores de período da página e do respectivo JavaScript.
- CSS analisado sem erros de parsing.
- Prévia estática dos componentes com a folha de estilos atual renderizada em Chromium para desktop e viewport mobile de 390 px; não foi detectada rolagem horizontal. Essa prévia usa conteúdo demonstrativo e não substitui o teste funcional da aplicação.
- Testes reais autenticados no Supabase não foram executados nesta sessão.
- A impressão deve ser conferida no navegador e na impressora/PDF de destino antes da publicação operacional.

### Como testar
1. Entre como administrador e abra **Gestão de comandas**.
2. Confirme que existe somente o card **Comandas abertas** e que o número corresponde às comandas abertas retornadas pela consulta.
3. Teste a busca por nome e por número, os quatro estados do filtro e os botões **Aplicar filtros**, **Limpar filtros** e **Atualizar**.
4. Selecione uma comanda aberta e confira consumo, resumo financeiro, histórico de pagamentos e ações disponíveis.
5. Selecione uma comanda encerrada e clique em **Imprimir comanda**.
6. Repita com uma comanda aberta e uma cancelada; confira o status, os itens e os valores do comprovante.
7. No diálogo de impressão, selecione uma impressora ou **Salvar como PDF** e confira se o conteúdo não corta colunas nem histórico.
8. Teste em desktop e celular, incluindo filtros com nomes longos e números de comanda.

**Migration:** não é necessária.

---

## Entrega atual: V3.9 — Resumo financeiro e fechamento de comandas no Atendimento

Esta entrega corrige a divergência entre a busca por nome e a janela geral de **Comandas abertas**. Ambas passam a apresentar os valores financeiros obtidos pela RPC existente `get_order_payment_summary`.

### O que mudou na V3.9
- A lista geral de comandas abertas agora apresenta **Total da comanda**, **Recebido** (verde) e **Pendente** (âmbar), em vez de exibir somente o total consumido.
- Os resumos financeiros da lista geral são carregados em lotes de até oito comandas, evitando disparar centenas de chamadas RPC simultaneamente. Enquanto cada lote é processado, a interface mostra que o resumo está sendo calculado.
- O botão **Receber pagamento** aparece apenas quando há consumo ativo e saldo pendente.
- Para comandas com consumo ativo e saldo zerado, aparece a ação **Fechar comanda**. A ação abre a comanda em modo de consulta, carrega o histórico e usa a confirmação de encerramento já existente.
- O modo de consulta também apresenta o painel **Fechar comanda** quando todos os itens ativos estão quitados e a comanda continua aberta.
- Comandas sem consumo ativo não exibem ação de pagamento ou fechamento financeiro.
- Se a consulta financeira falhar, a interface não oferece ações de pagamento/fechamento baseadas em valores desconhecidos; permanece disponível apenas a consulta.
- A busca por nome e a lista geral compartilham o mesmo componente de resumo financeiro.

### Arquivos alterados nesta entrega
- `atendimento.html`
- `js/atendimento.js`
- `css/style.css`
- `README.md`

### Regras e integrações preservadas
- O total consumido considera somente itens não cancelados.
- O total recebido e o saldo restante vêm da RPC `get_order_payment_summary`, que calcula os pagamentos por item.
- O encerramento continua utilizando a RPC `close_customer_order` por meio de `closeCustomerOrder`.
- O frontend só permite solicitar fechamento quando o saldo calculado é zero e existe consumo ativo. A validação definitiva continua no backend/RPC.
- Nenhuma tabela, coluna, função RPC, política RLS ou migration foi criada ou alterada.

### Validações realizadas
- Sintaxe JavaScript verificada com `node --check`.
- IDs HTML duplicados e novos elementos estáticos verificados.
- Referências aos botões e elementos utilizados pelo módulo verificadas.
- CSS analisado sem erros de parsing.
- Cenários de comanda parcialmente paga, totalmente quitada, vazia e com falha na consulta financeira verificados na lógica de renderização.
- Teste visual completo no navegador e teste autenticado no Supabase real não foram executados nesta sessão.

### Como atualizar e testar
1. Faça uma cópia de segurança da V3.8.
2. Extraia este ZIP em uma pasta nova.
3. Preserve `js/supabaseClient.js` caso contenha as credenciais do seu projeto Supabase; ele não foi alterado.
4. Abra o Atendimento e clique em **Comandas abertas**. Confirme que a comanda #13, no cenário de exemplo, apresenta Total de R$ 117,00, Recebido de R$ 90,00 e Pendente de R$ 27,00.
5. Teste o recebimento de pagamento e confira se o saldo diminui corretamente após atualizar a lista.
6. Consulte uma comanda quitada ainda aberta e confira se o painel **Fechar comanda** fica disponível.
7. Teste a ação **Fechar comanda** na lista e também no modo de consulta; confirme o encerramento na caixa de confirmação.
8. Confira que comandas vazias não exibem **Receber pagamento** nem **Fechar comanda**.

**Migration:** não é necessária para esta entrega.

---


## Entrega atual: V3.8 — Refinamento do Atendimento

Esta entrega separa o início de um novo atendimento da consulta de comandas existentes e apresenta o resumo financeiro no resultado da busca por cliente.

### O que mudou na V3.8
- Novo botão **Novo atendimento**, com formulário próprio para informar o nome do cliente e iniciar uma nova comanda.
- A busca por nome ficou dedicada à localização de comandas já abertas; a ação foi mantida como **Buscar comanda**.
- O acesso **Comandas abertas** foi preservado como caminho independente para consultar a lista geral.
- A abertura verifica se já existe comanda aberta com o mesmo nome. Em caso positivo, solicita sobrenome ou apelido e valida se a identificação informada também não está em uso.
- O nome digitado na busca é reaproveitado como sugestão ao abrir o formulário de novo atendimento.
- Resultados da busca exibem **Total da comanda**, **Recebido** em verde e **Pendente** em âmbar, calculados em centavos a partir dos itens ativos e da RPC financeira existente.
- A ação **Receber pagamento** só aparece quando existe saldo pendente. Quando o saldo é zero, a comanda recebe o estado **Quitada · aguardando encerramento** e permanece disponível para consulta e fechamento pelo fluxo existente.
- Se o resumo financeiro não puder ser carregado, a interface informa a indisponibilidade e não apresenta uma ação de pagamento baseada em valores desconhecidos.
- Estados sem consumo ativo são identificados sem sugerir recebimento de pagamento.

### Arquivos alterados nesta entrega
- `atendimento.html`
- `js/atendimento.js`
- `css/style.css`
- `README.md`

### Regras e integrações preservadas
- A criação continua utilizando a RPC existente `open_customer_order` com `p_table_id: null`.
- O resumo financeiro utiliza a RPC existente `get_order_payment_summary`; nenhuma função ou estrutura do banco foi alterada.
- O registro de pagamento continua utilizando `receive_order_payment` por meio da função existente `receiveOrderPayment`.
- O encerramento continua utilizando `close_customer_order` por meio de `closeCustomerOrder` e mantém a confirmação existente.
- Nenhuma tabela, coluna, política RLS, regra financeira ou migration foi alterada.
- A lista geral de comandas abertas e os demais módulos permanecem com seus fluxos existentes.

### Validações realizadas
- Sintaxe JavaScript verificada com `node --check` nos módulos da aplicação.
- IDs duplicados e referências a elementos estáticos verificados nas páginas HTML.
- CSS analisado sem erros de parsing.
- Cenários de renderização dos resultados de busca verificados para comanda parcialmente paga, quitada e sem consumo ativo.
- Teste visual completo em navegador e teste autenticado no Supabase real não foram executados nesta sessão.

### Como atualizar e testar
1. Faça uma cópia de segurança da pasta V3.7.
2. Extraia o ZIP V3.8 em uma pasta nova.
3. Preserve seu arquivo `js/supabaseClient.js` se ele contiver as credenciais do projeto Supabase; ele não foi alterado.
4. Execute `index.html` com Live Server e entre no Atendimento.
5. Clique em **Novo atendimento**, informe um cliente ainda sem comanda e confirme que o sistema abre a comanda e encaminha para a seleção de produtos.
6. Tente iniciar outro atendimento com o mesmo nome e confira a validação de sobrenome ou apelido.
7. Consulte comandas com saldo pendente, pagamento parcial e pagamento integral. Confira Total, Recebido, Pendente e a presença/ausência do botão de pagamento.
8. Na comanda quitada, clique em **Consultar** e confira o fluxo existente de encerramento.

**Migration:** não é necessária para esta entrega.

---

## Entrega atual: V3.7 — Design System Global

Esta entrega consolida a camada visual compartilhada entre Dashboard, Atendimento, Gestão de Comandas e Gestão do Cardápio. A revisão prioriza consistência, acessibilidade e previsibilidade operacional, preservando os fluxos de negócio existentes.

### O que mudou na V3.7
- Consolidação dos tokens CSS globais em um único bloco `:root` principal, mantendo somente a exceção responsiva já existente para a largura da sidebar.
- Padronização da paleta semântica e dos aliases de cores, superfícies, bordas, tipografia, raios, sombras e espaçamentos.
- Padronização global dos estados de botões primários, secundários, neutros, sucesso e ações destrutivas.
- Ajuste de foco visível, alvos de toque e comportamento responsivo dos controles compartilhados.
- Unificação visual dos toasts, modais, notificações e estados de carregamento, com preferência por feedback sem deslocamento de layout.
- Melhoria da acessibilidade dos toasts com `role`, `aria-live` e `aria-atomic`.
- Preservação da largura dos botões durante estados de carregamento para reduzir deslocamentos de interface.
- Substituição dos símbolos Unicode do menu lateral por ícones SVG de traço consistente.
- Melhoria do menu móvel: botão com alvo de toque maior, rótulo dinâmico, `aria-controls`, foco contido, fechamento por Escape, bloqueio de rolagem do fundo e remoção dos links ocultos da ordem de tabulação.
- Correção do destino dos logotipos: administradores retornam à Visão geral e usuários de atendimento retornam ao Atendimento, em vez de voltar à tela de login.
- Padronização da cor da barra do navegador (`theme-color`) para a identidade clara do sistema.
- Nenhuma alteração de regras financeiras, consultas/mutações de negócio, RPCs, tabelas, políticas RLS ou migrations.

### Arquivos alterados nesta entrega
- `css/style.css`
- `js/navigation.js`
- `js/utils.js`
- `js/comandas.js`
- `js/cardapio.js`
- `index.html`
- `dashboard.html`
- `atendimento.html`
- `comandas.html`
- `cardapio.html`
- `README.md`

### Regras preservadas
- A navegação continua exibindo os módulos administrativos somente para o perfil `admin`.
- A equipe continua tendo acesso ao Atendimento.
- A autenticação permanece sob responsabilidade dos módulos `auth.js` e `guards.js`.
- O logout continua chamando `supabase.auth.signOut()`.
- Todos os destinos de página e IDs funcionais existentes foram preservados.
- Nenhuma credencial, tabela, função RPC, política RLS ou migration foi alterada.

### Validações realizadas
- Sintaxe de todos os módulos JavaScript verificada com `node --check`.
- Estrutura HTML e IDs duplicados verificados nas cinco páginas.
- CSS analisado sem erros de parsing.
- Referências de IDs usados em `navigation.js` e nos módulos de página verificadas.
- Teste automatizado de navegação no Supabase real não foi executado.
- O comportamento de navegação foi revisado estaticamente; teste visual completo depende de abrir o projeto com Live Server e autenticação real.

### Atualização
1. Faça uma cópia de segurança da pasta V3.6.
2. Extraia este ZIP em uma pasta nova.
3. Preserve `js/supabaseClient.js` caso contenha as credenciais do seu projeto Supabase; ele não foi alterado.
4. Execute `index.html` com Live Server e entre como administrador e como usuário de atendimento para validar os dois perfis.
5. Em largura mobile, valide abrir/fechar o menu, fechar por Escape e navegar pelos links sem deixar o foco preso fora do menu.
6. Confira modais, toasts, carregamento global e estados de botão nos quatro módulos.

**Migration:** não é necessária para esta entrega.

---


## Entrega atual: V3.6 — Refinamento da Visão Geral (Dashboard)

Esta entrega transforma a página inicial administrativa em uma central de acessos mais clara, mantendo a navegação e a autenticação existentes.

### O que mudou na V3.6
- Reorganização da introdução do painel, com título e saudação personalizada preservados.
- Atendimento passa a ser o acesso operacional de maior destaque.
- Gestão de comandas e Gestão do cardápio organizadas como acessos secundários, com descrições e iconografia SVG contextual.
- Novo aviso sobre a regra existente de preços: alterações valem para novos lançamentos; itens já registrados preservam o preço histórico.
- Melhorias de foco por teclado, estados de hover e adaptação para desktop, tablet e celular.
- Nenhum indicador operacional fictício foi incluído; o Dashboard não faz novas consultas ao banco.
- Nenhuma alteração em autenticação, navegação, tabelas, RPCs, políticas RLS ou migrations do Supabase.

### Arquivos alterados nesta entrega
- `dashboard.html`
- `css/style.css` (adição de estilos escopados para o Dashboard)
- `README.md`

### Regras preservadas
- A página continua restrita ao perfil `admin` por `requireAuth(["admin"])`.
- O nome do usuário continua sendo exibido com `textContent`, sem inserir conteúdo do perfil como HTML.
- Os destinos dos módulos permanecem `atendimento.html`, `comandas.html` e `cardapio.html`.
- A navegação lateral e o comportamento responsivo do menu continuam sob responsabilidade de `js/navigation.js`.
- Nenhuma consulta, mutação ou contrato do Supabase foi adicionado ou alterado.

### Validações realizadas
- Sintaxe dos módulos JavaScript verificada com `node --check`.
- Estrutura HTML, IDs duplicados e destinos de navegação verificados.
- CSS analisado sem erros de parsing.
- Não foi possível concluir teste visual no navegador nem autenticação real no Supabase nesta sessão.

### Atualização
1. Faça uma cópia de segurança da pasta V3.5.
2. Extraia este ZIP em uma pasta nova.
3. Preserve seu arquivo `js/supabaseClient.js` se ele contiver as credenciais do seu projeto Supabase.
4. Execute `index.html` com Live Server e entre com um usuário administrador.
5. Confira a navegação pelos três atalhos, o menu lateral e a apresentação em telas menores.

**Migration:** não é necessária para esta entrega.

---

## Entrega atual: V3.5 — Refinamento da Gestão do Cardápio

Esta entrega dá continuidade à V3.4 e aprimora a experiência administrativa do cardápio, preservando as consultas e operações existentes no Supabase.

### O que mudou na V3.5
- Cabeçalho com contexto mais claro e ações principais com iconografia padronizada.
- Indicadores do cardápio reorganizados, com hierarquia visual e descrições auxiliares.
- Lista de categorias com contagem de produtos ativos, indicação de categoria ativa/inativa e ação de edição mais evidente.
- Busca e filtro de situação agrupados em uma barra de ferramentas responsiva.
- Produtos apresentados com imagem ou placeholder, categoria, descrição, preço, status e ações padronizadas.
- Estados vazios específicos para buscas sem resultado e cardápios sem produtos.
- Ações de disponibilidade com cores semânticas e feedback de processamento.
- Consulta do cardápio para atendimento com imagens, placeholders e cartões responsivos.
- Formulário de produto com prévia de imagem mais clara, nome do arquivo selecionado, mensagem de erro de imagem e indicação dos estados ativo/disponível.
- Prévia local de imagem com liberação do Object URL quando a seleção é alterada ou o modal é fechado.
- Modais de categoria e produto com foco inicial, contenção do foco, fechamento por Escape e restauração do foco anterior.
- Produtos vinculados a categorias inativas continuam editáveis sem que a categoria seja ativada automaticamente. Para novos produtos, a seleção continua restrita a categorias ativas.
- Nenhuma migration, RPC, tabela, política RLS ou contrato de integração com o Supabase foi alterado.

### Arquivos alterados nesta entrega
- `cardapio.html`
- `js/cardapio.js`
- `css/style.css` (adição de estilos escopados para Gestão do Cardápio)
- `README.md`

### Regras preservadas
- Cadastro e edição continuam utilizando as tabelas `categories` e `products`.
- Upload de imagens continua usando o bucket `menu-product-images`, com JPG, PNG ou WebP de até 5 MB.
- Os campos persistidos de categoria e produto permanecem os mesmos.
- A ativação e disponibilidade continuam sendo atualizadas no mesmo registro de produto, sem exclusão física.
- O modo de consulta continua exibindo somente produtos ativos, disponíveis e vinculados a categorias ativas.
- A autenticação administrativa permanece protegida por `requireAuth(["admin"])`.

### Validações realizadas
- Sintaxe de todos os módulos JavaScript verificada com `node --check`.
- HTML analisado e IDs duplicados verificados.
- Referências literais de IDs usadas por `js/cardapio.js` verificadas contra `cardapio.html`.
- CSS analisado sem erros de parsing.
- Não foi possível concluir a prévia visual em navegador neste ambiente, nem testar upload, autenticação ou persistência contra o Supabase real.

### Atualização
1. Faça uma cópia da pasta da V3.4.
2. Extraia este ZIP em uma pasta nova.
3. Preserve seu arquivo `js/supabaseClient.js` se ele contiver as credenciais do seu projeto Supabase.
4. Execute `index.html` com Live Server e entre com um usuário administrador.
5. Teste filtros, edição de categoria, cadastro/edição de produto, alteração de disponibilidade e upload/remoção de imagem.
6. Confira o modo de consulta para garantir que somente produtos ativos e disponíveis apareçam no cardápio da equipe.

**Migration:** não é necessária para esta entrega.

---

## Entrega anterior: V3.4 — Refinamento da Gestão de Comandas

Esta entrega dá continuidade à V3.3 e aprimora a administração de comandas, mantendo a identidade visual clara e os mesmos contratos de integração com o Supabase.

### O que mudou na V3.4
- Página de gestão reorganizada com título, contexto e filtros mais claros.
- Cards de comandas com identificação por número, cliente, status, data, unidades, total, recebido e saldo pendente.
- Painel de detalhes com hierarquia visual aprimorada para consumo, metadados, resumo financeiro e histórico de pagamentos.
- Itens cancelados identificados visualmente e itens com pagamento associado continuam sem ações de remoção ou transferência.
- Diálogos nativos `prompt()` e `confirm()` substituídos por modais próprios para editar o nome do cliente, remover item pendente e transferir item.
- Modal com validação de formulário, mensagens de erro, estado de processamento, fechamento por Escape e foco contido.
- Ícones SVG contextuais e microcopy revisada.
- Ajustes responsivos para desktop, tablet e celular.
- A filtragem por nome, número, status e data permanece; os KPIs continuam exigindo período inicial e final.
- Nenhuma alteração nas RPCs, tabelas, políticas RLS ou migrations do Supabase.

### Arquivos alterados nesta entrega
- `comandas.html`
- `js/comandas.js`
- `css/style.css` (adição de estilos escopados para Gestão de Comandas)
- `README.md`

### Regras preservadas
- Renomeação somente em comanda aberta, por `admin_rename_customer_order`.
- Remoção somente de item totalmente pendente, por `admin_remove_pending_order_item`.
- Transferência somente de item totalmente pendente para outra comanda aberta, por `admin_transfer_pending_order_item`.
- Itens com pagamento associado continuam bloqueados pela interface e validados novamente no banco.
- As RPCs continuam recebendo os mesmos nomes de parâmetros e os mesmos identificadores.

### Validações realizadas
- Sintaxe dos módulos JavaScript verificada com `node --check`.
- Estrutura HTML e IDs verificados.
- Referências de IDs do JavaScript verificadas contra a página.
- Não foi possível executar teste visual em navegador nesta sessão, nem validar operações contra o Supabase real.

### Atualização
1. Faça uma cópia da pasta da versão anterior.
2. Extraia este pacote em uma pasta nova.
3. Preserve seu arquivo `js/supabaseClient.js` caso contenha as credenciais do seu projeto Supabase.
4. Execute com Live Server e entre com um usuário administrador.
5. Teste a busca e os filtros, seleção de comanda, edição do cliente, remoção de item pendente e transferência para outra comanda aberta.

**Migration:** não é necessária para esta entrega. As migrations existentes foram mantidas sem alterações.

---

## Entrega anterior: V3.3 — Refinamento de UX/UI do Atendimento

- Reorganização visual da busca de clientes e dos estados de comanda ativa.
- Hierarquia mais clara para consumo, recebimento e fechamento.
- Cards de produtos do atendimento passam a exibir `image_url`, com fallback visual.
- Carrinho com maior destaque e ação de remoção visualmente destrutiva.
- Ajustes responsivos e microcopy revisada.

## Histórico legado — versão 1.1

Aplicação web de atendimento integrada ao Supabase.

## Estrutura
- `index.html`: login
- `dashboard.html`: painel administrativo inicial
- `atendimento.html`: atendimento, cardápio, carrinho e histórico da comanda
- `css/style.css`: estilos responsivos
- `js/`: autenticação, sessão, cardápio e comandas
- `supabase/migrations/004_order_workflow.sql`: migration de abertura de comandas e inclusão de itens (já utilizada na etapa anterior)

## Atualização 1.1
- Adicionada a seção **Consumo registrado** na tela de atendimento.
- A seção consulta os itens persistidos em `public.order_items` ao selecionar uma comanda.
- Após lançar um pedido, o histórico é atualizado automaticamente.
- Exibe produto, quantidade, preço unitário, subtotal, observações, horário (quando disponível) e status de pagamento.
- Ajustes de responsividade para impedir que as abas de categorias e os cards de produtos ultrapassem a coluna do cardápio.

## Como atualizar seu projeto local
1. Faça uma cópia de segurança da pasta atual.
2. Extraia este ZIP em uma pasta nova.
3. Se já ajustou `js/supabaseClient.js` com as credenciais do seu projeto, preserve esse arquivo ou copie as credenciais para a nova versão.
4. Abra a pasta no VS Code e execute `index.html` com Live Server.
5. Entre no atendimento, pesquise uma comanda existente e confira a seção **Consumo registrado**.

## Banco de dados
Esta atualização não exige uma nova migration. Ela consulta as tabelas e colunas que já fazem parte do fluxo de comandas existente. A aplicação precisa ter acesso de leitura aos itens da comanda pelas políticas RLS.

## Observação de segurança
Antes de colocar em produção, revise e restrinja as políticas RLS e concentre operações financeiras em funções transacionais seguras. Esta versão não implementa pagamentos nem fechamento financeiro de comandas.


## Atualização 1.2 — Recebimento de pagamentos
- Painel de recebimento na comanda.
- Seleção dos itens com saldo pendente; todos os itens elegíveis aparecem selecionados inicialmente.
- Registro de forma de pagamento e nome do pagador.
- Divisão igualitária do saldo selecionado entre 1 e 20 pessoas.
- O banco cria um pagamento por pessoa e distribui os centavos restantes sem divergência.
- Atualização de `payment_status` para `pending`, `partially_paid` ou `paid`.
- Histórico de pagamentos por pagador, forma, data, valor e itens vinculados.
- Operações financeiras executadas por RPC transacional no PostgreSQL.

### Migration necessária
Execute `supabase/migrations/005_payments_and_split.sql` no SQL Editor do Supabase antes de usar o painel de pagamentos.

### Limites desta versão
- A divisão é igualitária; os nomes dos participantes de uma divisão múltipla ficam registrados como Pessoa 1, Pessoa 2 etc.
- O pagamento seleciona o saldo restante integral dos itens marcados. Para dividir o mesmo item entre pessoas, use a opção de dividir entre pessoas.
- Esta versão registra pagamentos e atualiza os itens, mas ainda não implementa o fechamento da comanda nem relatório/estorno financeiro.
- Teste em ambiente de desenvolvimento antes de produção. Revise as políticas RLS e os perfis autorizados.


## Atualização 1.3 — Fechamento de comanda
- Exibe a opção de fechar somente quando todos os itens não cancelados estiverem quitados.
- Bloqueia o fechamento se houver itens ainda no carrinho sem salvar.
- Confirma a ação antes de encerrar.
- Registra `status = closed`, `closed_at` e `closed_by`.
- Mantém o consumo e o histórico financeiro disponíveis na tela após o fechamento.
- A RPC valida novamente o saldo no banco e bloqueia a linha da comanda durante a operação.
- Comandas fechadas não aceitam novos itens, pois a função de lançamento exige `status = open`.

### Migration necessária
Execute `supabase/migrations/006_close_order.sql` no SQL Editor do Supabase antes de testar o fechamento.

### Observação
A interface usa uma confirmação nativa do navegador. O fechamento é definitivo nesta versão; reabertura e estorno não estão implementados.


## Atualização 1.4 — Histórico administrativo de comandas
- Nova página `comandas.html`, restrita ao perfil admin.
- Lista as últimas 500 comandas e permite filtrar por cliente/número, situação e data de abertura.
- Indicadores de quantidade de comandas abertas/encerradas, consumo e recebimentos do conjunto carregado.
- Detalhe somente leitura com itens, status de pagamento, datas, mesa, total consumido, recebido, saldo e histórico financeiro.
- A página usa as funções financeiras `get_order_payment_summary` e `get_order_payment_history` já criadas na migration 005.
- Não exige nova migration SQL.

### Observações
- Os indicadores e a listagem consideram até as 500 comandas mais recentes retornadas pela consulta.
- A consulta de pagamentos usa leitura da tabela `payments`; se as políticas RLS atuais não permitirem SELECT para administradores, a página exibirá erro e será necessário ajustar a política ou criar RPC específica.
- Os campos de responsável (`opened_by` e `closed_by`) são preservados no banco, mas esta primeira tela ainda não traduz os UUIDs em nomes de funcionários.


## Atualização 1.4.1 — Consulta administrativa protegida
- A listagem usa a RPC `get_admin_order_history`, sem depender de SELECT direto do navegador nas tabelas `payments` e `orders`.
- A função exige usuário autenticado, ativo e com `profiles.role = 'admin'`.
- Retorna até 500 comandas recentes, itens, total consumido, recebido, mesa e nomes dos responsáveis quando os perfis estão disponíveis.
- Nova migration necessária: `supabase/migrations/007_admin_order_history.sql`.


## Atualização 1.5 — Indicadores dinâmicos por período
- Os filtros de data "A partir de" e "Até" passaram a controlar os quatro indicadores do topo.
- Os indicadores são atualizados imediatamente ao alterar qualquer uma das datas.
- Os indicadores consideram a data de abertura da comanda e não são alterados pela busca de cliente/número nem pelo filtro de situação.
- A listagem de comandas acompanha o período e continua podendo ser refinada por cliente/número e situação.
- O botão "Limpar período" remove somente as datas; "Limpar busca" remove somente a pesquisa e a situação.
- "Recebido das comandas" representa a soma dos pagamentos vinculados às comandas abertas no período selecionado, mesmo que o pagamento tenha ocorrido depois.
- A tela continua considerando as até 500 comandas mais recentes retornadas pela função administrativa.
- Não exige nova migration SQL; mantém a migration 007 da versão 1.4.


## Atualização 1.6 — Gestão do cardápio
- Nova página `cardapio.html`, restrita a administradores.
- Cadastro e edição de categorias (nome, descrição, ordem e situação ativa).
- Cadastro e edição de produtos (categoria, nome, descrição, preço, ordem, URL de imagem, ativo e disponível).
- Busca por nome/descrição, filtro por situação e seleção por categoria.
- Produtos podem ser marcados como indisponíveis sem apagar o histórico de comandas.
- Cadastro de produtos com nome duplicado na mesma categoria exibe confirmação antes de manter dois cadastros.
- Adicionais continuam como produtos em uma categoria separada, conforme decisão do projeto.
- A tela permite cadastrar imagens por URL. Upload direto para Storage será uma etapa posterior.
- Alterações de preço passam a valer imediatamente para novos lançamentos; os itens já lançados mantêm o preço histórico gravado na comanda.

### Migration necessária
Execute `supabase/migrations/008_menu_admin.sql` no SQL Editor do Supabase. Ela adiciona a descrição opcional da categoria e cria políticas de escrita e guardas restritivas para que apenas administradores ativos possam alterar categorias e produtos.

### Observações importantes
- A migration pressupõe as tabelas `categories`, `products` e `profiles` existentes, além das colunas já utilizadas pelo atendimento (`category_id`, `name`, `description`, `price`, `image_url`, `active`, `available`, `display_order`).
- A tela não apaga categorias ou produtos: desative-os para preservar referências e histórico.
- Imagens são cadastradas por URL nesta versão; o upload pelo painel exige configuração de Supabase Storage e será desenvolvido separadamente.


## Atualização 1.7 — Melhorias no atendimento
- Campo de cliente com autocomplete por prefixo: sugere nomes que possuem comandas abertas conforme o usuário digita.
- Selecionar uma sugestão preenche o nome e consulta todas as comandas abertas correspondentes.
- A seleção de comanda exibe o número antes do nome (ex.: `Comanda #3 · Joyce`).
- Ao tentar abrir outra comanda com um nome que já possui comanda aberta, o sistema solicita sobrenome ou apelido para diferenciar o cliente.
- Removida a associação de mesas da experiência de atendimento e da consulta de histórico. A estrutura de tabelas no banco foi preservada, sem exclusão de dados.
- Adicionado botão flutuante “Voltar” nas telas administrativas, atendimento, histórico e cardápio. Usa a navegação anterior do próprio site quando disponível e uma rota de retorno como alternativa.
- Não exige nova migration no Supabase.

### Observação sobre nomes iguais
A identificação de duplicidade é baseada em comandas abertas com o mesmo nome. Ao abrir uma nova comanda com esse nome, o atendente informa sobrenome ou apelido. Para continuar uma comanda já existente, basta selecionar a comanda correspondente.


## Atualização 1.8 — Sugestões a partir da primeira letra
- O autocomplete de clientes agora inicia a busca com apenas um caractere digitado.
- As sugestões continuam limitadas a clientes com comandas abertas e são atualizadas conforme o atendente digita.
- Não exige nova migration no Supabase.


## Atualização 1.9 — Atendimento como central de comandas
- A sessão Atendimento passa a oferecer consulta por cliente e um atalho para listar todas as comandas abertas.
- A listagem de comandas abertas permite pesquisar por nome do cliente ou número da comanda.
- A seleção pela lista geral abre uma visualização de consulta, sem exibir os controles de pagamento e lançamento de produtos.
- Na visualização, o atendente pode escolher `Adicionar produtos` para entrar no modo operacional da comanda.
- A comanda ganhou apresentação de comprovante de consumo, com identificação do estabelecimento, número, cliente, abertura, itens, quantidades, preços, total consumido, total recebido e saldo pendente.
- Adicionado botão para imprimir o comprovante; a impressão oculta os demais módulos da tela.
- A confirmação de fechamento agora usa modal do próprio sistema, em vez do alerta nativo do navegador.
- Incluídos estados de carregamento para a consulta geral, abertura da comanda, atualização do consumo e ações de gravação.
- Não exige nova migration no Supabase.
- O comprovante é um documento de consumo interno e não substitui documento fiscal emitido pelo sistema fiscal do estabelecimento.


## Atualização 2.0 — Design system e navegação global
- Criado um design system global com tokens semânticos de cor, tipografia, espaçamento, bordas, sombras e estados.
- Sidebar persistente no desktop e menu retrátil no celular/tablet em todas as páginas autenticadas.
- Marca/logo funciona como atalho para a Home: painel administrativo para administradores e Atendimento para equipe.
- Navegação contextual com destaque da seção atual e identificação do perfil conectado.
- Visão geral redesenhada com atalhos claros para Atendimento, Histórico de comandas e Gestão do cardápio.
- Separação explícita entre o cardápio operacional do garçom (dentro de Atendimento) e o gerenciamento administrativo (página Gestão do cardápio).
- Estados semânticos para aberto/pendente, concluído/pago e cancelado, com contraste e cores consistentes.
- Componentes globais revisados para formulários, botões, painéis, listas, modais, toasts, carregamento e responsividade.
- A confirmação de produto duplicado no gerenciamento de cardápio passou a usar modal próprio, sem `window.confirm`.
- Layout adaptado para desktop, tablet e celular, com sidebar recolhível, grids flexíveis e áreas de toque maiores.
- Nenhuma alteração de banco ou migration é necessária nesta atualização.
- A tela de login permanece sem sidebar, por ser a área pública de autenticação; ela também recebeu o novo padrão visual.


## Recomendações de publicação da versão 2.0
1. Faça backup da pasta atualmente publicada.
2. Substitua os arquivos do front-end pelos desta versão, preservando `js/supabaseClient.js` se suas credenciais locais forem diferentes.
3. Publique todos os arquivos HTML, CSS e JS juntos para evitar mistura de versões.
4. Teste o login com um usuário administrador e outro funcionário: o administrador deve ver Visão geral, Atendimento, Comandas e Gestão do cardápio; o funcionário deve ver apenas Atendimento.
5. Teste a navegação lateral em desktop e celular, a consulta de comandas, o lançamento de produtos e a confirmação de produto duplicado.

A sidebar é criada pelo `js/navigation.js` nas páginas autenticadas. A página pública `index.html` (login) permanece sem menu lateral. A navegação não substitui as regras de autorização e RLS do Supabase; os guards existentes continuam responsáveis por proteger as páginas.


## V2.1 — Recuperação funcional + refinamento semântico
Esta versão foi reconstruída sobre a V2.0 funcional. Os HTMLs e scripts de negócio foram preservados byte a byte; as telas demonstrativas e scripts de exemplo da outra proposta não foram incorporados porque substituíam fluxos reais por conteúdo estático ou `console.log`.

Ajustes desta versão:
- Pagamento pendente passa a usar vermelho suave para chamar atenção.
- Comanda aberta / atendimento em andamento permanece em laranja.
- Pagamento realizado e comanda encerrada permanecem em verde.
- Cancelamentos e ações destrutivas usam o estado vermelho.
- Mantida a identidade escura em tons terrosos já adotada no projeto, evitando substituir a marca por uma paleta azul genérica.
- Mantida a separação de permissões: atendimento operacional para a equipe; gestão do cardápio e histórico administrativo para administrador.
- Nenhuma migration ou alteração no banco é necessária.

Importante: a proposta externa continha scripts demonstrativos de poucas linhas e telas com dados fictícios (mesas, comandas e produtos estáticos). Esses arquivos não devem substituir os módulos integrados ao Supabase. As migrations 004 a 008 são idênticas nas duas entregas e foram mantidas.


## V2.2 — Design visual Gemini aplicado sobre a base funcional

### Elementos visuais incorporados
- Tema claro SaaS com fundo `#f8fafc`, superfícies brancas e sidebar navy `#0f172a`.
- Paleta principal azul (`#2563eb`) para ações primárias.
- Estados semânticos: verde para concluído/pago, laranja para atendimento/comanda aberta, vermelho para pendente/cancelado e azul para pagamento parcial.
- Fonte Inter, sombras suaves, cantos de 12px e transições de 200ms.
- Sidebar e navegação adaptadas ao layout responsivo existente.
- Modal genérico `mostrarModal(titulo, mensagem, aoConfirmar)` e `fecharModal()`, sem fallback para `alert()` ou `confirm()` nativos.
- Logo da sidebar e marca da tela de login apontam para `index.html`; quando já autenticado, o fluxo de autenticação redireciona para a Home correspondente ao perfil.
- Botão `Ver modo garçom` no gerenciamento do cardápio leva ao fluxo operacional existente em Atendimento. A gestão continua protegida para administradores.

### Elementos não copiados
- Não foram copiados os HTMLs demonstrativos do pacote externo, pois substituíam as telas reais por grids vazios de mesas, comandas e produtos.
- Não foram copiados os scripts externos curtos/stub, pois não continham as integrações e regras reais do Supabase.
- Não foi substituída a tela de login por um dashboard estático. `index.html` continua sendo o ponto de entrada autenticado, e a autenticação redireciona usuários já logados.
- Não foi introduzido conceito de mesas: o projeto continua baseado em comandas identificadas pelo cliente e número da comanda.

### Integridade funcional
- `atendimento.js`, `comandas.js`, `orders.js`, `products.js`, `auth.js`, `guards.js` e `supabaseClient.js` permanecem byte a byte iguais à V2.1 funcional.
- `cardapio.js` recebeu apenas o atalho visual para o modo garçom; os fluxos de CRUD continuam preservados.
- `utils.js` recebeu as funções de modal genérico.
- `navigation.js` recebeu apenas a adaptação visual da sidebar e o destino da marca para `index.html`.
- Nenhuma migration nova é necessária.

### Testes executados
- Sintaxe dos 10 arquivos JavaScript validada com `node --check`.
- Verificado que os módulos de negócio e configuração do Supabase foram preservados.
- Verificado que não há chamadas nativas `alert()` ou `confirm()` nos scripts.
- Integridade do arquivo ZIP validada.
- A validação é estática; a operação real deve ser conferida no navegador conectado ao Supabase.


## V2.5 — Correção de carregamento e UX operacional

- Corrigida a tela de Gestão do Cardápio: o JavaScript registrava eventos em elementos da visão do garçom que não existiam no HTML, interrompendo a inicialização antes da consulta ao Supabase. Foram adicionadas as estruturas `adminView` e `waiterView`, incluindo busca, abas de categoria e grade de produtos.
- Corrigido o texto/estado do botão de alternância entre visão administrativa e consulta do garçom.
- Adicionado overlay global de processamento com fundo desfocado e contador de requisições concorrentes, integrado ao `fetch` do cliente Supabase. O feedback passa a cobrir operações de todas as páginas que utilizam o cliente.
- Indicadores da tela Comandas iniciam vazios e só apresentam valores quando as datas inicial e final forem selecionadas. Períodos incompletos ou inválidos mantêm os indicadores como traço.
- Refinados ícone, hierarquia, espaçamento e botões do modal global.
- Nenhuma migration, tabela, RPC ou regra de autenticação foi alterada.

Validações estáticas: `node --check` em todos os módulos JavaScript; IDs essenciais da visão dual do cardápio presentes; ausência de chamadas nativas `alert()`/`confirm()`.


## V2.6 — Lapidação do atendimento e recebimento
- Atendimento: painel de recebimento destacado em verde, com seleção de itens e divisão opcional.
- Forma de pagamento e nome do pagador removidos da interface; o registro usa os valores internos padronizados `outro` e `Atendimento` para manter compatibilidade com a RPC financeira existente.
- Após quitar todo o saldo, o sistema pergunta se deseja encerrar a comanda.
- Cancelamento permitido somente para comanda aberta sem itens e sem pagamentos, por meio da RPC `cancel_empty_customer_order`.
- Atalhos de recebimento adicionados às listas de comandas abertas no Atendimento.
- Nova migration: `009_cancel_empty_order.sql`. Deve ser executada no Supabase antes de usar o cancelamento de comandas vazias.
- Não foram alteradas as migrations financeiras existentes nem os fluxos de criação e lançamento de itens.

## V2.6.1 — Correção de compatibilidade do método de pagamento
- A RPC `receive_order_payment` continua recebendo o valor interno `outro`, validado pela função existente.
- Na gravação, normaliza `outro` para `other`, valor aceito pela constraint `payments_payment_method_check` já existente no banco.
- Não altera a constraint, não modifica pagamentos anteriores e não exige recriação de tabelas.
- Nova migration: `010_payment_method_compatibility.sql`.

## V2.6.2 — Correção de atribuição do ID do pagamento
- Corrigido o retorno do `INSERT` da RPC `receive_order_payment`: o ID é recebido primeiro em uma variável escalar `uuid` e depois atribuído ao índice correspondente do array `uuid[]`.
- Evita a tentativa inválida de usar um elemento de array diretamente como alvo do `RETURNING INTO` no PL/pgSQL.

## V2.9 — Gestão de comandas

Esta versão adiciona edição do nome do cliente, remoção de item pendente e transferência de item pendente entre comandas abertas. Antes de testar, execute `supabase/migrations/011_order_management.sql` no SQL Editor do Supabase. As operações são restritas a administradores ativos e registradas em `order_management_events`. Itens com status diferente de `pending` ou com qualquer vínculo em `payment_items` não podem ser removidos ou transferidos.

## V4.2 — Relatórios de consumo e pagamentos

Esta versão adiciona o módulo administrativo **Relatórios**, acessível pela navegação lateral e pela área de acessos rápidos do Dashboard.

### O que foi implementado
- Página `reports.html` com filtros obrigatórios de data inicial/final e filtro por situação financeira: Todos, Pago, Pendente, Parcialmente pago e Cancelado.
- Dois cards principais: **Total pago** e **Total pendente**. Cada card apresenta o valor em reais e a quantidade de lançamentos com valor recebido ou com saldo em aberto. Os indicadores iniciam zerados e só são preenchidos após aplicar um período.
- Tabela detalhada com Data/hora, Cliente/comanda, Produto, Quantidade, Preço unitário, Preço total e Status.
- Paginação de 100 lançamentos por página (a RPC aceita até 200), mantendo o resumo calculado sobre todo o resultado filtrado, não apenas sobre a página visível.
- Valores financeiros calculados por item com base na soma de `payment_items.amount`. Itens cancelados permanecem consultáveis quando o status for Todos ou Cancelado, mas não entram nos totais financeiros.
- Lançamentos parcialmente pagos são contabilizados nos dois contadores: têm valor recebido e também saldo pendente. Os contadores representam lançamentos de produto, não unidades individuais.
- A data/hora do filtro corresponde ao momento em que o produto foi lançado na comanda (`order_items.created_at`). Os valores recebidos consideram todos os pagamentos já vinculados ao item, mesmo que tenham ocorrido depois da data do lançamento.

### Backend / Supabase
- Nova migration: `supabase/migrations/014_order_item_reports.sql`.
- Nova RPC: `get_order_item_report(date, date, text, integer, integer)`.
- A RPC é `SECURITY DEFINER`, usa `search_path` fixo, valida usuário autenticado e administrador ativo, revoga execução de `PUBLIC` e `anon` e concede execução a `authenticated`.
- A consulta usa `orders`, `order_items` e `payment_items`; não soma `payments.amount` por comanda para evitar duplicar/atribuir valores incorretamente entre produtos.
- Índice adicionado em `order_items(created_at DESC)` para apoiar o filtro temporal.
- Nenhuma regra de pagamento, função de recebimento, encerramento, tabela operacional ou política RLS existente foi alterada.

### Arquivos alterados/adicionados
- `reports.html` (novo)
- `js/reports.js` (novo)
- `js/navigation.js` (nova rota administrativa e ícone)
- `dashboard.html` (atalho e contagem de módulos)
- `css/style.css` (componentes do relatório e responsividade)
- `supabase/migrations/014_order_item_reports.sql` (nova RPC e índice)
- `supabase/VALIDACAO_RELATORIOS_PROMPT.md` (prompt para auditoria prévia no Supabase AI)
- `supabase/VALIDAR_SCHEMA_RELATORIOS.sql` (consultas somente leitura para conferir tipos, constraints, índices e RPCs no schema ativo)
- `README.md`

### Status do backend no ambiente atual
- A auditoria do schema ativo foi executada no Supabase e confirmou as colunas, tipos, constraints e relacionamentos necessários.
- `order_items.created_at` foi confirmado como `timestamp with time zone` (`timestamptz`).
- A migration `014_order_item_reports.sql` foi executada pelo usuário no projeto Supabase e a assinatura `get_order_item_report(date, date, text, integer, integer)` foi confirmada.
- A consulta de confirmação retornou `SECURITY DEFINER = true` e `authenticated_can_execute = true`.
- **Não execute novamente a migration 014 neste mesmo projeto**, pois ela já está aplicada. Para instalar em outro projeto Supabase, execute primeiro `supabase/VALIDAR_SCHEMA_RELATORIOS.sql`, compare os tipos e relacionamentos e só então aplique a migration.

### Validação funcional após publicação
1. Entre no sistema com perfil de administrador e abra **Relatórios**.
2. Informe as datas inicial e final, escolha o status desejado e clique em **Filtrar relatório**.
3. Confira períodos com itens pagos, pendentes, parcialmente pagos e cancelados.
4. Compare pelo menos uma comanda com o histórico de pagamentos para validar a atribuição por produto.

### Escopo das novas abas
O pedido mencionou duas novas abas, mas somente a aba **Relatórios** foi detalhada. Esta versão adiciona apenas essa aba; a segunda não foi criada para evitar inventar uma funcionalidade sem requisitos.

### Limitação conhecida
O resumo é calculado pela data de lançamento do item e considera o valor pago atualmente vinculado a ele. Portanto, um pagamento recebido após a data final continuará compondo o total pago do item lançado dentro do período filtrado. Isso mantém a visão financeira atual do consumo no período.


## V3.9.1 — Ajuste visual da lista “Comandas abertas”

- Reorganizado o card da comanda em uma única coluna: identificação, resumo financeiro e ações ficam em regiões próprias.
- Os botões “Consultar”, “Receber pagamento” e “Fechar comanda” deixam de ocupar uma coluna lateral que comprimia o resumo financeiro.
- Status e nome do cliente podem quebrar linha sem ultrapassar a borda do card.
- A lista passou a ocultar overflow horizontal e manter a rolagem vertical.
- Em telas menores, o resumo financeiro passa para duas colunas e os botões se adaptam à largura disponível.
- Nenhum JavaScript, cálculo financeiro, chamada RPC, tabela, política RLS ou migration foi alterado nesta versão.

Validação realizada: conferência dos seletores e da cascata CSS adicionada. Recomenda-se testar a modal em desktop e celular no navegador local.


## V4.2.1 — Auditoria final e otimização de entrega

- Auditoria estática dos seis módulos: Login, Visão geral, Atendimento, Comandas, Gestão do cardápio e Relatórios.
- Todos os caminhos locais de CSS, JavaScript, imagens, ícones e navegação foram conferidos para publicação na raiz do GitHub Pages, inclusive em URL de projeto (`/<repositório>/`).
- Os 11 módulos JavaScript passaram em `node --check`; páginas HTML sem IDs duplicados; nenhuma referência local ausente.
- Renderização estática com Chromium em 36 combinações de viewport (1440, 1024, 768, 390, 360 e 320 px): sem overflow horizontal no documento. O teste não executou os módulos contra Supabase real.
- Corrigidos os nomes acessíveis dos campos auxiliares de busca de comandas abertas e URL alternativa de imagem.
- Melhorado o contraste dos botões principais e de sucesso/pagamento, das abas de categoria ativas, dos títulos de seção e dos textos auxiliares.
- Logo operacional convertido para WebP de alta qualidade (aprox. 110 KB, antes aprox. 680 KB em PNG), mantendo o JPG original enviado e os favicons existentes.
- O carregamento da fonte Inter foi movido de `@import` CSS para links de stylesheet com `preconnect`, mantendo `display=swap` e fontes de sistema como fallback.
- Nenhuma lógica de negócio, RPC, regra de pagamento, autenticação, política RLS ou migration foi modificada nesta revisão.

### Limitações desta auditoria
A renderização responsiva foi verificada com HTML/CSS em Chromium e dados visuais estáticos. A navegação automatizada completa foi bloqueada pelas restrições do ambiente de auditoria; portanto, não foram realizados login real, chamadas autenticadas ao Supabase, operações de gravação, upload real de imagem ou impressão por diálogo do navegador. Esses fluxos devem ser conferidos no ambiente publicado antes da abertura ao público.

## V4.2.2 — refinamento mobile e cancelamento de comanda vazia

- Modal "Comandas abertas" otimizado para celulares: altura limitada à viewport, lista com rolagem própria, busca e atualização lado a lado e botões compactos.
- Campos de data da aba Relatórios limitados à largura interna do painel para evitar overflow em navegadores móveis.
- Botão flutuante "Voltar" passa ao fluxo normal do documento em telas pequenas, evitando cobrir o comprovante e os detalhes da comanda.
- Ao consultar uma comanda aberta sem consumo ativo (incluindo itens já cancelados), o Atendimento apresenta a ação "Cancelar comanda vazia" com confirmação.
- O cancelamento reutiliza a RPC existente `cancel_empty_customer_order`; o banco continua revalidando que não existem itens ativos nem pagamentos. A ação é ocultada enquanto houver produtos no carrinho.

### Validação da V4.2.2
- 11 módulos JavaScript aprovados em `node --check`.
- 6 páginas HTML verificadas sem IDs duplicados e sem referências locais ausentes.
- CSS analisado sem erros de parsing.
- Não foram alteradas as regras de pagamento, RPCs existentes, migrations, autenticação ou RLS.
- Testes conectados ao Supabase real e navegação manual em dispositivos físicos continuam necessários antes da homologação em produção.

---

## V4.2.3 — Refinamento mobile do Atendimento e Relatórios

- Corrigida a contenção dos campos de data do Relatório em telas móveis.
- Reorganizado o cabeçalho da comanda ativa/consultada, com selo de status compacto e botões alinhados.
- A situação exibida agora corresponde ao estado real da comanda: ABERTA, ENCERRADA ou CANCELADA.
- A impressão foi removida exclusivamente da tela de Atendimento; a impressão em Gestão de Comandas foi preservada.
- A consulta de consumo continua disponível no Atendimento.
- O cancelamento de comanda vazia mantém a confirmação e a RPC já existentes.
- Nenhuma migration adicional ou alteração de backend é necessária.

Consulte `RELATORIO_AJUSTES_V4_2_3.md` para o escopo e as limitações dos testes.
