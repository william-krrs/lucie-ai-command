import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/recommandation')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/recommandation"!</div>
}
