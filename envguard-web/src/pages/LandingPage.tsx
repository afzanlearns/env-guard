import { Button } from '../components/ui/button';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center max-w-4xl mx-auto space-y-12">
      <div className="space-y-6">
        <h1 className="text-6xl font-extrabold tracking-tight sm:text-7xl">
          Zero-Secrets Environment <span className="text-primary bg-clip-text">Syncing.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Sync your <code className="bg-muted px-1.5 py-0.5 rounded-md">.env</code> keys, descriptions, and types across your entire team. Never transmit or store a secret value again.
        </p>
      </div>

      <div className="flex space-x-4">
        <Button size="lg" className="h-12 px-8 text-md shadow-lg shadow-primary/20">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button size="lg" variant="outline" className="h-12 px-8 text-md font-mono">
          npm i -D envguard-cli
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-8 pt-10 text-left">
        <div className="p-6 border rounded-2xl bg-card hover:shadow-md transition-shadow">
          <ShieldCheck className="w-10 h-10 text-primary mb-4" />
          <h3 className="text-lg font-bold">100% Value Blind</h3>
          <p className="text-muted-foreground mt-2">
            The CLI parses your .env file locally and strips out the right side of the equals sign. We only sync the skeleton schema.
          </p>
        </div>
        <div className="p-6 border rounded-2xl bg-card hover:shadow-md transition-shadow">
          <Zap className="w-10 h-10 text-primary mb-4" />
          <h3 className="text-lg font-bold">Instant Drift Detection</h3>
          <p className="text-muted-foreground mt-2">
            Know exactly when John from backend adds a new database variable and fails to tell the rest of the team.
          </p>
        </div>
      </div>
    </div>
  );
}
