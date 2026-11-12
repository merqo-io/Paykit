# UI primitives

Local shadcn primitives with no shared equivalent: radio-group (payment setup). Keep generated implementations close to upstream. Badge, button, skeleton, checkbox, dialog, input, label, textarea, tooltip and `cn` come from `@merqo/ui/primitives`; import them from there rather than adding a local copy. Account menus and support drawers are supplied by @merqo/ui. Remove unused complete primitives instead of maintaining dormant copies.
