-- VARANDA DO TEMPO - MIGRATION V4
-- Abertura segura de comandas e inclusão de itens.
-- Execute no SQL Editor do Supabase antes de testar o atendimento.

-- Normalização consistente com o JavaScript:
-- remove espaços duplicados e ignora maiúsculas/minúsculas.
alter table public.orders
  alter column customer_name_key drop expression;

alter table public.orders
  alter column customer_name_key
  type text
  using lower(regexp_replace(btrim(customer_name), '\s+', ' ', 'g'));

alter table public.orders
  alter column customer_name_key
  set default '';

create or replace function public.sync_customer_name_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.customer_name := regexp_replace(btrim(new.customer_name), '\s+', ' ', 'g');
  new.customer_name_key := lower(new.customer_name);
  return new;
end;
$$;

drop trigger if exists orders_customer_name_key_sync on public.orders;
create trigger orders_customer_name_key_sync
before insert or update of customer_name on public.orders
for each row execute function public.sync_customer_name_key();

-- A função retorna o identificador e o número da comanda.
create or replace function public.open_customer_order(
  p_customer_name text,
  p_table_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_name text;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Usuário não autenticado ou inativo.';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  if length(v_name) < 2 then
    raise exception 'Informe o nome do cliente.';
  end if;

  if p_table_id is not null and not exists (
    select 1 from public.restaurant_tables t
    where t.id = p_table_id and t.active = true
  ) then
    raise exception 'Mesa inválida ou inativa.';
  end if;

  insert into public.orders (
    customer_name, customer_ref, customer_name_key,
    table_id, status, opened_by, party_size
  )
  values (
    v_name, lower(v_name), lower(v_name),
    p_table_id, 'open', auth.uid(), 1
  )
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'opened_at', v_order.opened_at
  );
end;
$$;

-- Cria itens com preço obtido diretamente do cadastro de produtos.
create or replace function public.append_items_to_order(
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_count integer := 0;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Usuário não autenticado ou inativo.';
  end if;

  perform 1
  from public.orders o
  where o.id = p_order_id and o.status = 'open'
  for update;

  if not found then
    raise exception 'Comanda não encontrada ou já encerrada.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido precisa conter pelo menos um produto.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception 'Quantidade inválida.';
    end if;

    select * into v_product
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid
      and p.active = true
      and p.available = true;

    if not found then
      raise exception 'Um dos produtos não existe ou está indisponível.';
    end if;

    insert into public.order_items (
      order_id, product_id, product_name,
      quantity, unit_price, payment_status,
      notes, added_by
    )
    values (
      p_order_id, v_product.id, v_product.name,
      v_quantity, v_product.price, 'pending',
      nullif(v_item ->> 'notes', ''), auth.uid()
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'items_added', v_count);
end;
$$;

grant execute on function public.open_customer_order(text, uuid) to authenticated;
grant execute on function public.append_items_to_order(uuid, jsonb) to authenticated;
