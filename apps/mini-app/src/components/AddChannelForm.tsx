import { useState } from 'react';
import type { SourceChannel } from '../types';
import { ErrorMessage } from './ErrorMessage';
import { getApiErrorMessage } from '../hooks/useChannels';

const formStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
};

const addBtnStyle: React.CSSProperties = {
  width: 'auto',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

interface AddChannelFormProps {
  addChannel: (username: string) => Promise<SourceChannel>;
  onChannelAdded: (channel: SourceChannel) => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{5,32}$/;

export function AddChannelForm({ addChannel, onChannelAdded }: AddChannelFormProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = username.replace(/^@/, '').trim();
    if (!USERNAME_RE.test(cleaned)) {
      setError('Username must be 5-32 characters, alphanumeric and underscores only');
      return;
    }

    setIsSubmitting(true);
    try {
      const channel = await addChannel(cleaned);
      onChannelAdded(channel);
      setUsername('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div style={formStyle}>
        <input
          style={inputStyle}
          type="text"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e); } }}
          disabled={isSubmitting}
        />
        <button type="button" onClick={handleSubmit} disabled={isSubmitting || !username.trim()} style={addBtnStyle}>
          {isSubmitting ? '...' : 'Add'}
        </button>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
