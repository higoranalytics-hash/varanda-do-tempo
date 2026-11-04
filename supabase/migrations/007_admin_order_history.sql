-- VARANDA DO TEMPO | MIGRATION 007 - CONSULTA ADMINISTRATIVA DE COMANDAS
-- RPC de leitura para o painel administrativo. Não altera dados operacionais.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_order_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
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

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'customer_name', o.customer_name,
        'status', o.status,
        'opened_at', o.opened_at,
        'closed_at', o.closed_at,
        'table_name', rt.name,
        'opened_by', o.opened_by,
        'opened_by_name', opener.full_name,
        'closed_by', o.closed_by,
        'closed_by_name', closer.full_name,
        'items', COALESCE(items.items_json, '[]'::jsonb),
        'total_amount', COALESCE(items.total_amount, 0),
        'paid_amount', COALESCE(payments.paid_amount, 0),
        'item_quantity', COALESCE(items.item_quantity, 0)
      )
      ORDER BY o.opened_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT *
    FROM public.orders
    ORDER BY opened_at DESC
    LIMIT 500
  ) o
  LEFT JOIN public.restaurant_tables rt ON rt.id = o.table_id
  LEFT JOIN public.profiles opener ON opener.id = o.opened_by
  LEFT JOIN public.profiles closer ON closer.id = o.closed_by
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', COALESCE(oi.subtotal, oi.quantity * oi.unit_price),
            'payment_status', oi.payment_status,
            'notes', oi.notes,
            'created_at', oi.created_at
          )
          ORDER BY oi.created_at
        ),
        '[]'::jsonb
      ) AS items_json,
      COALESCE(
        SUM(COALESCE(oi.subtotal, oi.quantity * oi.unit_price))
          FILTER (WHERE oi.payment_status <> 'cancelled'),
        0
      )::numeric(12,2) AS total_amount,
      COALESCE(
        SUM(oi.quantity) FILTER (WHERE oi.payment_status <> 'cancelled'),
        0
      )::integer AS item_quantity
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ) items ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount), 0)::numeric(12,2) AS paid_amount
    FROM public.payments p
    WHERE p.order_id = o.id
  ) payments ON TRUE;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_order_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_order_history() TO authenticated;

COMMIT;

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS parametros
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_admin_order_history';
