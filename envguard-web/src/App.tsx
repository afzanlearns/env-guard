import { Route, Routes, Link, Navigate } from 'react-router-dom';
import { Button } from './components/ui/button';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './hooks/useAuth';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Loading context...</div>;
  if (!user) return <Navigate to="/" />;
  return children;
}

function Layout() {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl text-primary">EnvGuard</span>
          </Link>
          <nav className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                  Dashboard
                </Link>
                <div className="flex items-center space-x-2">
                  <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full border border-border" />
                  <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
                </div>
              </>
            ) : (
              <Button variant="outline" onClick={() => window.location.href='http://localhost:3000/auth/github'}>
                Sign In with GitHub
              </Button>
            )}
          </nav>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/projects/:slug" element={<PrivateRoute><ProjectDetail /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}

export default App;
