import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/setup/test-utils';
import { App } from './App';

describe('App — smoke tests', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('displays the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('shows prototype or connected mode badge', () => {
    render(<App />);
    expect(screen.getByText(/Prototype Mode|Connected Mode/)).toBeTruthy();
  });
});
