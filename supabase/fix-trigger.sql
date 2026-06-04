-- Fix: trigger handle_new_user dengan search_path dan casting yang lebih robust

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role := 'investor';
  v_raw_role text;
begin
  -- Ambil role dari metadata jika ada
  v_raw_role := new.raw_user_meta_data->>'role';
  if v_raw_role in ('admin', 'investor') then
    v_role := v_raw_role::user_role;
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'User'),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
