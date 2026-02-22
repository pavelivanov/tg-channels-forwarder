import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApi } from '../hooks/useApi';
import { useChannels, getApiErrorMessage } from '../hooks/useChannels';
import { ChannelSelector } from '../components/ChannelSelector';
import { AddChannelForm } from '../components/AddChannelForm';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { showBackButton, hideBackButton } from '../lib/telegram';
import type { SourceChannel, SubscriptionList } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      .catch(() => toast.error('Failed to load list'))
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
    try {
      await api.del(`/subscription-lists/${id}`);
      toast.success('List deleted');
      navigate('/');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!destinationUsername.trim()) {
      errors.destination = 'Destination channel is required';
    }
    if (selectedIds.size === 0) {
      errors.channels = 'Select at least one source channel';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        destinationUsername: destinationUsername.trim().replace(/^@/, ''),
        sourceChannelIds: Array.from(selectedIds),
      };

      if (isEdit) {
        await api.patch(`/subscription-lists/${id}`, payload);
        toast.success('List saved');
      } else {
        await api.post('/subscription-lists', payload);
        toast.success('List created');
      }
      navigate('/');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingList || channelsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Edit List' : 'Create List'}</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="list-name">List Name</Label>
          <Input
            id="list-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
            placeholder="My subscription list"
          />
          {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dest-username">Destination Channel</Label>
          <Input
            id="dest-username"
            type="text"
            value={destinationUsername}
            onChange={(e) => { setDestinationUsername(e.target.value); setFieldErrors((p) => ({ ...p, destination: '' })); }}
            placeholder="@mychannel"
          />
          {fieldErrors.destination && <p className="text-destructive text-sm">{fieldErrors.destination}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Source Channels</Label>
          <ChannelSelector
            channels={channels}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />
          {fieldErrors.channels && <p className="text-destructive text-sm">{fieldErrors.channels}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Add Channel</Label>
          <AddChannelForm
            addChannel={addChannel}
            onChannelAdded={handleChannelAdded}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>

        {isEdit && (
          <>
            <Separator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-4 mr-2" />
                  Delete List
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete subscription list?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{name || 'this list'}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </form>
    </div>
  );
}
