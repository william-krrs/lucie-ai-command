import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/offres')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/offres"!</div>
}
