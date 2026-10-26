-- Knowledge base. Supabase hosts the files and the vector rows.
-- n8n downloads each file, extracts the text, embeds it, and writes the chunks.
-- The app does not parse or embed documents.
-- Embeddings are OpenAI text-embedding-3-small: 1536 dimensions.

create extension if not exists vector with schema extensions;

insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge-documents', 'knowledge-documents', false, 4194304)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt', 'csv')),
  category text not null check (category in (
    'clinic_policies',
    'services',
    'insurance',
    'pricing',
    'faqs',
    'emergency_procedures',
    'patient_instructions'
  )),
  status text not null default 'processing' check (status in ('processing', 'indexed', 'failed')),
  chunk_count integer not null default 0,
  file_size_bytes integer not null default 0,
  uploaded_by uuid references public.profiles (id) on delete set null,
  storage_path text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger trg_documents_default_org
  before insert on public.documents
  for each row execute function public.default_organization_id();

create index documents_org_created_idx on public.documents (organization_id, created_at desc);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create trigger trg_document_chunks_updated_at
  before update on public.document_chunks
  for each row execute function public.set_updated_at();

create trigger trg_document_chunks_default_org
  before insert on public.document_chunks
  for each row execute function public.default_organization_id();

create index document_chunks_document_idx on public.document_chunks (document_id, chunk_index);

create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy documents_select_own_org on public.documents
  for select using (organization_id = public.current_organization_id());

create policy documents_insert_own_org on public.documents
  for insert with check (organization_id = public.current_organization_id());

create policy documents_update_own_org on public.documents
  for update using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy documents_delete_own_org on public.documents
  for delete using (organization_id = public.current_organization_id());

create policy document_chunks_select_own_org on public.document_chunks
  for select using (organization_id = public.current_organization_id());

create policy document_chunks_insert_own_org on public.document_chunks
  for insert with check (organization_id = public.current_organization_id());

create policy document_chunks_update_own_org on public.document_chunks
  for update using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy document_chunks_delete_own_org on public.document_chunks
  for delete using (organization_id = public.current_organization_id());

drop policy if exists knowledge_documents_select on storage.objects;
drop policy if exists knowledge_documents_insert on storage.objects;
drop policy if exists knowledge_documents_delete on storage.objects;

create policy knowledge_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy knowledge_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy knowledge_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

-- n8n calls this with the service role, which has no current_organization_id().
-- filter_organization_id is required. A signed-in user can only search their own clinic.
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  filter_organization_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  file_name text,
  category text,
  content text,
  chunk_index integer,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.file_name,
    d.category,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.organization_id = filter_organization_id
    and (
      coalesce(auth.role(), '') = 'service_role'
      or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or coalesce(
        case
          when coalesce(current_setting('request.jwt.claims', true), '') ~ '^[[:space:]]*[{]'
            then current_setting('request.jwt.claims', true)::jsonb->>'role'
          else ''
        end,
        ''
      ) = 'service_role'
      or filter_organization_id = public.current_organization_id()
    )
    and d.status = 'indexed'
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 20);
$$;

grant execute on function public.match_document_chunks(extensions.vector, integer, uuid) to authenticated, service_role;
