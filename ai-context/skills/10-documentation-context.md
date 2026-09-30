# Skill: documentacao-e-contexto-de-ia

## Objetivo
Manter `ai-context/`, os ADRs, o glossário e as especificações plenamente sincronizados após cada entrega. É o único mecanismo que permite a agentes de código distintos operarem sem degradação de contexto entre sessões.

## Pré-condições
- Fluxo contínuo e obrigatório — roda ao final de toda fase ou entrega relevante, não é opcional.

## Passos
1. Ao concluir uma fase: atualizar `docs/roadmap.md` com o status real (não aspiracional).
2. Revisar `ai-context/AGENTS.md` e o(s) playbook(s) de skill aplicável(is), incorporando aprendizados e impedindo regressões.
3. Enriquecer `ai-context/domain-glossary.md` com novos termos de domínio mapeados.
4. Registrar ADR para toda decisão estrutural nova (nunca editar um ADR existente — criar um novo que aponte e substitua).
5. Garantir que toda especificação em `docs/specs/` reflita o que foi de fato implementado.
6. Atualizar `docs/onboarding.md` se a sequência de leitura recomendada mudar.

## Padrões obrigatórios
- ADRs são imutáveis após homologados.
- `docs/roadmap.md` é a fonte da verdade do progresso real — divergência entre roadmap e branches de produção é um defeito a corrigir imediatamente.
- Nenhuma fase é considerada encerrada sem esta atualização documental.

## Checklist de aceite
- [ ] `docs/roadmap.md` atualizado com status real da fase.
- [ ] `ai-context/AGENTS.md` e playbooks revisados.
- [ ] Glossário enriquecido, se aplicável.
- [ ] Novo(s) ADR(s) criado(s) para toda decisão estrutural tomada na fase.
- [ ] Especificações em `docs/specs/` sincronizadas com o implementado.
