# PDI — Fluxo e Casos de Teste

## 1. Visão geral

O **PDI (Plano de Desenvolvimento Individual)** permite criar, aprovar, acompanhar e encerrar planos de desenvolvimento por colaborador. Envolve:

- **Criação** por RH ou gestor (gestor só para subordinados).
- **Ciclo de vida**: Rascunho → Em aprovação → Ativo → Concluído → (opcional) Arquivado.
- **Objetivos e planos de ação** (curso ou prática): progresso do objetivo calculado automaticamente a partir dos planos de ação; planos tipo curso com progresso sincronizado do curso (somente leitura); planos tipo prática com progresso manual (colaborador pode atualizar nas ações em que é responsável).
- **Check-ins** durante o PDI ativo e comentário do colaborador no último check-in.
- **Diagnóstico** opcional a partir de Avaliação ou DISC vinculados.

---

## 2. Objetivos e planos de ação (modelo)

- **Objetivo (meta)**: O que o colaborador quer alcançar. Tem descrição, prioridade, prazo; **não tem** status nem progresso editáveis. O progresso e o status do objetivo são **calculados** a partir dos planos de ação vinculados (média do progresso; status derivado: não iniciado / em andamento / concluído).
- **Plano de ação**:
  - **Tipo Curso**: vinculado a um curso atribuído (`course_assignment_id`). O progresso e o status vêm do curso (roadmap + questionário) e são **sincronizados automaticamente**; o usuário não edita.
  - **Tipo Prática**: atividades práticas. O progresso e o status são **manuais**; o responsável pela ação (ou gestor/RH) pode atualizar (porcentagem, +10%, Concluir, dropdown de status).
- O progresso do PDI (cabeçalho) continua sendo o total de ações concluídas / total de ações.

---

## 3. Fluxo do PDI

### 3.1 Diagrama de estados

```mermaid
stateDiagram-v2
    [*] --> draft: Criar PDI
    draft --> in_approval: Gestor envia para aprovação
    in_approval --> draft: RH devolve para ajustes
    in_approval --> active: RH aprova
    active --> closed: Gestor/RH encerra
    closed --> archived: RH arquiva
```

### 3.2 Transições e responsáveis

| Status atual   | Ação                    | Quem pode        | Novo status   |
|----------------|-------------------------|------------------|---------------|
| Rascunho      | Enviar para aprovação   | Gestor / RH      | Em aprovação  |
| Em aprovação  | Aprovar                 | RH               | Ativo         |
| Em aprovação  | Devolver para ajustes   | RH               | Rascunho      |
| Ativo         | Encerrar PDI            | Gestor / RH      | Concluído     |
| Concluído     | Arquivar PDI            | RH               | Arquivado     |

### 3.3 Fluxo de uso resumido

1. **RH ou Gestor** cria o PDI (colaborador, período, origem, opcional: avaliação/DISC).
2. **Gestor/RH** preenche objetivos e planos de ação (ou gera via diagnóstico, se houver avaliação/DISC).
3. **Gestor** envia para aprovação → status "Em aprovação".
4. **RH** aprova → "Ativo" ou devolve → "Rascunho".
5. Com PDI **Ativo**: **Gestor/RH** registra check-ins; **Colaborador** pode comentar no último check-in.
6. **Gestor/RH** encerra o PDI (resultado + comentário) → "Concluído".
7. **RH** pode arquivar → "Arquivado".

---

## 4. Permissões

| Ação                         | Colaborador | Gestor (subordinado) | RH   |
|-----------------------------|-------------|----------------------|------|
| Ver lista de PDIs           | Só os próprios | Próprios + equipe  | Todos do tenant |
| Criar PDI                   | Não         | Sim (equipe)         | Sim  |
| Ver detalhe do PDI          | Só próprio  | Equipe               | Todos |
| Editar objetivos/ações      | Não         | Sim                  | Sim  |
| Atualizar progresso/status (ações tipo prática em que é responsável) | Sim | Sim | Sim  |
| Enviar para aprovação       | Não         | Sim                  | Sim  |
| Aprovar / Devolver          | Não         | Não                  | Sim  |
| Registrar/editar check-in   | Não         | Sim                  | Sim  |
| Comentar no check-in        | Sim (próprio, último) | Não | Não  |
| Encerrar PDI                | Não         | Sim                  | Sim  |
| Arquivar PDI                | Não         | Não                  | Sim  |

---

## 5. Casos de teste

### 5.1 Lista de PDIs (`/pdis`)

| ID  | Cenário                          | Pré-condição              | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------------|---------------------------------------------|----------------------------------------|
| L01 | RH acessa lista                  | Usuário role `hr`         | Login → Menu PDI                             | Ver todos os PDIs do tenant; botão "Novo PDI"; filtros Colaborador e Status |
| L02 | Gestor acessa lista              | Usuário role `manager`    | Login → Menu PDI                             | Ver PDIs próprios e da equipe; "Novo PDI"; filtro Colaborador (só subordinados) |
| L03 | Colaborador acessa lista         | Usuário role `employee`   | Login → Menu PDI                             | Ver só PDIs em que é o colaborador; sem "Novo PDI"; filtro status inicia em "Ativo" |
| L04 | Filtro por status                | Lista com PDIs            | Selecionar status (ex.: Ativo)               | Lista mostra apenas PDIs com esse status |
| L05 | Filtro por colaborador           | RH ou gestor              | Buscar e selecionar colaborador              | Lista mostra apenas PDIs daquele colaborador |
| L06 | Paginação                       | Total > tamanho da página | Trocar página e "Por página" (10/25/50)      | Página e total atualizam corretamente  |
| L07 | Sem PDIs                         | Nenhum PDI para o usuário | Acessar /pdis                               | Mensagem "Nenhum PDI encontrado"       |
| L08 | Link para detalhe                | Lista com pelo menos 1 PDI| Clicar em "Ver" ou "Editar"                  | Navega para `/pdis/:pdiId`             |

---

### 5.2 Criação de PDI (modal "Novo PDI")

| ID  | Cenário                          | Pré-condição        | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------|---------------------------------------------|----------------------------------------|
| C01 | Criar PDI mínimo                 | RH ou gestor        | Colaborador, data ini/fim, origem → Criar   | PDI criado em Rascunho; redireciona para detalhe |
| C02 | Validação datas                  | Modal aberto        | Data inicial > data final → Criar           | Toast erro; PDI não criado             |
| C03 | Validação obrigatórios           | Modal aberto        | Deixar colaborador ou datas em branco → Criar | Toast "Preencha colaborador e período" |
| C04 | Origem Avaliação + vínculo       | Colaborador com avaliação submetida | Origem "Avaliação", selecionar avaliação, Criar | PDI com `evaluation_id`; seção Diagnóstico disponível |
| C05 | Origem DISC + vínculo            | Colaborador com DISC completo | Origem "DISC", selecionar assessment, Criar | PDI com `behavioral_assessment_id`; Diagnóstico DISC disponível |
| C06 | Gestor só vê subordinados        | Role manager        | Abrir modal e buscar colaborador            | Lista só perfis com `manager_id` = gestor |
| C07 | Cancelar criação                 | Modal aberto        | Preencher campos → Cancelar                  | Modal fecha; nenhum PDI criado         |

---

### 5.3 Detalhe do PDI e objetivos

| ID  | Cenário                          | Pré-condição              | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------------|---------------------------------------------|----------------------------------------|
| D01 | Cabeçalho e progresso            | PDI existente             | Abrir detalhe com objetivos/ações           | Nome do colaborador, período, status; barra de progresso correta |
| D02 | Adicionar objetivo               | PDI rascunho/em aprovação/ativo; canManage | Objetivos → Adicionar objetivo (descrição, prioridade, data) | Objetivo na lista; sem campo "Status" (progresso calculado pelos planos de ação) |
| D03 | Editar objetivo                  | Objetivo existente        | Editar descrição/prioridade/data            | Alterações salvas; status do objetivo não é editável |
| D04 | Excluir objetivo                 | Objetivo existente        | Excluir objetivo                            | Objetivo removido; ações do objetivo também |
| D05 | Adicionar ação (curso/prática)   | Objetivo existente        | Adicionar ação, tipo, responsável, data     | Ação listada no objetivo             |
| D06 | Alterar status da ação           | Ação tipo prática         | Gestor/RH ou responsável: mudar status ou progresso (+10%, Concluir) | Status/progresso salvos; barra do objetivo atualiza |
| D07 | Colaborador não edita objetivos  | Role employee; PDI próprio | Abrir detalhe                              | Sem botões de adicionar/editar/excluir objetivos; sem excluir ações |
| D08 | Colaborador atualiza prática     | Employee; PDI próprio; ação tipo prática em que é responsável | Usar +10%, Concluir ou dropdown de status | Progresso/status salvos; barra do objetivo atualiza |
| D09 | Progresso por objetivo           | Objetivo com ações        | Abrir objetivo                              | Barra "Progresso calculado a partir dos planos de ação" e % correta |
| D10 | Ação tipo curso                  | Ação vinculada a curso    | Ver linha da ação                           | Ícone Curso; progresso e status somente leitura; "Sincronizado com o curso" |
| D11 | Objetivo sem ações               | Objetivo sem planos       | Abrir objetivo                              | Mensagem "Adicione um plano de ação para começar"; progresso 0% |

---

### 5.4 Diagnóstico (objetivos a partir de avaliação/DISC)

| ID  | Cenário                          | Pré-condição                    | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------------------|---------------------------------------------|----------------------------------------|
| DG01| Diagnóstico por avaliação        | PDI com evaluation_id; canManage | Abrir PDI → seção Diagnóstico               | Competências com nota ≤ 3 listadas    |
| DG02| Criar objetivos por competência   | Competências de baixa nota      | Marcar competências → Criar objetivos       | Objetivos criados; seção Objetivos atualizada |
| DG03| Diagnóstico por DISC             | PDI com behavioral_assessment_id | Abrir PDI → seção Diagnóstico              | Pontos de atenção do perfil DISC      |
| DG04| Sem vínculo                      | PDI sem avaliação/DISC         | Abrir PDI                                   | Seção Diagnóstico não exibida         |

---

### 5.5 Envio para aprovação e aprovação

| ID  | Cenário                          | Pré-condição        | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------|---------------------------------------------|----------------------------------------|
| A01 | Enviar para aprovação            | PDI Rascunho; gestor/RH | Clicar "Enviar para aprovação"             | Status → Em aprovação; bloco some     |
| A02 | RH aprova                       | PDI Em aprovação; RH | Aprovar PDI                                 | Status → Ativo; toast sucesso         |
| A03 | RH devolve                      | PDI Em aprovação; RH | Devolver para ajustes                      | Status → Rascunho; gestor pode editar e reenviar |
| A04 | Gestor não aprova               | PDI Em aprovação; manager | Abrir detalhe                             | Seção de aprovação não aparece (só RH) |
| A05 | Colaborador não envia            | PDI Rascunho; employee | Abrir detalhe                             | Botão "Enviar para aprovação" não aparece |

---

### 5.6 Check-ins (PDI ativo)

| ID  | Cenário                          | Pré-condição              | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------------|---------------------------------------------|----------------------------------------|
| CH01| Gestor adiciona check-in         | PDI Ativo; gestor         | Check-ins → Adicionar (data, status, comentário) | Check-in na lista                     |
| CH02| Editar check-in                  | Check-in existente; canManage | Editar data/status/comentário gestor       | Alterações salvas                     |
| CH03| Colaborador comenta              | PDI Ativo; colaborador é o employee; último check-in sem comentário | Preencher comentário do colaborador e salvar | Comentário gravado; não pode comentar de novo no mesmo check-in |
| CH04| Check-in desabilitado se não ativo | PDI Rascunho/Em aprovação/Concluído | Abrir detalhe                         | Não é possível adicionar check-in (ou botão desabilitado) |
| CH05| Colaborador não adiciona check-in | PDI Ativo; employee       | Abrir detalhe                              | Sem botão de adicionar check-in       |

---

### 5.7 Encerramento e arquivamento

| ID  | Cenário                          | Pré-condição        | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------|---------------------------------------------|----------------------------------------|
| E01 | Encerrar PDI                     | PDI Ativo; gestor/RH | Encerrar PDI → Resultado + comentário → Encerrar | Status → Concluído; closed_at e result preenchidos |
| E02 | Resultado e comentário           | Modal encerrar      | Escolher Concluído/Parcial/Não concluído e comentário | Dados salvos no PDI                  |
| E03 | RH arquiva                      | PDI Concluído; RH   | Arquivar PDI                                 | Status → Arquivado                   |
| E04 | Gestor não arquiva              | PDI Concluído; manager | Abrir detalhe                             | Bloco "Arquivar PDI" não aparece      |
| E05 | Encerrar só quando ativo        | PDI Rascunho        | Abrir detalhe                               | Seção "Encerrar PDI" não aparece      |

---

### 5.8 Navegação e links

| ID  | Cenário                          | Passos                                      | Resultado esperado                    |
|-----|----------------------------------|---------------------------------------------|----------------------------------------|
| N01 | Voltar para lista                | Detalhe → seta/Voltar                       | Navega para `/pdis`                   |
| N02 | Link do colaborador              | Clicar no nome do colaborador no cabeçalho  | Navega para `/employees/:userId`      |
| N03 | Link do colaborador na lista     | Lista → nome do colaborador                 | Navega para perfil do colaborador     |

---

### 5.9 Regras de negócio e validações

| ID  | Cenário                          | Resultado esperado                    |
|-----|----------------------------------|----------------------------------------|
| V01 | Criar PDI com data fim no passado | Permitido (não há validação de "data no futuro" no código atual) |
| V02 | Objetivo sem ações               | Permitido; progresso do objetivo = 0%; status "Não iniciado"; mensagem para adicionar plano de ação |
| V03 | Ação tipo "curso" com assignment | Progresso e status sincronizados automaticamente com o curso (trigger); não editável pelo usuário |
| V04 | Ação tipo "prática"              | Progresso e status manuais; colaborador pode atualizar se for o responsável pela ação |
| V05 | Progresso do objetivo            | Sempre calculado (média do progresso dos planos de ação); status derivado (não editável) |
| V06 | Múltiplos check-ins mesma data   | Permitido (não há unicidade por data no código) |
| V07 | PDI arquivado                    | Continua visível na lista com filtro "Arquivado"; não entra em novo fluxo |

---

## 6. Resumo por perfil

- **Colaborador**: ver próprios PDIs, filtrar por status, abrir detalhe, comentar no último check-in (PDI ativo). Pode atualizar progresso e status das ações tipo **prática** em que é o responsável (+10%, Concluir, dropdown de status).
- **Gestor**: tudo do colaborador + criar PDI (equipe), editar objetivos/ações, enviar para aprovação, check-ins, encerrar; não aprovar nem arquivar.
- **RH**: visão de todos os PDIs, criar/editar qualquer PDI, aprovar/devolver, check-ins, encerrar e arquivar.

---

## 7. Referência de status (labels)

| Status (código) | Label exibida   |
|-----------------|-----------------|
| draft           | Rascunho        |
| in_approval     | Em aprovação    |
| active          | Ativo           |
| closed          | Concluído       |
| archived        | Arquivado       |
