-- Dodajemo standardne audit kolone u attempts tabelu
ALTER TABLE public.attempts 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Opcionalno: Trigger za automatsko ažuriranje updated_at (Solo dev pro-tip)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_attempts_modtime
    BEFORE UPDATE ON public.attempts
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();