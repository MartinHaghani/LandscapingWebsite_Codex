import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const paymentCompleteMessage =
  'Thank you for choosing Autoscape! We start mowing the same week.';

export const PaymentCompletePage = () => (
  <div className="mx-auto flex w-full max-w-5xl px-4 py-12 md:min-h-[64vh] md:items-center md:px-8 md:py-20">
    <section className="w-full overflow-hidden rounded-[1.75rem] bg-[#111813] text-white shadow-soft md:rounded-none">
      <div className="px-5 py-8 md:px-10 md:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9fd8b0]">Payment Complete</p>
        <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">
          {paymentCompleteMessage}
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/78 md:text-base">
          Your payment was submitted through Stripe Checkout. The Autoscape team will use your approved quote details to
          prepare service.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Open Dashboard</Button>
          </Link>
          <Link to="/" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Back to Autoscape
            </Button>
          </Link>
        </div>
      </div>
    </section>
  </div>
);
