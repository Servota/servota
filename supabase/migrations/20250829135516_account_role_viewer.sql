-- Add a read-only account role (separate migration so we don't use it in same TX)
do $$
begin
  alter type account_role add value if not exists 'viewer';
exception
  when duplicate_object then null;
end$$;
