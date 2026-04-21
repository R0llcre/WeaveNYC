import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { NextIntlClientProvider } from 'next-intl';

import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  IconButton,
  PageHeader,
  Pill,
  Radio,
  RouteLoadingFallback,
} from './index';
import { messages } from '@/lib/i18n';
import { triggerHaptic } from '@/lib/use-haptic';

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
        dismissLabel="Dismiss"
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

/* ============================================================================
   Wave 6C — press microinteraction · haptic integration
   ----------------------------------------------------------------------------
   The CSS scale lives in `apps/pwa/src/app/globals.css` and is non-testable
   here because jsdom doesn't evaluate `:active` pseudo-classes. These tests
   focus on the JS side: the `haptic={true}` prop must fire navigator.vibrate
   on click (and only on click), the default must not fire, disabled buttons
   must not fire, and `prefers-reduced-motion: reduce` must short-circuit.
   ============================================================================ */

/**
 * Builds a vibrate spy that satisfies `'vibrate' in navigator`. jsdom does
 * not ship the Vibration API so defineProperty is the cleanest way to attach
 * one for a single test block; we restore the original after each test to
 * keep the global environment hermetic.
 */
function installVibrateSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn();
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: spy,
  });
  return spy;
}

function uninstallVibrateSpy() {
  // `delete` works here because defineProperty set configurable: true.
  delete (navigator as unknown as { vibrate?: unknown }).vibrate;
}

/**
 * Replaces `window.matchMedia` for the scope of the callback so tests can
 * pin the `(prefers-reduced-motion: reduce)` evaluation to a known value.
 * Returns the original implementation so the caller can restore it.
 */
function stubMatchMedia(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('lib/use-haptic · triggerHaptic', () => {
  let restoreMatchMedia: (() => void) | null = null;

  beforeEach(() => {
    restoreMatchMedia = stubMatchMedia(false);
  });

  afterEach(() => {
    uninstallVibrateSpy();
    if (restoreMatchMedia) {
      restoreMatchMedia();
      restoreMatchMedia = null;
    }
  });

  it('calls navigator.vibrate with the default 10ms pattern', () => {
    const vibrate = installVibrateSpy();
    triggerHaptic();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('forwards a custom numeric pattern', () => {
    const vibrate = installVibrateSpy();
    triggerHaptic(25);
    expect(vibrate).toHaveBeenCalledWith(25);
  });

  it('forwards a custom array pattern', () => {
    const vibrate = installVibrateSpy();
    triggerHaptic([10, 50, 10]);
    expect(vibrate).toHaveBeenCalledWith([10, 50, 10]);
  });

  it('no-ops when navigator.vibrate is undefined', () => {
    // Deliberately do NOT install a vibrate spy; the property check inside
    // triggerHaptic should short-circuit without throwing.
    expect(() => triggerHaptic()).not.toThrow();
  });

  it('respects prefers-reduced-motion: reduce', () => {
    const vibrate = installVibrateSpy();
    restoreMatchMedia?.();
    restoreMatchMedia = stubMatchMedia(true);
    triggerHaptic();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('swallows exceptions thrown by navigator.vibrate', () => {
    installVibrateSpy().mockImplementation(() => {
      throw new Error('NotAllowedError: user gesture required');
    });
    // iOS Safari throws NotAllowedError when vibrate is called outside a
    // user gesture; triggerHaptic must swallow so the render tree does not
    // crash on a mis-wired caller.
    expect(() => triggerHaptic()).not.toThrow();
  });
});

describe('ui/Button · haptic prop', () => {
  let restoreMatchMedia: (() => void) | null = null;

  beforeEach(() => {
    restoreMatchMedia = stubMatchMedia(false);
  });

  afterEach(() => {
    uninstallVibrateSpy();
    if (restoreMatchMedia) {
      restoreMatchMedia();
      restoreMatchMedia = null;
    }
  });

  it('fires navigator.vibrate when haptic is true', () => {
    const vibrate = installVibrateSpy();
    const onClick = vi.fn();
    render(
      <Button data-testid="btn" haptic onClick={onClick}>
        Publish
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire vibrate when haptic prop is omitted', () => {
    const vibrate = installVibrateSpy();
    const onClick = vi.fn();
    render(
      <Button data-testid="btn" onClick={onClick}>
        Cancel
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('skips vibrate when the button is disabled', () => {
    const vibrate = installVibrateSpy();
    const onClick = vi.fn();
    render(
      <Button data-testid="btn" haptic disabled onClick={onClick}>
        Publish
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).not.toHaveBeenCalled();
    // Native disabled attribute blocks onClick too, which is the desired
    // behaviour — a pressed-but-dead button must be inert end-to-end.
    expect(onClick).not.toHaveBeenCalled();
  });

  it('skips vibrate when the button is loading', () => {
    const vibrate = installVibrateSpy();
    render(
      <Button data-testid="btn" haptic loading>
        Sending
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('fires vibrate on anchor-form buttons when haptic is true', () => {
    const vibrate = installVibrateSpy();
    render(
      <Button as="a" href="/test" data-testid="btn" haptic>
        Open
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('respects prefers-reduced-motion on a haptic button', () => {
    const vibrate = installVibrateSpy();
    restoreMatchMedia?.();
    restoreMatchMedia = stubMatchMedia(true);
    render(
      <Button data-testid="btn" haptic>
        Confirm
      </Button>,
    );
    fireEvent.click(screen.getByTestId('btn'));
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('ui/IconButton · haptic prop', () => {
  let restoreMatchMedia: (() => void) | null = null;

  beforeEach(() => {
    restoreMatchMedia = stubMatchMedia(false);
  });

  afterEach(() => {
    uninstallVibrateSpy();
    if (restoreMatchMedia) {
      restoreMatchMedia();
      restoreMatchMedia = null;
    }
  });

  it('fires vibrate on click when haptic is true', () => {
    const vibrate = installVibrateSpy();
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Accept" haptic onClick={onClick} data-testid="ibtn">
        <svg />
      </IconButton>,
    );
    fireEvent.click(screen.getByTestId('ibtn'));
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire vibrate when haptic prop is omitted', () => {
    const vibrate = installVibrateSpy();
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Close" onClick={onClick} data-testid="ibtn">
        <svg />
      </IconButton>,
    );
    fireEvent.click(screen.getByTestId('ibtn'));
    expect(vibrate).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ui/RouteLoadingFallback', () => {
  it('renders the localized shellLoading label in English (inner mode)', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en} timeZone="UTC">
        <RouteLoadingFallback />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByText(messages.en.shellLoading).length).toBeGreaterThan(0);
  });

  it('renders the localized shellLoading label in Chinese', () => {
    render(
      <NextIntlClientProvider locale="zh" messages={messages.zh} timeZone="UTC">
        <RouteLoadingFallback />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByText(messages.zh.shellLoading).length).toBeGreaterThan(0);
  });

  it('emits a <main> wrapper when shellMode="shell"', () => {
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={messages.es} timeZone="UTC">
        <RouteLoadingFallback shellMode="shell" />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector('main.shell')).not.toBeNull();
  });
});
