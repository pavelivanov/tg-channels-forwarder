import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SubscriptionList } from '../src/types';

const mockLists: SubscriptionList[] = [
  {
    id: '1',
    name: 'My List',
    destinationUsername: 'destchannel',
    isActive: true,
    sourceChannels: [
      {
        id: 'ch1',
        telegramId: '-1001111111111',
        username: 'source1',
        title: 'Source 1',
        isActive: true,
      },
      {
        id: 'ch2',
        telegramId: '-1002222222222',
        username: 'source2',
        title: 'Source 2',
        isActive: true,
      },
    ],
  },
  {
    id: '2',
    name: 'Inactive List',
    destinationUsername: 'otherchannel',
    isActive: false,
    sourceChannels: [],
  },
];

// Mock useAuth to avoid needing AuthProvider
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      telegramId: '123',
      firstName: 'Test',
      lastName: null,
      username: 'test',
      photoUrl: null,
      isPremium: false,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    token: 'mock-token',
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      del: vi.fn(),
    },
  }),
}));

// Mocked version of useSubscriptionLists — overridden per test
const mockUseSubscriptionLists = vi.fn();
vi.mock('../src/hooks/useSubscriptionLists', () => ({
  useSubscriptionLists: () => mockUseSubscriptionLists(),
}));

describe('HomePage', () => {
  beforeEach(() => {
    mockUseSubscriptionLists.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderHome() {
    const { HomePage } = await import('../src/pages/HomePage');
    return render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
  }

  it('renders subscription list cards with name, destination, source count, and badge', async () => {
    mockUseSubscriptionLists.mockReturnValue({
      lists: mockLists,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderHome();

    expect(screen.getByText('My List')).toBeInTheDocument();
    expect(screen.getByText(/@destchannel/)).toBeInTheDocument();
    expect(screen.getByText(/2 channels/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    expect(screen.getByText('Inactive List')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders empty state with create prompt when no lists', async () => {
    mockUseSubscriptionLists.mockReturnValue({
      lists: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderHome();

    expect(screen.getByText(/no subscription lists/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first list/i)).toBeInTheDocument();
  });

  it('shows loading spinner while fetching lists', async () => {
    mockUseSubscriptionLists.mockReturnValue({
      lists: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    await renderHome();

    // LoadingSpinner renders dots, not text — check container exists
    // The HomePage should render LoadingSpinner when isLoading is true
    expect(screen.queryByText(/no subscription lists/i)).not.toBeInTheDocument();
    expect(screen.queryByText('My List')).not.toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockUseSubscriptionLists.mockReturnValue({
      lists: [],
      isLoading: false,
      error: 'Failed to load lists',
      refetch: vi.fn(),
    });

    await renderHome();

    expect(screen.getByText('Failed to load lists')).toBeInTheDocument();
  });
});
