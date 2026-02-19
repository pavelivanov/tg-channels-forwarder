import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SubscriptionList, SourceChannel } from '../src/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
};
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', telegramId: '123', firstName: 'Test', lastName: null, username: 'test', photoUrl: null, isPremium: false },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    token: 'mock-token',
    api: mockApi,
  }),
}));

const mockChannels: SourceChannel[] = [
  { id: 'ch1', telegramId: '-100111', username: 'channel1', title: 'Channel 1', isActive: true },
  { id: 'ch2', telegramId: '-100222', username: 'channel2', title: 'Channel 2', isActive: true },
  { id: 'ch3', telegramId: '-100333', username: 'channel3', title: 'Channel 3', isActive: true },
];

const existingList: SubscriptionList = {
  id: 'list-1',
  name: 'Existing List',
  destinationUsername: 'destchannel',
  isActive: true,
  sourceChannels: [mockChannels[0]],
};

describe('ListFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/channels') return Promise.resolve(mockChannels);
      if (path.startsWith('/subscription-lists/')) return Promise.resolve(existingList);
      return Promise.resolve([]);
    });
    mockApi.post.mockResolvedValue({ id: 'new-list', name: 'New' });
    mockApi.patch.mockResolvedValue({ ...existingList, name: 'Updated' });
  });

  function renderCreate() {
    return render(
      <MemoryRouter initialEntries={['/lists/new']}>
        <Routes>
          <Route path="/lists/new" element={<ListFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function renderEdit() {
    return render(
      <MemoryRouter initialEntries={['/lists/list-1']}>
        <Routes>
          <Route path="/lists/:id" element={<ListFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  // Dynamic import to avoid hoisting issues
  let ListFormPage: React.ComponentType;
  beforeEach(async () => {
    const mod = await import('../src/pages/ListFormPage');
    ListFormPage = mod.ListFormPage;
  });

  it('renders empty fields in create mode', async () => {
    renderCreate();

    const nameInput = await screen.findByLabelText(/list name/i);
    expect(nameInput).toHaveValue('');

    expect(screen.getByText(/create/i, { selector: 'button' })).toBeInTheDocument();
  });

  it('pre-fills fields in edit mode', async () => {
    renderEdit();

    const nameInput = await screen.findByLabelText(/list name/i);
    expect(nameInput).toHaveValue('Existing List');
  });

  it('shows channel count out of 30', async () => {
    renderCreate();

    await screen.findByText(/\/\s*30/);
  });

  it('calls POST on create submission', async () => {
    const user = userEvent.setup();
    renderCreate();

    const nameInput = await screen.findByLabelText(/list name/i);
    await user.type(nameInput, 'New List');

    const destInput = screen.getByLabelText(/destination channel/i);
    await user.type(destInput, '@mydest');

    // Select a channel
    const checkbox = screen.getByRole('checkbox', { name: /channel1/i });
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /create/i });
    await user.click(submitBtn);

    expect(mockApi.post).toHaveBeenCalledWith('/subscription-lists', expect.objectContaining({
      name: 'New List',
      destinationUsername: 'mydest',
    }));
  });

  it('calls PATCH on edit submission', async () => {
    const user = userEvent.setup();
    renderEdit();

    const nameInput = await screen.findByLabelText(/list name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    const submitBtn = screen.getByRole('button', { name: /save/i });
    await user.click(submitBtn);

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/subscription-lists/list-1',
      expect.objectContaining({ name: 'Updated Name' }),
    );
  });

  it('shows validation errors from backend inline', async () => {
    mockApi.post.mockRejectedValueOnce({
      statusCode: 400,
      message: 'Channel not found or bot has no access',
      error: 'Bad Request',
    });

    const user = userEvent.setup();
    renderCreate();

    const nameInput = await screen.findByLabelText(/list name/i);
    await user.type(nameInput, 'New List');

    const destInput = screen.getByLabelText(/destination channel/i);
    await user.type(destInput, '@nonexistent');

    const checkbox = screen.getByRole('checkbox', { name: /channel1/i });
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /create/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/channel not found/i)).toBeInTheDocument();
  });

  it('shows limit error on 403', async () => {
    mockApi.post.mockRejectedValueOnce({
      statusCode: 403,
      message: 'Maximum list limit reached',
      error: 'Forbidden',
    });

    const user = userEvent.setup();
    renderCreate();

    const nameInput = await screen.findByLabelText(/list name/i);
    await user.type(nameInput, 'New List');

    const destInput = screen.getByLabelText(/destination channel/i);
    await user.type(destInput, '@mychannel');

    const checkbox = screen.getByRole('checkbox', { name: /channel1/i });
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /create/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/maximum list limit/i)).toBeInTheDocument();
  });

  it('navigates to Home on successful create', async () => {
    const user = userEvent.setup();
    renderCreate();

    const nameInput = await screen.findByLabelText(/list name/i);
    await user.type(nameInput, 'New List');

    const destInput = screen.getByLabelText(/destination channel/i);
    await user.type(destInput, '@mydest');

    const checkbox = screen.getByRole('checkbox', { name: /channel1/i });
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /create/i });
    await user.click(submitBtn);

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
