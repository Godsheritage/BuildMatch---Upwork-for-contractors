import { useParams } from 'react-router-dom';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-primary">Job Detail</h1>
      <p className="text-muted">ID: {id}</p>
    </div>
  );
}
