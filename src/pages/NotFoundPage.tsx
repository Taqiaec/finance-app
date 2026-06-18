import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-7xl font-bold text-muted/30 mb-4">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <Button render={<Link to="/" />}>
        Back to Dashboard
      </Button>
    </div>
  )
}
