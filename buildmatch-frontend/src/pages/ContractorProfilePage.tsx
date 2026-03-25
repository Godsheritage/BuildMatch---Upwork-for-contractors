import { useParams } from 'react-router-dom';

export function ContractorProfilePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-primary">Contractor Profile</h1>
      <p className="text-muted">ID: {id}</p>
    </div>
  );
}
