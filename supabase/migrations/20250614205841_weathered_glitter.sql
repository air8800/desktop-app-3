-- Add additional fields to printer_configs table
ALTER TABLE printer_configs 
ADD COLUMN IF NOT EXISTS paper_dimensions JSONB DEFAULT '{"width": 0, "height": 0, "unit": "mm"}'::jsonb,
ADD COLUMN IF NOT EXISTS printer_commands JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS override_defaults BOOLEAN DEFAULT true;

-- Create function to get paper size dimensions
CREATE OR REPLACE FUNCTION get_paper_size_dimensions(size_name TEXT)
RETURNS JSONB AS $$
BEGIN
  CASE size_name
    WHEN 'A3' THEN
      RETURN '{"width": 297, "height": 420, "unit": "mm"}'::jsonb;
    WHEN 'A4' THEN
      RETURN '{"width": 210, "height": 297, "unit": "mm"}'::jsonb;
    WHEN 'A5' THEN
      RETURN '{"width": 148, "height": 210, "unit": "mm"}'::jsonb;
    WHEN 'Letter' THEN
      RETURN '{"width": 8.5, "height": 11, "unit": "in"}'::jsonb;
    WHEN 'Legal' THEN
      RETURN '{"width": 8.5, "height": 14, "unit": "in"}'::jsonb;
    WHEN 'Executive' THEN
      RETURN '{"width": 7.25, "height": 10.5, "unit": "in"}'::jsonb;
    ELSE
      RETURN '{"width": 0, "height": 0, "unit": "mm"}'::jsonb;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update existing printer configs with paper dimensions
UPDATE printer_configs
SET paper_dimensions = get_paper_size_dimensions(paper_size)
WHERE paper_dimensions->>'width' = '0' OR paper_dimensions IS NULL;

-- Create a function to get printer-specific commands for paper sizes
CREATE OR REPLACE FUNCTION get_printer_commands(printer_name TEXT, paper_size TEXT)
RETURNS JSONB AS $$
BEGIN
  -- This is a placeholder. In a real implementation, you would have a table of
  -- printer models and their specific commands for different paper sizes
  RETURN jsonb_build_object(
    'windows_command', format('SET PRINTER="%s" PAPER="%s"', printer_name, paper_size),
    'powershell_command', format('Set-PrintConfiguration -PrinterName "%s" -PaperSize %s', printer_name, paper_size)
  );
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate print scripts for different operating systems
CREATE OR REPLACE FUNCTION generate_print_script(
  printer_name TEXT, 
  paper_size TEXT, 
  os_type TEXT DEFAULT 'windows'
)
RETURNS TEXT AS $$
DECLARE
  script TEXT;
  dimensions JSONB;
BEGIN
  dimensions := get_paper_size_dimensions(paper_size);
  
  IF os_type = 'windows' THEN
    script := format(
      '@echo off
echo Setting printer %s to paper size %s
powershell.exe -Command "$printer = Get-Printer -Name ''%s''; Set-PrintConfiguration -PrinterName ''%s'' -PaperSize %s"
IF %%ERRORLEVEL%% EQU 0 (
  echo Paper size set successfully
) ELSE (
  echo Failed to set paper size
)
',
      printer_name, paper_size, printer_name, printer_name, paper_size
    );
  ELSIF os_type = 'macos' THEN
    script := format(
      '#!/bin/bash
echo "Setting printer %s to paper size %s"
lpoptions -p "%s" -o media=%s
if [ $? -eq 0 ]; then
  echo "Paper size set successfully"
else
  echo "Failed to set paper size"
fi
',
      printer_name, paper_size, printer_name, 
      CASE paper_size
        WHEN 'A4' THEN 'iso_a4_210x297mm'
        WHEN 'A3' THEN 'iso_a3_297x420mm'
        WHEN 'Letter' THEN 'na_letter_8.5x11in'
        ELSE 'iso_a4_210x297mm'
      END
    );
  ELSE
    script := 'echo "Unsupported OS type"';
  END IF;
  
  RETURN script;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy access to printer configs with commands
-- Fixed: Avoid specifying printer_commands column twice
CREATE OR REPLACE VIEW printer_configs_with_commands AS
SELECT 
  pc.id,
  pc.shop_id,
  pc.paper_size,
  pc.printers,
  pc.is_available,
  pc.created_at,
  pc.updated_at,
  pc.paper_dimensions,
  pc.override_defaults,
  get_paper_size_dimensions(pc.paper_size) AS dimensions,
  jsonb_agg(
    jsonb_build_object(
      'printer_name', printer_name,
      'commands', get_printer_commands(printer_name, pc.paper_size)
    )
  ) AS printer_specific_commands
FROM 
  printer_configs pc,
  jsonb_array_elements_text(pc.printers) AS printer_name
GROUP BY 
  pc.id, pc.shop_id, pc.paper_size, pc.printers, pc.is_available, 
  pc.created_at, pc.updated_at, pc.paper_dimensions, pc.override_defaults;

-- Add a comment explaining the purpose of the new fields
COMMENT ON COLUMN printer_configs.paper_dimensions IS 'Dimensions of the paper size (width, height, unit)';
COMMENT ON COLUMN printer_configs.printer_commands IS 'Printer-specific commands for setting paper size';
COMMENT ON COLUMN printer_configs.override_defaults IS 'Flag to indicate whether to override printer defaults';