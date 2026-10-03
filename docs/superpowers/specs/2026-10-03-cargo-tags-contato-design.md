# Design: Cargo como campo próprio + picker de Tags no detalhe do Contato

## Contexto

Pedido do dono do projeto (telas anotadas + conversa, 2026-10-03), depois
do sub-projeto de busca+filtros salvos (já em produção, PR #13/#14):

1. O campo hoje chamado "Cargo institucional" no form de Contato é, na
   verdade, implementado como **tag** (`entity_tags`/`tags`, multivalorado,
   ex.: "Representante, Palestrante, Conselheiro") — mesmo mecanismo
   polimórfico usado para badges. Isso está semanticamente errado: Cargo
   e Tag são conceitos diferentes. Decisão confirmada: **Cargo vira um
   campo próprio do contato, de valor único, representando o título
   profissional da pessoa** (ex.: "Diretor de Investimentos", "Sócio") —
   não uma tag.
2. **Tags** (categorização livre e geral, ex.: football-fan, vip,
   influencer — referência visual do `atomic-crm`) passam a ser
   adicionadas **só a partir do detalhe do contato** (depois que ele já
   existe), nunca no cadastro rápido.
3. **Cadastro rápido de contato simplificado**: só 5 campos — Nome
   completo, Cargo, E-mail, Telefone, Empresa. Nada mais (sem Idiomas,
   LinkedIn, Notas ou Tags nessa tela).
4. **Idiomas e LinkedIn somem do sistema inteiro** (cadastro E edição) —
   decisão confirmada: inclusive as colunas `languages`/`linkedin_url` são
   **apagadas do banco** (ação irreversível, dado existente é perdido;
   usuário confirmou explicitamente ciente disso).
5. **Notas** some só do cadastro rápido — continua existindo ao editar o
   contato depois.
6. **Empresa no cadastro rápido** cria de verdade um vínculo em
   `organization_contacts` (mesma tabela/mecanismo já usado no detalhe do
   contato, nunca uma segunda forma de associar contato↔empresa) — com
   `start_date` = hoje. Como `organization_contacts.role` é obrigatório
   (`not null`) e o cadastro rápido não pergunta "cargo nesta empresa"
   separado, o valor do campo **Cargo** alimenta também esse `role`
   inicial do vínculo — podem divergir depois, editando o vínculo no
   detalhe (UI já existente, sem mudança).

Decisões já tomadas com o dono do projeto (brainstorming, 2026-10-03):
- Semântica do Cargo: título profissional da pessoa (não é "papel
  genérico com a ABVCAP" — opção descartada).
- Idiomas/LinkedIn: remover de todo lugar, inclusive `DROP COLUMN` (não é
  só esconder da UI).
- Notas: remove só do cadastro, mantém no editar.
- Empresa no cadastro: cria vínculo institucional de verdade
  (`organization_contacts`), reusando o mecanismo existente — não um
  campo leve paralelo.
- Cargo alimenta o `role` inicial do vínculo criado junto (evita um 6º
  campo no cadastro rápido).
- Empresa no cadastro é um `<Select>` das organizações já cadastradas
  (mesmo padrão já usado em `organization-links.tsx` para o vínculo no
  detalhe) — **não** um autocomplete com criação de organização nova
  inline. Criar organização nova continua sendo um fluxo separado
  (`/organizations`, já existe) — ver "Fora de escopo".

## Arquitetura

### Migration

Nova coluna `contacts.title` (texto, nullable — nullable porque contatos
já existentes não têm valor, e mesmo no cadastro novo o campo é
obrigatório só pela validação do form, não por constraint do banco, para
não travar edições futuras que queiram limpar o campo). `DROP COLUMN
languages`, `DROP COLUMN linkedin_url` — destrutivo, confirmado.

```sql
alter table crm_abvcap.contacts
  add column title text,
  drop column languages,
  drop column linkedin_url;
```

Nenhuma mudança em `tags`/`entity_tags`/`organization_contacts` — todos já
têm a forma certa para o que este design precisa.

### Cadastro rápido de Contato (form novo, substitui o atual)

Campos: Nome completo (obrigatório, já era), **Cargo** (texto, novo —
obrigatório nesta tela por validação do form, não do banco), E-mail
(obrigatório nesta tela — hoje `contacts.emails` é array multivalorado;
o cadastro rápido pede só **um** e-mail, que vira o primeiro item do
array), Telefone (mesma lógica, um valor vira o primeiro item de
`phones`), **Empresa** (`<Select>` das organizações existentes,
obrigatório).

Ao salvar: insere o `contact` (`full_name`, `title`, `emails: [email]`,
`phones: [phone]`) e, na mesma Server Action, insere o vínculo em
`organization_contacts` (`org_id` escolhido, `role` = mesmo valor de
`title`, `start_date` = hoje) — duas operações, uma ação só, mesma
transação lógica que o resto do CRUD do projeto já usa (sem rollback
automático entre as duas por enquanto, consistente com o padrão já
existente no projeto de não usar transações explícitas do Postgres nas
Server Actions — se a segunda falhar, o contato já foi criado; aceitável,
mesmo risco que já existe noutros fluxos de duas escritas sequenciais
deste projeto).

### Editar Contato (form existente, campos removidos)

Perde Idiomas e LinkedIn (coluna não existe mais). Perde o campo de Tags
(tags saem do form, vão para o detalhe). Ganha Cargo (texto, mesmo campo
do cadastro, agora editável). Mantém: Nome completo, E-mails (múltiplos,
sem mudança), Telefones (múltiplos, sem mudança), Notas. Não tem campo de
Empresa (vínculos institucionais já têm sua própria seção no detalhe, com
sua própria UI de adicionar/encerrar vínculo — não duplicado aqui).

### Detalhe do Contato

Header: nome + Cargo (texto simples, ex.: "Diretor de Investimentos",
abaixo do nome — como já é hoje com os badges, só que agora é o `title`
do contato, não mais uma lista de badges).

Nova seção **Tags** (abaixo do header ou junto da barra lateral, mesma
área onde os badges apareciam antes): lista as tags já atribuídas a este
contato como badges + botão "Adicionar tag" que abre um `Combobox`
(`src/components/ui/combobox.tsx`, já existe no projeto, não foi usado
ainda) listando todas as tags já cadastradas no sistema (`select * from
tags`, sem filtro por entidade — o catálogo é compartilhado), com um item
fixo "Criar tag: {texto digitado}" quando o texto não bate com nenhuma
tag existente. Selecionar uma tag existente ou criar uma nova adiciona
via `entity_tags` (mesmo `syncTags`-like insert já usado hoje, adaptado
para adicionar/remover um item de cada vez em vez de substituir a lista
inteira, já que agora é um picker interativo, não mais um textarea
salvo de uma vez). Clicar numa tag já atribuída remove o vínculo
(`entity_tags` delete).

## Fluxo de dados e testes

Server Actions (`src/app/[locale]/(app)/contacts/actions.ts`):
- `createContact` — schema reduzido (`full_name`, `title`, `email`,
  `phone`, `org_id`, todos obrigatórios por essa tela), duas escritas
  (`contacts` insert + `organization_contacts` insert).
- `updateContact` — schema sem `languages`/`linkedin_url`/`tags`, com
  `title` novo.
- `addTagToContact(contactId, tagName)` / `removeTagFromContact(entityTagId)`
  — novas, para o picker do detalhe (upsert em `tags` por nome +
  insert/delete em `entity_tags`, não mais o `syncTags` de
  substituir-tudo-de-uma-vez).

Testes:
- pgTAP: nenhum novo necessário (RLS de `contacts`/`tags`/`entity_tags`/
  `organization_contacts` já existe e não muda).
- E2E: estende `e2e/contacts.spec.ts` — cadastro rápido com os 5 campos
  cria contato + vínculo institucional visível no detalhe; editar contato
  não mostra mais Idiomas/LinkedIn/Tags; picker de Tags no detalhe
  adiciona/remove/cria tag nova; lista de Contatos mostra Cargo (texto)
  em vez de badges na coluna que antes era "Cargo".

## Fora de escopo

- Autocomplete de Empresa com criação de organização nova inline no
  cadastro de contato — usa `<Select>` das organizações já existentes,
  mesmo padrão já estabelecido no detalhe. Criar organização nova continua
  um fluxo separado.
- Área de gestão de Tags dedicada (ver/renomear/apagar tags
  independentemente de um contato, contagem de uso) — o picker resolve
  "selecionar existente ou criar nova" o suficiente por ora; uma tela
  própria de administração de tags fica para quando a necessidade
  aparecer.
- Picker de Tags em Organizações — só Contatos, por enquanto (schema já
  suporta `entity_type = 'organization'`, mas não foi pedido agora).
- Migrar os valores antigos de "Cargo institucional" (Representante/
  Palestrante/Conselheiro etc., hoje em `entity_tags`) para o novo campo
  `title` — são conceitos diferentes (categoria de relacionamento vs.
  título profissional), não haveria mapeamento correto automático. Esses
  valores continuam existindo como tags normais (aparecem no picker de
  Tags do detalhe); o campo `title` de contatos existentes começa vazio.
- Qualquer mudança em `organization_contacts.role` em si (continua
  obrigatório, continua editável independentemente via a UI de vínculos
  já existente no detalhe).
