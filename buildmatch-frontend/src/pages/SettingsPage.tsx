import { useAuth } from '../hooks/useAuth';
import { AvatarUpload } from '../components/ui/AvatarUpload';

export function SettingsPage() {
  const { user, updateUser } = useAuth();

  if (!user) return null;

  const name = `${user.firstName} ${user.lastName}`;

  return (
    <div style={{ padding: '40px 24px', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <h1
          style={{
            fontSize: 22, fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 32,
          }}
        >
          Account Settings
        </h1>

        {/* Profile Photo section */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '28px 32px',
          }}
        >
          <h2
            style={{
              fontSize: 15, fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            Profile Photo
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
            This photo appears on your profile and throughout the platform.
          </p>

          <AvatarUpload
            name={name}
            currentAvatarUrl={user.avatarUrl}
            size="lg"
            onUploadComplete={(url) => updateUser({ avatarUrl: url })}
            onDelete={() => updateUser({ avatarUrl: null })}
          />
        </div>

      </div>
    </div>
  );
}
