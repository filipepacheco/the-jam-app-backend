1. Visão Geral / Objetivo
   Desenvolvimento de um aplicativo web responsivo voltado para a organização de Jam Sessions presenciais e facilitar o gerenciamento em tempo real de apresentações, permitindo que músicos se inscrevam para tocar músicas específicas, e que um coordenador (Host) administre toda a sequência do evento de forma simples.
   Com este aplicativo será possível:
   O Host cadastrar músicas, definir vagas por especialidade musical (vocal, guitarra, etc.), aprovar ou rejeitar inscrições, iniciar e encerrar músicas e alterar a ordem do repertório durante o evento.
   Os Músicos poderão se registrar, informar suas especialidades, escolher músicas para participar e acompanhar em tempo real a programação da Jam.
   O Público terá acesso, por meio de um painel (dashboard) projetado em telão ou acessado por link, para visualizar a lista das músicas e os músicos escalados.
   O aplicativo funciona em tempo real com base em tecnologia de comunicação instantânea ("sockets"), garantindo que qualquer ação realizada pelo Host seja imediatamente refletida para todos os participantes e visualizadores.
   Objetivo final de organizar e agilizar Jams de um evento, tornando as Sessions mais dinâmicas e bem estruturadas, sem a necessidade de planilhas ou processos manuais.

2. Público-Alvo
   Três perfis principais de usuários dentro de uma Jam Session presencial:
   Músicos amadores – que participam de eventos por hobby e procuram uma forma prática de se organizar e interagir com outros músicos.
   Músicos profissionais – que atuam em apresentações regulares e podem utilizar o aplicativo para agilizar a montagem de repertórios em apresentações colaborativas.
   Estudantes de música – que buscam oportunidades de praticar e tocar em conjunto, tendo uma visão clara das músicas e das funções disponíveis.
   Além dos músicos, o sistema também atende o público presente nos eventos, que poderá visualizar a lista de músicas e músicos escalados através de painéis públicos projetados em telões ou acessíveis via link, proporcionando maior engajamento e acompanhamento da Jam.
3. Escopo Funcional (MVP)
   O aplicativo incluirá, na sua primeira versão, as seguintes funcionalidades:
   Para o Host
   Criação de uma Jam, com definição de data, nome e controle de status (planejada, em execução, encerrada).
   Cadastro de músicas com título, autor, duração e demandas de vagas por especialidade.
   Capacidade de aprovar ou rejeitar inscrições de músicos para cada função da música.
   Alterar a ordem das músicas na fila a qualquer momento durante o evento.
   Iniciar e encerrar músicas, com atualização imediata para todos os usuários.
   Alterar a escala de músicos mesmo durante a execução de uma Jam.
   Tela restrita com a visualização de todas as jams disponíveis, futuras e passadas, e com links de compartilhamento para cada uma
   Para os Músicos
   Cadastro rápido com nome, especialidade e meio de contato, recebendo identificação única.
   Escolha de músicas disponíveis para participação, respeitando limite de vagas por especialidade.
   Acompanhamento, em tempo real, da programação da Jam com destaque para suas próximas músicas.
   Acesso a um dashboard individual com histórico de participações.
   Para o Público
   Visualização, em painel público (dashboard), da lista completa de próximas músicas, música tocando atualmente e músicos escalados.
   Acesso ao painel via telão central ou link compartilhado, com atualizações em tempo real.
   Funcionalidades gerais
   Controle automático de vagas para evitar inscrições duplicadas ou acima do limite.
   Atualizações instantâneas via tecnologia de sockets, eliminando a necessidade de recarregar a página.
   Armazenamento de histórico de jams, músicas e participações para consulta futura.


4. Fluxo Geral de Uso
   O funcionamento do aplicativo durante uma Jam Session segue a sequência abaixo:
   Preparação da Jam
   O Host cria uma nova Jam no aplicativo, define seu nome, data e cadastra as músicas que serão tocadas, informando as vagas por especialidade musical (ex.: 2 guitarras — sendo 1 base e 1 solo, 1 baixo, 1 bateria etc.).
   O host então compartilha o link/QR code da Jam para os músicos interessados
   Inscrições de Músicos
   Músicos acessam a Jam, a partir do link ou QR Code e realizam cadastro rápido;
   Celular e Nome, que será um dado único
   Escolhem, no repertório disponível, as músicas em que desejam participar.
   O sistema registra a inscrição como “pendente” e envia para análise do Host.
   Aprovação pelo Host
   O Host aprova ou rejeita cada inscrição, respeitando o número máximo de vagas por especialidade.
   Ao aprovar, o músico passa a fazer parte da escala daquela música.
   Execução da Jam
   O Host dá a jam como iniciada
   O Host começa uma música (status “em execução”), o que é imediatamente refletido nos dashboards público e individuais.
   Quando a música termina, o Host encerra o status desta música e prepara a próxima, podendo alterar a ordem caso necessário.
   Visualização pelo Público
   Telão ou link mostra o painel público com a ordem das músicas, músicos escalados e status em tempo real.
   Músicos têm acesso ao seu painel individual com as próximas apresentações e histórico.
   Histórico e Encerramento
   Após o evento, o sistema grava o histórico de músicas executadas e participações, permitindo consultas futuras.
   Fluxograma simplificado:
   [Host cria Jam]
   ↓
   [Cadastra músicas + vagas]
   ↓
   [Host gera QR Code]
   ↓
   [Músico faz cadastro e escolhe músicas]
   ↓
   [Sistema registra inscrição]
   ↓
   [Host aprova/rejeita participação]
   ↓
   [Host inicia música] ↔ [Dashboards atualizam]
   ↓
   [Host encerra música]
   ↓
   [Host encerra Jam]
   ↓
   [Histórico gravado]

5. Arquitetura e Tecnologias
   Front-end (parte visual)
   Vite
   React
   TypeScript
   TailwindCSS (ou equivalente para estilização responsiva)
   Back-end (sistema)
   Node.js, TypeScript, NestJS (framework modular com suporte a WebSockets)
   Socket.IO (comunicação em tempo real)
   Prisma ORM (interação com banco de dados)
   PostgreSQL (banco de dados relacional)
   Infraestrutura
   Hospedagem Back-end
   Railway (plano inicial gratuito, escalável conforme necessidade)
   Hospedagem Front-end
   Vercel (plano inicial gratuito para deploy rápido e responsividade)
   Banco de Dados
   Supabase (plano inicial gratuito, compatível com PostgreSQL e integrado com Prisma)
   Domínio
   Registro.br (.com.br), custo aproximado de R$ 40,00 por ano (~R$ 3,33 mensais) com certificado SSL incluso na hospedagem.
   Justificativa de Infraestrutura
   A escolha por Railway, Vercel e Supabase se baseia na possibilidade de iniciar o projeto sem custo de infraestrutura, aproveitando planos gratuitos robustos para fases de desenvolvimento e primeiros eventos.
   Essa abordagem reduz despesas iniciais, permitindo que o sistema ganhe maturidade antes de migrar para provedores pagos de maior escala (como AWS ou Google Cloud) caso haja aumento de demanda
   Possíveis valores futuros de infraestrutura
   O crescimento do uso do sistema (aumento no número de jams simultâneas, maior volume de dados armazenados e necessidade de desempenho otimizado) poderá exigir migração para serviços pagos. Neste cenário, é possível estimar um custo mensal variando entre R$ 100,00 e R$ 450,00, considerando hospedagem dedicada para back-end, front-end com plano profissional, banco de dados escalável e ferramentas de monitoramento/logs avançados. Esse investimento garante maior estabilidade, suporte técnico especializado e capacidade para atender eventos de maior porte.
6. Modelagem de Dados
   O sistema será estruturado a partir de entidades básicas que representam os elementos envolvidos em uma Jam:
   Jam
   Representa o evento em si
   Contém informações como nome, data, estado atual (planejada, em execução, encerrada) e lista de músicas programadas.
   Música
   Título
   Autor
   Duração
   Demandas (baixo, bateria, etc.)
   Músico
   Nome
   Especialidade principal
   Especialidades secundárias
   Telefone
   A cada jam, um músico pode estar associado a várias músicas
   Inscrição
   Jam
   Musica
   Especialidade
   Status
   Pedido feito pelo músico para participar de determinada música, aguardando aprovação ou rejeição pelo Host.
   Escala
   Associação entre Jam, Músicas e Músicos
   Associação aprovada entre músico e função em uma música específica da jam
   Histórico
   Registro de todas as músicas executadas e dos músicos que participaram, para consulta e referência futura.
   Essas entidades se relacionam de forma a permitir que o sistema mantenha controle total sobre inscrições, aprovações, execução de músicas e armazenamento de histórico, garantindo organização e rastreabilidade.
7. Cronograma de Sprints
   O desenvolvimento será organizado em ciclos quinzenais (sprints), garantindo progressão contínua e oportunidades para revisão e ajustes.
   Previsão inicial:
   Sprint 1 – Configuração e Base do Projeto
   Configuração da infraestrutura de desenvolvimento.
   Implementação das entidades principais no backend.
   Estrutura inicial do front-end responsivo.
   Sprint 2 – Módulo Host (Cadastro e Gerenciamento de Músicas/Jam)
   Criar interface e lógica para criação de Jam.
   Cadastro de músicas e definição de vagas por especialidade.
   Controle de status da Jam.
   Sprint 3 – Módulo Participante (Inscrição e Consulta)
   Cadastro rápido de músicos.
   Seleção de músicas para participação.
   Envio de inscrições para aprovação do Host.
   Sprint 4 – Módulo de Aprovação e Escala Dinâmica
   Aprovação/Rejeição de inscrições.
   Alteração de escala durante execução.
   Controle automático de vagas por função.
   Sprint 5 – Funcionalidades em Tempo Real e Dashboards
   Comunicação via socket entre host, participantes e público.
   Dashboard público e dashboard individual.
   Atualizações instantâneas e prevenção de conflitos.
   Sprint 6 – Histórico e Encerramento
   Registro automático de histórico de participações.
   Consulta de histórico no painel.
   Ajustes finais e preparação para homologação.
   Sprint 7 – Testes e Homologação
   Teste com evento piloto.
   Correções, otimizações e entrega para uso em produção.
8. Custos de Desenvolvimento
   O projeto poderá ser contratado em duas modalidades de investimento, permitindo flexibilidade ao cliente conforme sua preferência:
   Modalidade 1 – Valor Fixo pelo Projeto
   Desenvolvimento completo conforme escopo definido no MVP.
   Inclui todas as funcionalidades, testes, homologação e suporte inicial.
   Prazo estimado: 13 a 14 semanas (aproximadamente 3 meses e meio).
   Valor: R$ XX.XXX,00 (a definir conforme negociação final).
   Modalidade 2 – Valor por Sprint
   Desenvolvimento dividido em sprints quinzenais, cada uma com objetivos claros e entregas parciais.
   Valor por sprint: R$ X.XXX,00 (a definir).
   Quantidade de sprints previstas: 7.
   Custo total estimado ao final do projeto: R$ XX.XXX,00 (variável conforme ajustes no escopo durante o desenvolvimento).
   Observações:
   Em ambas as modalidades, o suporte inicial está incluso.
   Possíveis mudanças de escopo durante o desenvolvimento poderão impactar o prazo e custo, sendo acordadas previamente entre as partes.
9. Custos de Infraestrutura
   O aplicativo poderá operar inicialmente com infraestrutura de baixo custo, aproveitando planos gratuitos robustos para os primeiros eventos e fase inicial de uso.
   Segue a estimativa de custos:
   Infraestrutura inicial (planos gratuitos)
   Hospedagem Backend: Railway – R$ 0/mês
   Hospedagem Front-end: Vercel – R$ 0/mês
   Banco de Dados: Supabase – R$ 0/mês
   Domínio: Registro.br (.com.br) – R$ 40/ano (~R$ 3,33/mês)
   Certificado SSL: incluso na hospedagem
   Infraestrutura profissional (futura, quando houver aumento de demanda):
   Hospedagem Backend dedicada: R$ 90 a R$ 150/mês
   Hospedagem Front-end Pro: R$ 80/mês
   Banco de Dados escalável: R$ 60/mês
   Monitoramento e logs avançados: R$ 50 a R$ 120/mês
   Domínio: R$ 40/ano
   Total estimado mensal (inicial): ~R$ 3,33
   Total estimado anual (inicial): ~R$ 40,00
   Total estimado mensal (profissional): ~R$ 100 a R$ 450
   Total estimado anual (profissional): ~R$ 1.600 a R$ 5.400


