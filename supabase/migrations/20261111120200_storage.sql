-- =====================================================================
-- Fase 4 · 3/4 · Almacenamiento de archivos (Supabase Storage)
--   media   → PÚBLICO para leer por dirección directa (las imágenes de la página).
--             Solo el admin sube o reemplaza. Nadie lista el contenido salvo el admin.
--             No se permite borrar desde el navegador (evita referencias rotas).
--   privado → PRIVADO: borradores, originales, respaldos y exportaciones. Solo el admin.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privado', 'privado', false, 52428800, null)
on conflict (id) do nothing;

-- media
create policy "media: solo admin lista"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select public.es_admin()));
create policy "media: solo admin sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.es_admin()));
create policy "media: solo admin reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.es_admin()))
  with check (bucket_id = 'media' and (select public.es_admin()));

-- privado
create policy "privado: solo admin lee"
  on storage.objects for select to authenticated
  using (bucket_id = 'privado' and (select public.es_admin()));
create policy "privado: solo admin sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'privado' and (select public.es_admin()));
create policy "privado: solo admin reemplaza"
  on storage.objects for update to authenticated
  using (bucket_id = 'privado' and (select public.es_admin()))
  with check (bucket_id = 'privado' and (select public.es_admin()));
create policy "privado: solo admin borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'privado' and (select public.es_admin()));
