import type { ReactNode } from 'react';
import styles from './AdminDataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
}

interface AdminDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyText?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className={styles.skeletonRow}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={styles.skeletonCell}>
          <div className={styles.skeletonBar} />
        </td>
      ))}
    </tr>
  );
}

export function AdminDataTable<T>({
  columns, data, rowKey, isLoading, emptyText = 'No results found.',
}: AdminDataTableProps<T>) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={styles.th} style={col.width ? { width: col.width } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>{emptyText}</td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={rowKey(row)} className={styles.row}>
                {columns.map(col => (
                  <td key={col.key} className={styles.td}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
