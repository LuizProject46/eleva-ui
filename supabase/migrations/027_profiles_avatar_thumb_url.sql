-- Migration 027: Avatar thumb URL for low-res display (menus, lists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_thumb_url TEXT;
COMMENT ON COLUMN profiles.avatar_thumb_url IS 'Low-resolution avatar URL for menus and lists; standard avatar_url for profile/settings';
