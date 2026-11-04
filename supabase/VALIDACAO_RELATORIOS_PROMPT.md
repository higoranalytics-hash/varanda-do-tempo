# Prompt para validar a migration do Relatório no Supabase AI

Cole este prompt no assistente de IA do Supabase e anexe/cole o conteúdo de `supabase/migrations/014_order_item_reports.sql`.

---

Atue como um engenheiro sênior de PostgreSQL/Supabase. Quero validar uma nova RPC administrativa para relatórios do sistema Varanda do Tempo. **Nesta etapa, não execute alterações no banco. Faça somente uma auditoria de compatibilidade e segurança.**

A aplicação possui estas estruturas, conforme as migrations atualmente versionadas no projeto:

- `orders`: `id`, `order_number`, `customer_name`, `status`, `opened_at`.
- `order_items`: `id`, `order_id`, `product_name`, `quantity`, `unit_price`, `subtotal`, `payment_status`, `created_at`.
- `payments`: pagamentos vinculados à comanda por `order_id`.
- `payment_items`: vínculo entre pagamento e item por `payment_id`, `order_item_id`, com o valor efetivamente atribuído ao item em `amount`.
- `profiles`: `id`, `active`, `role`, usado para restringir RPCs administrativas a usuários ativos com `role = 'admin'`.

A RPC nova `get_order_item_report(p_date_from date, p_date_to date, p_status text, p_page integer, p_page_size integer)` deve:

1. Retornar lançamentos de produtos no intervalo de datas, filtrando `order_items.created_at` pelo fuso `America/Sao_Paulo`.
2. Retornar cliente, número da comanda, produto, quantidade, preço unitário, subtotal, valor pago vinculado ao item, saldo restante, status do item e data/hora.
3. Calcular o valor pago por item a partir da soma de `payment_items.amount`, não da soma bruta de `payments.amount`.
4. Excluir itens `cancelled` dos indicadores financeiros, mas permitir exibi-los na tabela quando o filtro de status for `cancelled` ou `all`.
5. Permitir os status `all`, `paid`, `pending`, `partially_paid` e `cancelled`.
6. Retornar resumo global do filtro e linhas paginadas, restringindo a página a no máximo 200 linhas.
7. Ser `SECURITY DEFINER`, fixar `search_path` e validar `auth.uid()`, `profiles.active = true` e `profiles.role = 'admin'`.
8. Revogar execução de `PUBLIC` e `anon` e conceder somente a `authenticated`.

Verifique no banco atual, sem exibir dados de clientes:

- Se as tabelas/colunas acima existem e se os tipos são compatíveis.
- Se `order_items.created_at` é `timestamp with time zone` ou `timestamp without time zone`; se for sem fuso, explique como ajustar a comparação de datas locais.
- Se `order_items.payment_status` permite os cinco valores e qual é o default/constraint real.
- Se `payment_items.order_item_id` e `payment_items.amount` existem e se a soma por item representa o total recebido.
- Se existe índice equivalente em `order_items.created_at` ou se o índice proposto é útil.
- Se a assinatura e o retorno JSON são compatíveis com `supabase.rpc` no JavaScript.
- Se há risco de segurança na função ou necessidade de grants adicionais para `authenticated`.
- Se a conta administrativa está corretamente validada por `profiles`.

Responda com uma tabela de compatibilidade (OK / Divergência / Não confirmado), detalhe qualquer divergência e proponha a menor correção possível. Não faça `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP` ou execução de migration nesta auditoria. Não retorne nomes, telefones, valores reais ou qualquer dado pessoal de clientes.
