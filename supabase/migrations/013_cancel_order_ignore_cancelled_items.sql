-- VARANDA DO TEMPO | MIGRATION 013
-- Permite cancelar comandas abertas que contenham apenas itens já cancelados.
-- Mantém o bloqueio quando houver itens ativos ou pagamentos registrados.
BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_empty_customer_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_number bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  SELECT o.order_number
    INTO v_order_number
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada ou não está aberta.';
  END IF;

  -- Itens cancelados permanecem no histórico, mas não representam consumo ativo.
  IF EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.payment_status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Esta comanda possui consumo. O cancelamento só é permitido quando está vazia.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments pay
    WHERE pay.order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar uma comanda que possui pagamentos.';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      closed_at = now(),
      closed_by = auth.uid()
  WHERE id = p_order_id
    AND status = 'open';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_empty_customer_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_empty_customer_order(uuid) TO authenticated;

COMMIT;
