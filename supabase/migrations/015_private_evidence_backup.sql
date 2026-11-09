-- Private encrypted evidence archive. The application authenticates account owners;
-- no anon/authenticated storage policies are granted. Service-role access only.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('yeohaengit-evidence-private','yeohaengit-evidence-private',false,25165824,array['application/json'])
on conflict (id) do update set public=false,file_size_limit=25165824,allowed_mime_types=array['application/json'];
