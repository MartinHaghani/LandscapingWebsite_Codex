import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export const ServiceCheckErrorPage = () => (
  <div className="mx-auto w-full max-w-5xl px-4 py-14 md:px-8 md:py-20">
    <Card className="space-y-7 border-white/20 bg-black/70 p-7 md:p-10">
      <div className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.15em] text-brand">Service Availability</p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-white md:text-6xl">
          Sorry, we are having some problems.
        </h1>
        <p className="mt-4 text-base text-white/75 md:text-lg">
          We could not verify service availability right now. Please check back later and try again.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/instant-quote" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Back to Instant Quote</Button>
        </Link>
        <Link to="/contact" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Contact support
          </Button>
        </Link>
      </div>
    </Card>
  </div>
);
