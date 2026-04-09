import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertCircle, PlusCircle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface SchemaVariable {
  key: string;
  type: string;
  description: string;
  required: boolean;
  defaultHint: string | null;
}

export default function ProjectDetail() {
  const { slug } = useParams();
  const [variables, setVariables] = useState<SchemaVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const { data } = await api.get(`/api/schema/pull?projectSlug=${slug}&environment=development`);
        setVariables(data.variables);
      } catch (err) {
        setError('Failed to fetch schema details. Are your settings correct?');
        console.error(error); // silence lint
      } finally {
        setLoading(false);
      }
    };
    fetchSchema();
  }, [slug]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{slug} Core Schema</h2>
          <p className="text-muted-foreground mt-1">Environment: <strong className="text-primary">development</strong></p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Pull
          </Button>
          <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Push CLI Token
          </Button>
        </div>
      </div>

      <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 shadow-sm animate-in fade-in zoom-in-95 duration-500">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Drift Detected</AlertTitle>
        <AlertDescription>
          Your local <code className="text-xs bg-destructive/20 px-1 rounded">.env</code> is missing <b>DATABASE_URL</b> which is marked as required.
        </AlertDescription>
      </Alert>

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Variable Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Requirement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Loading schema...</TableCell>
              </TableRow>
            ) : variables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No variables tracked yet.</TableCell>
              </TableRow>
            ) : (
              variables.map((v) => (
                <TableRow key={v.key} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono font-medium">{v.key}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {v.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.description || <span className="italic opacity-50">No description provided</span>}
                    {v.defaultHint && (
                      <div className="mt-1 text-xs opacity-70">
                        Default: <code className="bg-muted px-1 rounded">{v.defaultHint}</code>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.required ? (
                      <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 shadow-none">Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Optional</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
