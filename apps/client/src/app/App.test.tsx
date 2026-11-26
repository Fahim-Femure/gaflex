import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

describe('App', () => {
  it('shows the GAFLEX landing page at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'GAFLEX' })).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Fahim/)).toBeInTheDocument();
  });
});
