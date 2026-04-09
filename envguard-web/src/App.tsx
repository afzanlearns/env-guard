import { Route, Routes, Link } from 'react-router-dom';
import { Button } from './components/ui/button';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl text-primary">EnvGuard</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Button variant="outline" onClick={() => window.location.href='http://localhost:3000/auth/github'}>
              Sign In with GitHub
            </Button>
          </nav>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
