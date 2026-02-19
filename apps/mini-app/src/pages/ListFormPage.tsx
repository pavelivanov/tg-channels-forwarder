import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { useApi } from '../hooks/useApi';
import { useChannels, getApiErrorMessage } from '../hooks/useChannels';
import { ChannelSelector } from '../components/ChannelSelector';
import { AddChannelForm } from '../components/AddChannelForm';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { showBackButton, hideBackButton } from '../lib/telegram';
import type { SourceChannel, SubscriptionList } from '../types';

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--section-header-color)',
  marginBottom: 4,
};

export function ListFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const { channels, isLoading: channelsLoading, addChannel } = useChannels();

  const [name, setName] = useState('');
  const [destinationUsername, setDestinationUsername] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingList, setIsLoadingList] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing list in edit mode
  useEffect(() => {
    if (!id) return;
    api
      .get<SubscriptionList>(`/subscription-lists/${id}`)
      .then((list) => {
        setName(list.name);
        setDestinationUsername(list.destinationUsername ?? '');
        setSelectedIds(new Set(list.sourceChannels.map((ch) => ch.id)));
      })
      .catch(() => setError('Failed to load list'))
      .finally(() => setIsLoadingList(false));
  }, [id, api]);

  // Telegram back button
  useEffect(() => {
    showBackButton(() => navigate('/'));
    return () => hideBackButton();
  }, [navigate]);

  const handleToggle = useCallback((channelId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const handleChannelAdded = useCallback((channel: SourceChannel) => {
    setSelectedIds((prev) => new Set(prev).add(channel.id));
  }, []);

  async function handleDelete() {
    if (!id) return;

    WebApp.showConfirm('Delete this subscription list?', async (confirmed) => {
      if (!confirmed) return;
      try {
        await api.del(`/subscription-lists/${id}`);
        navigate('/');
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!destinationUsername.trim()) {
      setError('Destination channel is required');
      return;
    }

    if (selectedIds.size === 0) {
      setError('Select at least one source channel');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        destinationUsername: destinationUsername.trim().replace(/^@/, ''),
        sourceChannelIds: Array.from(selectedIds),
      };

      if (isEdit) {
        await api.patch(`/subscription-lists/${id}`, payload);
      } else {
        await api.post('/subscription-lists', payload);
      }
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingList || channelsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: 16 }}>{isEdit ? 'Edit List' : 'Create List'}</h2>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <label htmlFor="list-name" style={labelStyle}>
            List Name
          </label>
          <input
            id="list-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My subscription list"
          />
        </div>

        <div style={sectionStyle}>
          <label htmlFor="dest-username" style={labelStyle}>
            Destination Channel
          </label>
          <input
            id="dest-username"
            type="text"
            value={destinationUsername}
            onChange={(e) => {
              setDestinationUsername(e.target.value);
              setError(null);
            }}
            placeholder="@mychannel"
          />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Source Channels</label>
          <ChannelSelector
            channels={channels}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Add Channel</label>
          <AddChannelForm
            addChannel={addChannel}
            onChannelAdded={handleChannelAdded}
          />
        </div>

        <ErrorMessage message={error} />

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ marginTop: 16 }}
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            style={{
              marginTop: 12,
              backgroundColor: 'transparent',
              color: 'var(--destructive-color)',
              border: '1px solid var(--destructive-color)',
            }}
          >
            Delete List
          </button>
        )}
      </form>
    </div>
  );
}
