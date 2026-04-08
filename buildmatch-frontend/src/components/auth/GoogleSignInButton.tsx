import { useEffect, useRef } from 'react';

// ── Google Identity Services types (only the bits we use) ────────────────────

interface GsiCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GsiButtonConfig {
  type?:    'standard' | 'icon';
  theme?:   'outline' | 'filled_blue' | 'filled_black';
  size?:    'large' | 'medium' | 'small';
  text?:    'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?:   'rectangular' | 'pill' | 'circle' | 'square';
  width?:   string | number;
  logo_alignment?: 'left' | 'center';
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GsiCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonConfig) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  text?:        GsiButtonConfig['text'];
  width?:       number;
}

/**
 * Renders the Google-hosted "Sign in with Google" button. Calls
 * `onCredential(idToken)` when the user authenticates. The parent component
 * is responsible for POSTing that idToken to the backend.
 *
 * Requires `VITE_GOOGLE_CLIENT_ID` to be set; if missing, renders a small
 * disabled-looking placeholder so dev environments don't crash.
 */
export function GoogleSignInButton({ onCredential, text = 'continue_with', width = 320 }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef  = useRef(onCredential);
  callbackRef.current = onCredential;

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let cancelled = false;
    let attempts = 0;

    function tryRender() {
      if (cancelled) return;
      const gsi = window.google?.accounts?.id;
      if (!gsi) {
        attempts += 1;
        if (attempts < 50) setTimeout(tryRender, 100); // wait up to ~5s for the script
        return;
      }

      gsi.initialize({
        client_id: clientId!,
        callback: (resp) => {
          if (resp?.credential) callbackRef.current(resp.credential);
        },
        ux_mode: 'popup',
      });

      // Clear any previous render before re-rendering (e.g. after StrictMode double-mount)
      if (containerRef.current) containerRef.current.innerHTML = '';
      gsi.renderButton(containerRef.current!, {
        type:  'standard',
        theme: 'outline',
        size:  'large',
        text,
        shape: 'rectangular',
        width: String(width),
        logo_alignment: 'left',
      });
    }

    tryRender();
    return () => { cancelled = true; };
  }, [clientId, text, width]);

  if (!clientId) {
    return (
      <div
        style={{
          padding: '10px 14px',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}
      >
        Google sign-in is not configured.
        <br />
        Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code>.
      </div>
    );
  }

  return <div ref={containerRef} aria-label="Sign in with Google" />;
}
