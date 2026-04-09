import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Project {
  id: string;
  name: string;
  slug: string;
  environments: Array<{ id: string; name: string }>;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/api/projects');
        // We'd need to properly join environments on the backend, for now, mock the envs array slightly 
        // if the basic API just returns the project row
        setProjects(data.projects.map((p: any) => ({
          ...p,
          environments: p.environments || [{name: 'development'}, {name: 'staging'}, {name: 'production'}] // Fallback if API hasn't enriched them
        })));
      } catch (err) {
        console.error("Failed fetching projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your Projects</h2>
          <p className="text-muted-foreground">Manage schema across your collaborative codebases.</p>
        </div>
        <Button>+ New Project</Button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-muted-foreground border rounded-lg border-dashed">
          <p>No projects found.</p>
          <Button variant="link" className="mt-2 text-primary">Create your first project</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <Link key={proj.id} to={`/projects/${proj.slug}`}>
              <Card className="hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer h-full border-muted/60">
                <CardHeader>
                  <CardTitle className="text-xl">{proj.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">{proj.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {proj.environments.map((e, idx) => (
                      <span key={idx} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium">
                        {e.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
