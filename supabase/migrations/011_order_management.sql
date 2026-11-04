-- VARANDA DO TEMPO | MIGRATION 011 - GESTAO DE COMANDAS
-- Renomear cliente, remover item pendente e transferir item pendente.
-- Todas as operacoes sao transacionais e restritas a administradores ativos.
BEGIN;

CREATE TABLE IF NOT EXISTS public.order_management_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid,
  source_order_id uuid NOT NULL,
  target_order_id uuid,
  action text NOT NULL CHECK (action IN ('rename_customer','remove_item','transfer_item')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_management_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_management_events_admin_read ON public.order_management_events;
CREATE POLICY order_management_events_admin_read ON public.order_management_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION public.admin_rename_customer_order(p_order_id uuid, p_customer_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders%rowtype; v_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true AND p.role='admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores ativos.';
  END IF;
  v_name := regexp_replace(btrim(coalesce(p_customer_name,'')), '\s+', ' ', 'g');
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Informe um nome com pelo menos 2 caracteres.'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'open' THEN RAISE EXCEPTION 'Comanda não encontrada ou não está aberta.'; END IF;
  UPDATE public.orders SET customer_name=v_name WHERE id=p_order_id;
  INSERT INTO public.order_management_events(source_order_id, action, details, performed_by)
  VALUES (p_order_id,'rename_customer',jsonb_build_object('old_name',v_order.customer_name,'new_name',v_name),auth.uid());
  RETURN jsonb_build_object('success',true,'customer_name',v_name);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_remove_pending_order_item(p_order_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.order_items%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true AND p.role='admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores ativos.';
  END IF;
  SELECT oi.* INTO v_item FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
   WHERE oi.id=p_order_item_id AND o.status='open' FOR UPDATE OF oi, o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado ou comanda não está aberta.'; END IF;
  IF v_item.payment_status <> 'pending' THEN RAISE EXCEPTION 'Somente itens totalmente pendentes podem ser removidos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_items pi WHERE pi.order_item_id=v_item.id) THEN
    RAISE EXCEPTION 'Este item possui pagamento associado e não pode ser removido.';
  END IF;
  UPDATE public.order_items SET payment_status='cancelled' WHERE id=v_item.id;
  INSERT INTO public.order_management_events(order_item_id,source_order_id,action,details,performed_by)
  VALUES(v_item.id,v_item.order_id,'remove_item',jsonb_build_object('product_name',v_item.product_name,'quantity',v_item.quantity,'subtotal',v_item.subtotal),auth.uid());
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transfer_pending_order_item(p_order_item_id uuid, p_target_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item public.order_items%rowtype; v_source uuid; v_target public.orders%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active=true AND p.role='admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores ativos.';
  END IF;
  SELECT oi.* INTO v_item FROM public.order_items oi WHERE oi.id=p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  v_source := v_item.order_id;
  IF v_source = p_target_order_id THEN RAISE EXCEPTION 'A comanda de destino deve ser diferente da origem.'; END IF;
  PERFORM 1 FROM public.orders WHERE id IN (v_source,p_target_order_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=v_source AND status='open') THEN RAISE EXCEPTION 'A comanda de origem não está aberta.'; END IF;
  SELECT * INTO v_target FROM public.orders WHERE id=p_target_order_id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'A comanda de destino não existe ou não está aberta.'; END IF;
  IF v_item.payment_status <> 'pending' THEN RAISE EXCEPTION 'Somente itens totalmente pendentes podem ser transferidos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_items pi WHERE pi.order_item_id=v_item.id) THEN
    RAISE EXCEPTION 'Este item possui pagamento associado e não pode ser transferido.';
  END IF;
  UPDATE public.order_items SET order_id=p_target_order_id WHERE id=v_item.id;
  INSERT INTO public.order_management_events(order_item_id,source_order_id,target_order_id,action,details,performed_by)
  VALUES(v_item.id,v_source,p_target_order_id,'transfer_item',jsonb_build_object('product_name',v_item.product_name,'quantity',v_item.quantity,'subtotal',v_item.subtotal),auth.uid());
  RETURN jsonb_build_object('success',true,'source_order_id',v_source,'target_order_id',p_target_order_id);
END; $$;

REVOKE ALL ON FUNCTION public.admin_rename_customer_order(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_pending_order_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_transfer_pending_order_item(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rename_customer_order(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_pending_order_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transfer_pending_order_item(uuid,uuid) TO authenticated;
COMMIT;
