-- Notifications: allow users to read/update only their own rows; no INSERT for authenticated.
-- Notification creation is done via Edge Function (service_role).

DROP POLICY "Users see own notifications" ON notifications;

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
