-- AUDITORIA SOMENTE LEITURA — verificar compatibilidade do schema antes da migration 014.
-- Execute no Supabase SQL Editor. Este arquivo não altera dados nem estrutura.

-- 1) Colunas e tipos utilizados pela RPC de relatórios.
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'orders' AND column_name IN ('id', 'order_number', 'customer_name', 'status'))
    OR (table_name = 'order_items' AND column_name IN ('id', 'order_id', 'product_name', 'quantity', 'unit_price', 'subtotal', 'payment_status', 'created_at'))
    OR (table_name = 'payment_items' AND column_name IN ('id', 'payment_id', 'order_item_id', 'amount'))
    OR (table_name = 'profiles' AND column_name IN ('id', 'active', 'role'))
  )
ORDER BY table_name, ordinal_position;

-- 2) Constraints de situação e relacionamentos das tabelas envolvidas.
SELECT
  cls.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN ('orders', 'order_items', 'payment_items', 'profiles')
ORDER BY cls.relname, con.conname;

-- 3) Índices existentes para datas e vínculos financeiros.
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('order_items', 'payment_items', 'orders')
ORDER BY tablename, indexname;

-- 4) Assinaturas atuais das RPCs financeiras/administrativas relacionadas.
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_admin_order_history', 'get_order_payment_summary', 'get_order_payment_history', 'get_order_item_report')
ORDER BY p.proname;
