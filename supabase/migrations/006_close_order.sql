-- VARANDA DO TEMPO | MIGRATION 006 - FECHAMENTO SEGURO DE COMANDA
-- Fecha a comanda somente quando todos os itens não cancelados estiverem quitados.
-- Não apaga registros e mantém o histórico de consumo e pagamentos.

BEGIN;

CREATE OR REPLACE FUNCTION public.close_customer_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item_count integer := 0;
  v_balance numeric(12,2) := 0;
  v_order_number bigint;
  v_closed_at timestamptz;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  -- Bloqueia a comanda para impedir fechamento concorrente com recebimentos.
  SELECT o.order_number
    INTO v_order_number
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada ou já encerrada.';
  END IF;

  -- Bloqueia os itens durante a validação do saldo.
  PERFORM 1
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id
  FOR UPDATE;

  SELECT
    COUNT(*) FILTER (WHERE oi.payment_status <> 'cancelled'),
    COALESCE(SUM(
      GREATEST(
        COALESCE(oi.subtotal, oi.quantity * oi.unit_price)
        - COALESCE(paid.total_paid, 0),
        0
      )
    ) FILTER (WHERE oi.payment_status <> 'cancelled'), 0)
  INTO v_item_count, v_balance
  FROM public.order_items oi
  LEFT JOIN LATERAL (
    SELECT SUM(pi.amount) AS total_paid
    FROM public.payment_items pi
    WHERE pi.order_item_id = oi.id
  ) paid ON TRUE
  WHERE oi.order_id = p_order_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Não é possível fechar uma comanda sem itens registrados.';
  END IF;

  IF v_balance > 0 THEN
    RAISE EXCEPTION 'Não é possível fechar: ainda existe saldo pendente de R$ %.',
      to_char(v_balance, 'FM999999990D00');
  END IF;

  -- Corrige status de itens com base nos valores efetivamente pagos.
  UPDATE public.order_items oi
  SET payment_status = 'paid'
  WHERE oi.order_id = p_order_id
    AND oi.payment_status <> 'cancelled';

  UPDATE public.orders
  SET status = 'closed',
      closed_at = now(),
      closed_by = v_user_id
  WHERE id = p_order_id
    AND status = 'open'
  RETURNING closed_at INTO v_closed_at;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'status', 'closed',
    'closed_at', v_closed_at,
    'closed_by', v_user_id,
    'item_count', v_item_count,
    'balance', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_customer_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_customer_order(uuid) TO authenticated;

COMMIT;

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS parametros
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'close_customer_order';
