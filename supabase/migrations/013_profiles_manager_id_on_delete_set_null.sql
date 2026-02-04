-- Allow deleting a profile when others reference it as manager: set manager_id to NULL.
-- Required so auth.admin.deleteUser can cascade-delete the profile row.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
