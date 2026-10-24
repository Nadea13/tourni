-- Migrate document_deadline from settings JSON to tournaments.document_deadline column
UPDATE tournaments 
SET document_deadline = CASE 
        WHEN settings->>'document_deadline' ~ '^\d{4}-\d{2}-\d{2}' THEN (settings->>'document_deadline')::date 
        ELSE document_deadline 
    END,
    settings = settings - 'document_deadline'
WHERE settings ? 'document_deadline';
