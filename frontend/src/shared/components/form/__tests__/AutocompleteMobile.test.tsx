import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Autocomplete } from '../Autocomplete';
import { setViewport } from '@/test/viewport';

const options = [{ id: '1', name: 'Maria' }];

function setup() {
  render(
    <Autocomplete
      label="Cliente"
      options={options}
      value={null}
      onChange={() => {}}
      getOptionValue={(o) => o.id}
      getOptionLabel={(o) => o.name}
    />,
  );
}

afterEach(() => vi.useRealTimers());

describe('Autocomplete no celular (M10)', () => {
  test('em toque, ao focar rola o campo para o topo da área visível', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    setViewport(375, { pointer: 'coarse' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();

    await userEvent.click(screen.getByRole('combobox'));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
  });

  test('com ponteiro fino não rola', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    setViewport(1280, { pointer: 'fine' });
    setup();
    await userEvent.click(screen.getByRole('combobox'));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test('as opções têm altura mínima de toque (44 px)', async () => {
    setup();
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('button', { name: /Maria/ })).toHaveClass('min-h-11');
  });
});
