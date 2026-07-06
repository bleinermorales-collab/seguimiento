// Nombres que aparecen de formas distintas en el Excel → nombre canónico
const ALIASES: Record<string, string> = {
  'Aimar Mendoza':         'Aimar Mendoza Torres',
  'Caroll Avendaño':       'Caroll Tatiana Avendaño Peña',
  'Nayerlis Salas':        'Nayerlis Salas Medina',
};

export function normalizarNombre(nombre: string): string {
  const n = nombre.trim();
  return ALIASES[n] ?? n;
}
