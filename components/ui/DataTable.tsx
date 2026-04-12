// components/ui/DataTable.tsx
import { ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  title: string;
  action?: ReactNode;
  searchable?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, title, action, emptyMessage = "Aucune donnée"
}: DataTableProps<T>) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        {action && <div>{action}</div>}
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}
                    className="text-center text-muted py-10 font-mono text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : data.map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
