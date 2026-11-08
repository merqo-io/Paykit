# security

Security records for paykit.

## Contents

- `2026-10-24-data-inventory.md`: personal-data columns, who reads them, retention and a proposed drop list. Nothing is dropped until the owner approves it. Item 1 (`auth_failures.ip`) is done: migration 0031 nulls the IP after 30 days and keeps the row. Item 2 is partly done: migration 0032 deletes a payment screenshot from storage when its evidence row is deleted.
