-- VARANDA DO TEMPO | MIGRATION 014 - RELATÓRIO DE CONSUMO E PAGAMENTOS
-- Consulta administrativa paginada por data de lançamento dos itens e situação financeira.
-- Não altera registros, regras de pagamento, tabelas operacionais ou RPCs existentes.
-- A comparação de datas assume order_items.created_at como timestamptz; confira antes com VALIDAR_SCHEMA_RELATORIOS.sql.

BEGIN;

CREATE INDEX IF NOT EXISTS order_items_created_at_report_idx
  ON public.order_items (created_at DESC);

CREATE OR REPLACE FUNCTION public.get_order_item_report(
  p_date_from date,
  p_date_to date,
  p_status text DEFAULT 'all',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = TRUE
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores ativos.';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL THEN
    RAISE EXCEPTION 'Informe as datas inicial e final do relatório.';
  END IF;

  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'A data final não pode ser anterior à data inicial.';
  END IF;

  IF COALESCE(p_status, 'all') NOT IN ('all', 'paid', 'pending', 'partially_paid', 'cancelled') THEN
    RAISE EXCEPTION 'Situação inválida para o relatório.';
  END IF;

  IF p_page IS NULL OR p_page < 1 THEN
    RAISE EXCEPTION 'Página inválida.';
  END IF;

  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 200 THEN
    RAISE EXCEPTION 'O tamanho da página deve estar entre 1 e 200.';
  END IF;

  RETURN (
    WITH report_base AS MATERIALIZED (
      SELECT
        oi.id AS order_item_id,
        oi.created_at,
        o.id AS order_id,
        o.order_number,
        o.customer_name,
        o.status AS order_status,
        oi.product_name,
        oi.quantity,
        oi.unit_price,
        COALESCE(oi.subtotal, oi.quantity * oi.unit_price)::numeric(12,2) AS subtotal,
        COALESCE(item_payments.paid_amount, 0)::numeric(12,2) AS paid_amount,
        GREATEST(
          COALESCE(oi.subtotal, oi.quantity * oi.unit_price) - COALESCE(item_payments.paid_amount, 0),
          0
        )::numeric(12,2) AS remaining_amount,
        CASE
          WHEN oi.payment_status = 'cancelled' THEN 'cancelled'
          WHEN COALESCE(item_payments.paid_amount, 0) > 0
            AND COALESCE(item_payments.paid_amount, 0) >= COALESCE(oi.subtotal, oi.quantity * oi.unit_price) THEN 'paid'
          WHEN COALESCE(item_payments.paid_amount, 0) > 0 THEN 'partially_paid'
          WHEN oi.payment_status = 'paid' THEN 'paid'
          ELSE 'pending'
        END AS payment_status
      FROM public.order_items oi
      INNER JOIN public.orders o ON o.id = oi.order_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pi.amount), 0)::numeric(12,2) AS paid_amount
        FROM public.payment_items pi
        WHERE pi.order_item_id = oi.id
      ) item_payments ON TRUE
      WHERE oi.created_at >= (p_date_from::timestamp AT TIME ZONE 'America/Sao_Paulo')
        AND oi.created_at < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    ),
    filtered_rows AS MATERIALIZED (
      SELECT *
      FROM report_base
      WHERE COALESCE(p_status, 'all') = 'all'
         OR payment_status = p_status
    ),
    report_summary AS (
      SELECT
        COALESCE(SUM(paid_amount) FILTER (WHERE payment_status <> 'cancelled'), 0)::numeric(12,2) AS total_paid,
        COALESCE(SUM(remaining_amount) FILTER (WHERE payment_status <> 'cancelled'), 0)::numeric(12,2) AS total_pending,
        COUNT(*) FILTER (WHERE payment_status <> 'cancelled' AND paid_amount > 0)::integer AS paid_item_count,
        COUNT(*) FILTER (WHERE payment_status <> 'cancelled' AND remaining_amount > 0)::integer AS pending_item_count
      FROM filtered_rows
    ),
    page_rows AS (
      SELECT *
      FROM filtered_rows
      ORDER BY created_at DESC, order_number DESC, order_item_id DESC
      LIMIT p_page_size
      OFFSET ((p_page - 1)::bigint * p_page_size)
    )
    SELECT jsonb_build_object(
      'summary', (SELECT to_jsonb(report_summary) FROM report_summary),
      'rows', COALESCE(
        (SELECT jsonb_agg(to_jsonb(page_rows) ORDER BY created_at DESC, order_number DESC, order_item_id DESC) FROM page_rows),
        '[]'::jsonb
      ),
      'total_rows', (SELECT COUNT(*)::integer FROM filtered_rows),
      'page', p_page,
      'page_size', p_page_size
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_order_item_report(date, date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_item_report(date, date, text, integer, integer) TO authenticated;

COMMIT;

-- Confirmação da assinatura criada.
SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS parametros
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_order_item_report';
