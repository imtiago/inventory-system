import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { Page } from '../Page';
import { PageHeader } from '../PageHeader';
import { Section } from '../../details/Section';
import { DetailsGrid } from '../../details/DetailsGrid';
import { ConfirmDialog } from '../../ConfirmDialog';

const root = resolve(__dirname, '../../../../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('index.html', () => {
  test('idioma pt-BR e título real', () => {
    const html = read('index.html');
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<title>Estoque</title>');
    expect(html).toMatch(/name="theme-color"/);
  });
});

describe('index.css (só tema claro)', () => {
  const css = read('src/index.css');
  test('sem dark mode quebrado', () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).not.toMatch(/color-scheme:\s*light dark/);
  });
  test('define --background e --foreground', () => {
    expect(css).toMatch(/--background:/);
    expect(css).toMatch(/--foreground:/);
  });
  test('inputs com 16px abaixo de sm (sem zoom no iOS)', () => {
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*input[\s\S]*font-size:\s*16px/);
  });
});

describe('Page e Section', () => {
  test('altura fixa e overflow-hidden só em lg+', () => {
    render(
      <Page>
        <Section title="T">x</Section>
      </Page>,
    );
    const page = screen.getByText('x').closest('section')!.parentElement!;
    expect(page).toHaveClass('lg:h-full', 'lg:overflow-hidden');
    expect(page).not.toHaveClass('h-full');
    expect(page).not.toHaveClass('overflow-hidden');
    const section = screen.getByText('x').closest('section')!;
    expect(section).toHaveClass('lg:overflow-hidden');
    expect(section).not.toHaveClass('overflow-hidden');
  });

  test('cabeçalho da seção quebra linha', () => {
    render(<Section title="Titulo" actions={<button>Ação</button>}>x</Section>);
    expect(screen.getByRole('heading', { name: 'Titulo' }).closest('div')!.parentElement).toHaveClass('flex-wrap');
  });

  test('cabeçalho da página quebra linha', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Titulo" actions={<button>Ação</button>} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Titulo' }).closest('div')!.parentElement).toHaveClass('flex-wrap');
  });
});

describe('grades e diálogos', () => {
  test('DetailsGrid colapsa no celular', () => {
    const { container } = render(<DetailsGrid>x</DetailsGrid>);
    expect(container.firstElementChild).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
  });

  test('ConfirmDialog tem margem lateral e altura máxima com rolagem', () => {
    render(<ConfirmDialog open title="Excluir?" description="d" onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('p-4');
    expect(dialog.firstElementChild).toHaveClass('max-h-[90dvh]', 'overflow-y-auto');
  });
});
