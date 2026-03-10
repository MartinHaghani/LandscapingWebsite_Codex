import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export const ServiceAreaRequestedPage = () => (
  <div className="mx-auto w-full max-w-4xl px-4 py-14 md:px-8 md:py-20">
    <Card className="space-y-6 border-white/20 bg-black/70 p-7 md:p-10">
      <h1 className="font-display text-4xl font-bold text-white md:text-5xl">Thank you for your request</h1>
      <p className="text-base text-white/75 md:text-lg">
        We really appreciate your request. Our team is working hard to expand Autoscape service coverage, and we hope
        Autoscape services will be in your area soon ;).
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link to="/" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Back to home
          </Button>
        </Link>
        <Link to="/instant-quote" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">Try another address</Button>
        </Link>
      </div>
    </Card>
  </div>
);
