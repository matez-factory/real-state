'use client';

import { useState, useRef } from 'react';
import { importLotsFromCsv } from '@/lib/actions/admin';
import { Upload, Loader2, X, FileSpreadsheet } from 'lucide-react';
import type { LayerNode } from './LayerTree';

interface Props {
  projectId: string;
  layers: LayerNode[];
  onClose: () => void;
}

export default function CsvImportForm({ projectId, layers, onClose }: Props) {
  const [parentId, setParentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Flatten layer tree for parent selection (exclude lots)
  function flattenLayers(nodes: LayerNode[], depth = 0): { id: string; name: string; indent: number }[] {
    const result: { id: string; name: string; indent: number }[] = [];
    for (const n of nodes) {
      if (n.type !== 'lot' && n.type !== 'unit') {
        result.push({ id: n.id, name: n.name, indent: depth });
        result.push(...flattenLayers(n.children, depth + 1));
      }
    }
    return result;
  }

  const parentOptions = flattenLayers(layers);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;

      const h = lines[0].split(',').map((s) => s.trim());
      setHeaders(h);

      const rows = lines.slice(1, 11).map((line) => line.split(',').map((s) => s.trim()));
      setPreview(rows);
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file || !parentId) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.set('project_id', projectId);
      formData.set('parent_id', parentId);
      formData.set('csv_file', file);
      const res = await importLotsFromCsv(formData);
      setResult(`Importados ${res.count} lotes exitosamente.`);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet size={20} />
            Importar lotes desde CSV
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Parent selector */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
              Layer padre (destino) *
            </span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {'  '.repeat(opt.indent)}{opt.name}
                </option>
              ))}
            </select>
          </label>

          {/* File input */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Upload size={14} />
              {file ? file.name : 'Seleccionar CSV'}
            </button>
          </div>

          {/* Format hint */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg font-mono">
            name,label,svg_element_id,area,front_length,depth_length,price,currency,status,is_corner,dimensions
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs border border-gray-200 w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left border-b border-gray-200 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 text-gray-600">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length === 10 && (
                <p className="text-xs text-gray-400 mt-1">Mostrando primeras 10 filas...</p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`text-sm p-3 rounded-lg ${result.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {result}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || !parentId || importing}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-500 font-medium disabled:opacity-50"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Importando...
                </span>
              ) : (
                'Importar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
