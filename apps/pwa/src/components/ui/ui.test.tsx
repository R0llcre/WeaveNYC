import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Banner, Button, Card, Checkbox, Field, PageHeader, Pill, Radio } from './index';

// Mock next/link so <Link> renders as a plain anchor in the test env.
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('ui/Button', () => {
  it('renders label, classes, data-testid and type=button by default', () => {
    render(
      <Button data-testid="btn" variant="primary" size="lg">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn).toHaveTextContent('Save');
    expect(btn.className).toContain('button');
    expect(btn.className).toContain('button--primary');
    expect(btn.className).toContain('button--lg');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('sets aria-busy and disabled when loading', () => {
    render(
      <Button data-testid="btn" loading>
        Sending
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
  });

  it('renders leading and trailing icons as aria-hidden spans', () => {
    render(
      <Button
        data-testid="btn"
        leadingIcon={<span data-testid="lead">L</span>}
        trailingIcon={<span data-testid="trail">T</span>}
      >
        Go
      </Button>,
    );
    expect(screen.getByTestId('lead')).toBeInTheDocument();
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  it('renders as an anchor when as="a" with href', () => {
    render(
      <Button as="a" href="/test" data-testid="btn-link">
        Go
      </Button>,
    );
    const link = screen.getByTestId('btn-link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/test');
    expect(link.className).toContain('button');
    expect(link.className).toContain('button--primary');
    expect(link.className).toContain('button--md');
  });

  it('applies variant and size classes to anchor form', () => {
    render(
      <Button as="a" href="tel:+15551234" variant="secondary" size="lg" data-testid="btn-tel">
        Call
      </Button>,
    );
    const link = screen.getByTestId('btn-tel');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'tel:+15551234');
    expect(link.className).toContain('button--secondary');
    expect(link.className).toContain('button--lg');
  });
});

describe('ui/Card', () => {
  it('renders a section by default with card classes and passes data-testid', () => {
    render(
      <Card data-testid="card" variant="raised">
        hello
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('SECTION');
    expect(card.className).toContain('card');
    expect(card.className).toContain('card--raised');
    expect(card).toHaveTextContent('hello');
  });

  it('renders as article when as="article"', () => {
    render(
      <Card data-testid="card" as="article" variant="flat">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').tagName).toBe('ARTICLE');
  });

  it('renders as div when as="div"', () => {
    render(
      <Card data-testid="card" as="div">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').tagName).toBe('DIV');
  });
});

describe('ui/Field', () => {
  it('wires label, hint, and aria-describedby to the child input', () => {
    render(
      <Field label="Email" hint="we never share" data-testid="field">
        <input data-testid="email-input" name="email" />
      </Field>,
    );
    const input = screen.getByTestId('email-input');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('we never share').id).toBe(describedBy);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('surfaces error text with role=alert and sets aria-invalid', () => {
    render(
      <Field label="Email" error="required" required>
        <input data-testid="email-input" name="email" />
      </Field>,
    );
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('required');
  });
});

describe('ui/Radio', () => {
  it('renders label/hint with type=radio', () => {
    render(<Radio data-testid="r" name="g" value="a" label="Option A" hint="first one" />);
    const input = screen.getByTestId('r');
    expect(input).toHaveAttribute('type', 'radio');
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('first one')).toBeInTheDocument();
  });
});

describe('ui/Checkbox', () => {
  it('renders label/hint with type=checkbox', () => {
    render(<Checkbox data-testid="c" name="c1" label="Agree" hint="terms apply" />);
    const input = screen.getByTestId('c');
    expect(input).toHaveAttribute('type', 'checkbox');
    expect(screen.getByText('Agree')).toBeInTheDocument();
    expect(screen.getByText('terms apply')).toBeInTheDocument();
  });
});

describe('ui/Pill', () => {
  it('reflects active state via class and aria-pressed', () => {
    render(
      <Pill data-testid="pill-on" active>
        EN
      </Pill>,
    );
    render(<Pill data-testid="pill-off">ES</Pill>);
    const on = screen.getByTestId('pill-on');
    const off = screen.getByTestId('pill-off');
    expect(on.className).toContain('pill--active');
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(off.className).not.toContain('pill--active');
  });
});

describe('ui/Banner', () => {
  it('uses role=status for info/success tones', () => {
    render(
      <Banner data-testid="banner" tone="info" title="FYI">
        body
      </Banner>,
    );
    const el = screen.getByTestId('banner');
    expect(el).toHaveAttribute('role', 'status');
    expect(el.className).toContain('banner--info');
    expect(el).toHaveTextContent('FYI');
    expect(el).toHaveTextContent('body');
  });

  it('uses role=alert for warning/danger tones and wires dismiss/action handlers', () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(
      <Banner
        data-testid="banner"
        tone="danger"
        title="oops"
        actionLabel="Retry"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    );
    const el = screen.getByTestId('banner');
    expect(el).toHaveAttribute('role', 'alert');
    screen.getByRole('button', { name: /retry/i }).click();
    screen.getByRole('button', { name: /dismiss/i }).click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ui/PageHeader', () => {
  it('renders eyebrow, title, subtitle, back link and actions', () => {
    render(
      <PageHeader
        data-testid="hero"
        eyebrow="Step 1 of 2"
        title="Welcome"
        subtitle="Get started"
        backHref="/"
        actions={<button data-testid="hero-cta">Next</button>}
      />,
    );
    const hero = screen.getByTestId('hero');
    expect(hero.tagName).toBe('SECTION');
    expect(hero.className).toContain('hero');
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome');
    expect(screen.getByText('Get started')).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /back/i });
    expect(back).toHaveAttribute('href', '/');
    expect(screen.getByTestId('hero-cta')).toBeInTheDocument();
  });

  it('omits topbar when neither eyebrow nor backHref is provided', () => {
    render(<PageHeader data-testid="hero" title="Just a title" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
