-- VARANDA DO TEMPO | MIGRATION 010 - COMPATIBILIDADE DO MÉTODO DE PAGAMENTO
-- A interface envia 'outro'; a constraint existente em payments usa 'other'.
-- Mantém a validação da RPC e normaliza o valor somente na gravação.
BEGIN;

CREATE OR REPLACE FUNCTION public.receive_order_payment(
  p_order_id uuid,
  p_order_item_ids uuid[],
  p_payment_method text,
  p_payer_name text DEFAULT NULL,
  p_split_count integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_split_group uuid;
  v_item record;
  v_item_count integer := 0;
  v_unique_count integer := 0;
  v_total_cents bigint := 0;
  v_paid_cents bigint := 0;
  v_remaining_cents bigint := 0;
  v_base_cents bigint := 0;
  v_remainder bigint := 0;
  v_alloc bigint := 0;
  v_person integer;
  v_payment_ids uuid[];
  v_person_totals bigint[];
  v_payment_id uuid;
  v_total_paid numeric(12,2);
BEGIN
  IF v_user_id IS NULL OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo.';
  END IF;

  IF p_split_count IS NULL OR p_split_count < 1 OR p_split_count > 20 THEN
    RAISE EXCEPTION 'A divisão deve ser entre 1 e 20 pessoas.';
  END IF;

  IF p_order_item_ids IS NULL OR cardinality(p_order_item_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item para pagamento.';
  END IF;

  SELECT COUNT(DISTINCT x), COUNT(*)
    INTO v_unique_count, v_item_count
  FROM unnest(p_order_item_ids) AS x;

  IF v_unique_count <> v_item_count THEN
    RAISE EXCEPTION 'A seleção contém itens duplicados.';
  END IF;

  IF lower(coalesce(p_payment_method, '')) NOT IN
     ('pix', 'dinheiro', 'credito', 'debito', 'outro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  IF p_split_count = 1 AND length(btrim(coalesce(p_payer_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Informe o nome de quem está pagando.';
  END IF;

  -- Bloqueia a comanda para impedir dois recebimentos simultâneos.
  PERFORM 1
  FROM public.orders o
  WHERE o.id = p_order_id AND o.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada ou já encerrada.';
  END IF;

  -- Bloqueia e valida todos os itens antes de calcular qualquer pagamento.
  PERFORM 1
  FROM public.order_items oi
  WHERE oi.id = ANY(p_order_item_ids)
    AND oi.order_id = p_order_id
    AND oi.payment_status <> 'cancelled'
  FOR UPDATE;

  SELECT COUNT(*) INTO v_item_count
  FROM public.order_items oi
  WHERE oi.id = ANY(p_order_item_ids)
    AND oi.order_id = p_order_id
    AND oi.payment_status <> 'cancelled';

  IF v_item_count <> cardinality(p_order_item_ids) THEN
    RAISE EXCEPTION 'Um ou mais itens não pertencem à comanda ou estão cancelados.';
  END IF;

  v_person_totals := array_fill(0::bigint, ARRAY[p_split_count]);

  -- Primeira passagem: calcula saldo e total de cada pessoa em centavos.
  FOR v_item IN
    SELECT
      oi.id,
      GREATEST(
        round(COALESCE(oi.subtotal, oi.quantity * oi.unit_price) * 100)::bigint
        - round(COALESCE(SUM(pi.amount), 0) * 100)::bigint,
        0
      ) AS remaining_cents
    FROM public.order_items oi
    LEFT JOIN public.payment_items pi ON pi.order_item_id = oi.id
    WHERE oi.id = ANY(p_order_item_ids)
      AND oi.order_id = p_order_id
      AND oi.payment_status <> 'cancelled'
    GROUP BY oi.id, oi.subtotal, oi.quantity, oi.unit_price
    ORDER BY oi.id
  LOOP
    IF v_item.remaining_cents <= 0 THEN
      RAISE EXCEPTION 'Um dos itens selecionados não possui saldo pendente.';
    END IF;

    v_total_cents := v_total_cents + v_item.remaining_cents;
    v_base_cents := v_item.remaining_cents / p_split_count;
    v_remainder := v_item.remaining_cents % p_split_count;

    FOR v_person IN 1..p_split_count LOOP
      v_alloc := v_base_cents + CASE WHEN v_person <= v_remainder THEN 1 ELSE 0 END;
      v_person_totals[v_person] := v_person_totals[v_person] + v_alloc;
    END LOOP;
  END LOOP;

  IF v_total_cents <= 0 THEN
    RAISE EXCEPTION 'Não há saldo para receber nos itens selecionados.';
  END IF;

  IF p_split_count > 1 THEN
    v_split_group := gen_random_uuid();
  END IF;

  -- Cria um registro de pagamento por pagador.
  v_payment_ids := array_fill(NULL::uuid, ARRAY[p_split_count]);

  FOR v_person IN 1..p_split_count LOOP
    IF v_person_totals[v_person] > 0 THEN
      INSERT INTO public.payments (
        order_id, amount, payment_method, received_by,
        payer_name, split_group_id, split_count
      )
      VALUES (
        p_order_id,
        (v_person_totals[v_person]::numeric / 100)::numeric(12,2),
        CASE lower(p_payment_method)
          WHEN 'outro' THEN 'other'
          ELSE lower(p_payment_method)
        END,
        v_user_id,
        CASE
          WHEN p_split_count = 1 THEN btrim(p_payer_name)
          ELSE 'Pessoa ' || v_person::text
        END,
        v_split_group,
        p_split_count
      )
      RETURNING id INTO v_payment_id;

      v_payment_ids[v_person] := v_payment_id;
    END IF;
  END LOOP;

  -- Segunda passagem: vincula cada parcela do item ao pagamento de cada pessoa.
  FOR v_item IN
    SELECT
      oi.id,
      GREATEST(
        round(COALESCE(oi.subtotal, oi.quantity * oi.unit_price) * 100)::bigint
        - round(COALESCE(SUM(pi.amount), 0) * 100)::bigint,
        0
      ) AS remaining_cents
    FROM public.order_items oi
    LEFT JOIN public.payment_items pi ON pi.order_item_id = oi.id
    WHERE oi.id = ANY(p_order_item_ids)
      AND oi.order_id = p_order_id
      AND oi.payment_status <> 'cancelled'
    GROUP BY oi.id, oi.subtotal, oi.quantity, oi.unit_price
    ORDER BY oi.id
  LOOP
    v_base_cents := v_item.remaining_cents / p_split_count;
    v_remainder := v_item.remaining_cents % p_split_count;

    FOR v_person IN 1..p_split_count LOOP
      v_alloc := v_base_cents + CASE WHEN v_person <= v_remainder THEN 1 ELSE 0 END;
      IF v_alloc > 0 THEN
        INSERT INTO public.payment_items (payment_id, order_item_id, amount)
        VALUES (
          v_payment_ids[v_person],
          v_item.id,
          (v_alloc::numeric / 100)::numeric(12,2)
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Atualiza o status de cada item com base no valor efetivamente vinculado.
  UPDATE public.order_items oi
  SET payment_status = CASE
    WHEN COALESCE((
      SELECT SUM(pi.amount)
      FROM public.payment_items pi
      WHERE pi.order_item_id = oi.id
    ), 0) >= COALESCE(oi.subtotal, oi.quantity * oi.unit_price) THEN 'paid'
    WHEN COALESCE((
      SELECT SUM(pi.amount)
      FROM public.payment_items pi
      WHERE pi.order_item_id = oi.id
    ), 0) > 0 THEN 'partially_paid'
    ELSE 'pending'
  END
  WHERE oi.id = ANY(p_order_item_ids)
    AND oi.order_id = p_order_id;

  v_total_paid := (v_total_cents::numeric / 100)::numeric(12,2);

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'total_paid', v_total_paid,
    'split_count', p_split_count,
    'split_group_id', v_split_group,
    'payments_created', (
      SELECT COUNT(*) FROM public.payments p
      WHERE p.id = ANY(v_payment_ids)
    )
  );
END;
$$;


REVOKE ALL ON FUNCTION public.receive_order_payment(uuid, uuid[], text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_order_payment(uuid, uuid[], text, text, integer) TO authenticated;

COMMIT;
