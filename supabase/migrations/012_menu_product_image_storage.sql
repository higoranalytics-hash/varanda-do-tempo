-- VARANDA DO TEMPO | MIGRATION 012 - STORAGE DE FOTOS DO CARDÁPIO
-- Bucket público para leitura das fotos e escrita restrita a administradores ativos.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-product-images',
  'menu-product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS menu_product_images_public_read ON storage.objects;
CREATE POLICY menu_product_images_public_read
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-product-images');

DROP POLICY IF EXISTS menu_product_images_admin_insert ON storage.objects;
CREATE POLICY menu_product_images_admin_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS menu_product_images_admin_update ON storage.objects;
CREATE POLICY menu_product_images_admin_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'menu-product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'menu-product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS menu_product_images_admin_delete ON storage.objects;
CREATE POLICY menu_product_images_admin_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'menu-product-images'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.active = TRUE AND p.role = 'admin'
  )
);

COMMIT;
