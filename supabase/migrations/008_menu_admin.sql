-- VARANDA DO TEMPO | MIGRATION 008 - GESTÃO ADMINISTRATIVA DO CARDÁPIO
-- Habilita o painel para administrar categorias e produtos sem SQL manual.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description text;

-- Apenas administradores ativos podem criar, editar ou desativar categorias.
DROP POLICY IF EXISTS categories_admin_manage_menu ON public.categories;
CREATE POLICY categories_admin_manage_menu
ON public.categories
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = TRUE
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = TRUE
      AND p.role = 'admin'
  )
);

-- Apenas administradores ativos podem criar, editar ou desativar produtos.
DROP POLICY IF EXISTS products_admin_manage_menu ON public.products;
CREATE POLICY products_admin_manage_menu
ON public.products
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = TRUE
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.active = TRUE
      AND p.role = 'admin'
  )
);

-- Políticas restritivas para garantir que políticas permissivas antigas
-- não concedam escrita de categorias/produtos a atendentes.
DROP POLICY IF EXISTS categories_menu_write_guard ON public.categories;
CREATE POLICY categories_menu_write_guard
ON public.categories
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS categories_menu_update_guard ON public.categories;
CREATE POLICY categories_menu_update_guard
ON public.categories
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS categories_menu_delete_guard ON public.categories;
CREATE POLICY categories_menu_delete_guard
ON public.categories
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS products_menu_write_guard ON public.products;
CREATE POLICY products_menu_write_guard
ON public.products
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS products_menu_update_guard ON public.products;
CREATE POLICY products_menu_update_guard
ON public.products
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS products_menu_delete_guard ON public.products;
CREATE POLICY products_menu_delete_guard
ON public.products
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

COMMIT;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('categories', 'products')
  AND policyname IN ('categories_admin_manage_menu', 'products_admin_manage_menu')
ORDER BY tablename, policyname;
