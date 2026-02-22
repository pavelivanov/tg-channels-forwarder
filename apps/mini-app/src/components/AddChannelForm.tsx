import { useState } from 'react';
import { toast } from 'sonner';
import type { SourceChannel } from '../types';
import { ErrorMessage } from './ErrorMessage';
import { getApiErrorMessage } from '../hooks/useChannels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      toast.success(`Channel @${cleaned} added`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 items-start">
        <Input
          className="flex-1"
          type="text"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e); } }}
          disabled={isSubmitting}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !username.trim()}
          className="shrink-0"
        >
          {isSubmitting ? '...' : 'Add'}
        </Button>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
