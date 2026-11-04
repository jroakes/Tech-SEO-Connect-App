-- The check-in desk is gone: guests are checked in on Luma, and the app only
-- adds walk-ups. Its check-ins are still in the events table.
DROP TABLE check_ins;
DROP TABLE walk_ins;
DROP TABLE guest_list;
DROP TABLE settings;
