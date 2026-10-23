-- Optional per-user shared Node policy. Original slots remain the only ledger.
ALTER TABLE node_grants ADD COLUMN port_limits JSON NULL;
