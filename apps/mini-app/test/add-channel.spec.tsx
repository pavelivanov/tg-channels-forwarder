import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockAddChannel = vi.fn();
const mockOnChannelAdded = vi.fn();

describe('AddChannelForm', () => {
  let AddChannelForm: React.ComponentType<{
    addChannel: (username: string) => Promise<unknown>;
    onChannelAdded: (channel: unknown) => void;
  }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../src/components/AddChannelForm');
    AddChannelForm = mod.AddChannelForm;
  });

  function renderForm() {
    return render(
      <AddChannelForm
        addChannel={mockAddChannel}
        onChannelAdded={mockOnChannelAdded}
      />,
    );
  }

  it('adds channel on success and clears input', async () => {
    const newChannel = { id: 'ch-new', telegramId: '-100999', username: 'newchannel', title: 'New', isActive: true };
    mockAddChannel.mockResolvedValueOnce(newChannel);

    const user = userEvent.setup();
    renderForm();

    const input = screen.getByPlaceholderText(/@username/i);
    await user.type(input, 'newchannel');

    const addBtn = screen.getByRole('button', { name: /add/i });
    await user.click(addBtn);

    await vi.waitFor(() => {
      expect(mockAddChannel).toHaveBeenCalledWith('newchannel');
    });
    expect(mockOnChannelAdded).toHaveBeenCalledWith(newChannel);

    expect(input).toHaveValue('');
  });

  it('shows error when bot is not admin (422)', async () => {
    mockAddChannel.mockRejectedValueOnce({
      statusCode: 422,
      message: 'Bot is not an admin in this channel',
      error: 'Unprocessable Entity',
    });

    const user = userEvent.setup();
    renderForm();

    const input = screen.getByPlaceholderText(/@username/i);
    await user.type(input, 'badchannel');

    const addBtn = screen.getByRole('button', { name: /add/i });
    await user.click(addBtn);

    expect(await screen.findByText(/bot is not an admin/i)).toBeInTheDocument();
  });

  it('shows error for invalid username format', async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByPlaceholderText(/@username/i);
    await user.type(input, 'ab');

    const addBtn = screen.getByRole('button', { name: /add/i });
    await user.click(addBtn);

    expect(screen.getByText(/5-32 characters/i)).toBeInTheDocument();
    expect(mockAddChannel).not.toHaveBeenCalled();
  });

  it('clears error when retrying', async () => {
    mockAddChannel
      .mockRejectedValueOnce({
        statusCode: 422,
        message: 'Bot is not an admin',
        error: 'Unprocessable Entity',
      })
      .mockResolvedValueOnce({ id: 'ch-new', username: 'goodchannel' });

    const user = userEvent.setup();
    renderForm();

    const input = screen.getByPlaceholderText(/@username/i);
    await user.type(input, 'badchannel');

    const addBtn = screen.getByRole('button', { name: /add/i });
    await user.click(addBtn);

    expect(await screen.findByText(/bot is not an admin/i)).toBeInTheDocument();

    // Clear and retry
    await user.clear(input);
    await user.type(input, 'goodchannel');
    await user.click(addBtn);

    await vi.waitFor(() => {
      expect(screen.queryByText(/bot is not an admin/i)).not.toBeInTheDocument();
    });
  });
});
